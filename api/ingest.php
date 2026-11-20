<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
apply_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    send_json(['ok' => false, 'error' => 'Gunakan metode POST.'], 405);
}

$cfg = load_app_config();
$expectedSecret = (string) ($cfg['webhook_secret'] ?? '');
$providedSecret = get_request_header('X-Webhook-Secret');

if ($expectedSecret === '' || !hash_equals($expectedSecret, $providedSecret)) {
    send_json(['ok' => false, 'error' => 'Secret webhook tidak valid.'], 401);
}

$rawBody = read_json_body();
$topic = '';
$qos = 0;
$payload = $rawBody;

// Mendukung format wrapper EMQX Webhook ({ topic, payload, qos, timestamp }) sekaligus JSON langsung.
if (isset($rawBody['payload'])) {
    $topic = (string) ($rawBody['topic'] ?? '');
    $qos = (int) ($rawBody['qos'] ?? 0);
    if (is_string($rawBody['payload'])) {
        $decodedPayload = json_decode($rawBody['payload'], true);
        if (!is_array($decodedPayload)) {
            send_json(['ok' => false, 'error' => 'Field payload EMQX bukan JSON valid.'], 400);
        }
        $payload = $decodedPayload;
    } elseif (is_array($rawBody['payload'])) {
        $payload = $rawBody['payload'];
    }
}

$vehicleId = trim((string) ($payload['vehicle_id'] ?? $payload['vehicleId'] ?? ''));
if ($vehicleId === '' && $topic !== '') {
    $parts = explode('/', $topic);
    if (count($parts) >= 2) {
        $vehicleId = trim($parts[1]);
    }
}

if ($vehicleId === '') {
    send_json(['ok' => false, 'error' => 'vehicle_id wajib ada pada payload atau topik MQTT.'], 422);
}

$rawStatus = strtoupper(str_replace(' ', '_', trim((string) ($payload['status'] ?? 'NORMAL'))));
$allowedStatuses = ['NORMAL', 'WASPADA', 'KRITIS', 'DATA_TIDAK_VALID'];
$status = in_array($rawStatus, $allowedStatuses, true) ? $rawStatus : 'NORMAL';

$plateNumber = substr(trim((string) ($payload['plate_number'] ?? $payload['plateNumber'] ?? $vehicleId)), 0, 32);
$driverName = substr(trim((string) ($payload['driver_name'] ?? $payload['driverName'] ?? 'Pengemudi')), 0, 80);
$deviceId = substr(trim((string) ($payload['device_id'] ?? $payload['deviceId'] ?? '')), 0, 48);

$fatigueIndex = (float) ($payload['fatigue_index'] ?? $payload['fatigueIndex'] ?? 0);
$fatigueIndex = max(0.0, min(1.0, $fatigueIndex));

$hrBpm = isset($payload['hr_bpm']) || isset($payload['hrBpm']) ? (float) ($payload['hr_bpm'] ?? $payload['hrBpm']) : null;
$rmssdMs = isset($payload['rmssd_ms']) || isset($payload['rmssdMs']) ? (float) ($payload['rmssd_ms'] ?? $payload['rmssdMs']) : null;
$sdnnMs = isset($payload['sdnn_ms']) || isset($payload['sdnnMs']) ? (float) ($payload['sdnn_ms'] ?? $payload['sdnnMs']) : null;
$lfHfRatio = isset($payload['lf_hf_ratio']) || isset($payload['lfHfRatio']) ? (float) ($payload['lf_hf_ratio'] ?? $payload['lfHfRatio']) : null;
$spo2Pct = isset($payload['spo2_pct']) || isset($payload['spo2Pct']) ? (float) ($payload['spo2_pct'] ?? $payload['spo2Pct']) : null;
$sqiPct = (int) max(0, min(100, (int) ($payload['sqi_pct'] ?? $payload['sqiPct'] ?? 0)));
$imuRmsG = isset($payload['imu_rms_g']) || isset($payload['imuRmsG']) ? (float) ($payload['imu_rms_g'] ?? $payload['imuRmsG']) : null;
$hapticMode = substr(strtoupper(trim((string) ($payload['haptic_mode'] ?? $payload['hapticMode'] ?? 'MATI'))), 0, 32);

$lat = isset($payload['lat']) ? (float) $payload['lat'] : null;
$lng = isset($payload['lng']) ? (float) $payload['lng'] : null;
$speedKmh = isset($payload['speed_kmh']) || isset($payload['speedKmh']) ? (float) ($payload['speed_kmh'] ?? $payload['speedKmh']) : null;
$batteryPct = isset($payload['battery_pct']) || isset($payload['batteryPct']) ? (int) max(0, min(100, (int) ($payload['battery_pct'] ?? $payload['batteryPct']))) : null;

