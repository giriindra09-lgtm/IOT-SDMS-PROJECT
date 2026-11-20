<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
apply_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    send_json(['ok' => false, 'error' => 'Gunakan metode GET.'], 405);
}

$vehicleId = trim((string) ($_GET['vehicle_id'] ?? ''));
$limit = (int) ($_GET['limit'] ?? 120);
$limit = max(1, min(500, $limit));

$pdo = get_pdo();

if ($vehicleId !== '') {
    $stmt = $pdo->prepare(
        'SELECT * FROM (
            SELECT
                id, vehicle_id, status, fatigue_index, hr_bpm, rmssd_ms, sdnn_ms,
                lf_hf_ratio, spo2_pct, sqi_pct, imu_rms_g, haptic_mode,
                lat, lng, speed_kmh, battery_pct, recorded_at
            FROM telemetry_logs
            WHERE vehicle_id = ?
            ORDER BY recorded_at DESC, id DESC
            LIMIT ?
        ) AS recent
        ORDER BY recorded_at ASC, id ASC'
    );
    $stmt->bindValue(1, $vehicleId, PDO::PARAM_STR);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
} else {
    $stmt = $pdo->prepare(
        'SELECT * FROM (
            SELECT
                id, vehicle_id, status, fatigue_index, hr_bpm, rmssd_ms, sdnn_ms,
                lf_hf_ratio, spo2_pct, sqi_pct, imu_rms_g, haptic_mode,
                lat, lng, speed_kmh, battery_pct, recorded_at
            FROM telemetry_logs
            ORDER BY recorded_at DESC, id DESC
            LIMIT ?
        ) AS recent
        ORDER BY recorded_at ASC, id ASC'
    );
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
}

$rows = $stmt->fetchAll();

send_json([
    'ok' => true,
    'vehicle_id' => $vehicleId,
    'count' => count($rows),
    'records' => $rows,
]);
