<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
apply_cors_headers();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = get_pdo();

if ($method === 'GET') {
    $filter = $_GET['acknowledged'] ?? null;
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 100)));

    if ($filter === '0' || $filter === '1') {
        $stmt = $pdo->prepare(
            'SELECT
                id, vehicle_id, driver_name, severity, trigger_reason,
                fatigue_index, spo2_pct, haptic_mode, lat, lng, qos,
                acknowledged, acknowledged_by, acknowledge_note,
                acknowledged_at, triggered_at
             FROM alarm_logs
             WHERE acknowledged = ?
             ORDER BY triggered_at DESC, id DESC
             LIMIT ?'
        );
        $stmt->bindValue(1, (int) $filter, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare(
            'SELECT
                id, vehicle_id, driver_name, severity, trigger_reason,
                fatigue_index, spo2_pct, haptic_mode, lat, lng, qos,
                acknowledged, acknowledged_by, acknowledge_note,
                acknowledged_at, triggered_at
             FROM alarm_logs
             ORDER BY triggered_at DESC, id DESC
             LIMIT ?'
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
    }

    send_json([
        'ok' => true,
        'alarms' => $stmt->fetchAll(),
    ]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $id = (int) ($body['id'] ?? 0);
    $operator = substr(trim((string) ($body['acknowledged_by'] ?? '')), 0, 80);
    $note = substr(trim((string) ($body['acknowledge_note'] ?? '')), 0, 255);

    if ($id <= 0 || $operator === '') {
        send_json([
            'ok' => false,
            'error' => 'ID alarm dan nama operator wajib diisi.',
        ], 422);
    }

    $ackAt = gmdate('Y-m-d H:i:s');
    $stmt = $pdo->prepare(
        'UPDATE alarm_logs
         SET acknowledged = 1,
             acknowledged_by = ?,
             acknowledge_note = ?,
             acknowledged_at = ?
         WHERE id = ?'
    );
    $stmt->execute([$operator, $note, $ackAt, $id]);

    if ($stmt->rowCount() === 0) {
        send_json(['ok' => false, 'error' => 'Alarm tidak ditemukan.'], 404);
    }

    $fetch = $pdo->prepare('SELECT * FROM alarm_logs WHERE id = ?');
    $fetch->execute([$id]);

    send_json([
        'ok' => true,
        'alarm' => $fetch->fetch(),
    ]);
}

send_json(['ok' => false, 'error' => 'Metode HTTP tidak didukung.'], 405);
