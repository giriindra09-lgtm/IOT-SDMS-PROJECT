<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
apply_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    send_json(['ok' => false, 'error' => 'Gunakan metode GET.'], 405);
}

$pdo = get_pdo();

$vehiclesStmt = $pdo->query(
    "SELECT
        vehicle_id, plate_number, driver_name, device_id,
        last_status, last_fatigue_index, last_spo2, last_hr, last_sqi,
        last_haptic_mode, last_lat, last_lng, last_speed_kmh, last_seen_at
     FROM vehicles
     ORDER BY FIELD(last_status, 'KRITIS', 'WASPADA', 'DATA_TIDAK_VALID', 'NORMAL'), last_seen_at DESC"
);
$vehicles = $vehiclesStmt->fetchAll();

$unackStmt = $pdo->query('SELECT COUNT(*) FROM alarm_logs WHERE acknowledged = 0');
$unacknowledgedAlarms = (int) $unackStmt->fetchColumn();

send_json([
    'ok' => true,
    'vehicles' => $vehicles,
    'unacknowledged_alarms' => $unacknowledgedAlarms,
]);