$rawTs = $payload['timestamp'] ?? ($rawBody['timestamp'] ?? null);
$recordedAt = gmdate('Y-m-d H:i:s');
if (is_numeric($rawTs)) {
    $sec = (int) ((int) $rawTs > 9999999999 ? ((int) $rawTs / 1000) : (int) $rawTs);
    $recordedAt = gmdate('Y-m-d H:i:s', $sec);
} elseif (is_string($rawTs) && $rawTs !== '') {
    $parsed = strtotime($rawTs);
    if ($parsed !== false) {
        $recordedAt = gmdate('Y-m-d H:i:s', $parsed);
    }
}

$pdo = get_pdo();
$pdo->beginTransaction();

try {
    $upsertVehicle = $pdo->prepare(
        'INSERT INTO vehicles (
            vehicle_id, plate_number, driver_name, device_id,
            last_status, last_fatigue_index, last_spo2, last_hr, last_sqi,
            last_haptic_mode, last_lat, last_lng, last_speed_kmh, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            plate_number = VALUES(plate_number),
            driver_name = VALUES(driver_name),
            device_id = VALUES(device_id),
            last_status = VALUES(last_status),
            last_fatigue_index = VALUES(last_fatigue_index),
            last_spo2 = VALUES(last_spo2),
            last_hr = VALUES(last_hr),
            last_sqi = VALUES(last_sqi),
            last_haptic_mode = VALUES(last_haptic_mode),
            last_lat = COALESCE(VALUES(last_lat), last_lat),
            last_lng = COALESCE(VALUES(last_lng), last_lng),
            last_speed_kmh = COALESCE(VALUES(last_speed_kmh), last_speed_kmh),
            last_seen_at = VALUES(last_seen_at)'
    );

    $upsertVehicle->execute([
        $vehicleId, $plateNumber, $driverName, $deviceId,
        $status, $fatigueIndex, $spo2Pct, $hrBpm, $sqiPct,
        $hapticMode, $lat, $lng, $speedKmh, $recordedAt,
    ]);

    $insertTelemetry = $pdo->prepare(
        'INSERT INTO telemetry_logs (
            vehicle_id, status, fatigue_index, hr_bpm, rmssd_ms, sdnn_ms,
            lf_hf_ratio, spo2_pct, sqi_pct, imu_rms_g, haptic_mode,
            lat, lng, speed_kmh, battery_pct, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $insertTelemetry->execute([
        $vehicleId, $status, $fatigueIndex, $hrBpm, $rmssdMs, $sdnnMs,
        $lfHfRatio, $spo2Pct, $sqiPct, $imuRmsG, $hapticMode,
        $lat, $lng, $speedKmh, $batteryPct, $recordedAt,
    ]);

    $telemetryId = (int) $pdo->lastInsertId();
    $alarmId = null;

    $isAlarmTopic = $topic !== '' && str_ends_with($topic, '/alarm');
    if ($status === 'KRITIS' || $isAlarmTopic) {
        $severity = $status === 'WASPADA' ? 'WASPADA' : 'KRITIS';
        $reason = trim((string) ($payload['trigger_reason'] ?? $payload['triggerReason'] ?? ''));
        if ($reason === '') {
            if ($spo2Pct !== null && $spo2Pct < 92.0) {
                $reason = sprintf('SpO2 %.1f%% di bawah 92%% dan IK %.2f', $spo2Pct, $fatigueIndex);
            } else {
                $reason = sprintf('Indeks Kelelahan %.2f melampaui ambang batas T2 (0.75)', $fatigueIndex);
            }
        }

        $insertAlarm = $pdo->prepare(
            'INSERT INTO alarm_logs (
                vehicle_id, driver_name, severity, trigger_reason,
                fatigue_index, spo2_pct, haptic_mode, lat, lng, qos, triggered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $insertAlarm->execute([
            $vehicleId,
            $driverName,
            $severity,
            substr($reason, 0, 160),
            $fatigueIndex,
            $spo2Pct,
            $hapticMode,
            $lat,
            $lng,
            $qos > 0 ? $qos : 1,
            $recordedAt,
        ]);

        $alarmId = (int) $pdo->lastInsertId();
    }

    $pdo->commit();

    send_json([
        'ok' => true,
        'vehicle_id' => $vehicleId,
        'telemetry_id' => $telemetryId,
        'alarm_id' => $alarmId,
        'recorded_at' => $recordedAt,
    ], 201);
} catch (Throwable) {
    $pdo->rollBack();
    send_json(['ok' => false, 'error' => 'Gagal menyimpan data telemetri ke MySQL.'], 500);
}
