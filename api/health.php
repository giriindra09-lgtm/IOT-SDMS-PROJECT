<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
apply_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    send_json(['ok' => false, 'error' => 'Gunakan metode GET.'], 405);
}

$pdo = get_pdo();
$requiredTables = ['vehicles', 'driver_baselines', 'telemetry_logs', 'alarm_logs'];
$existingTables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
$tableStatus = [];

foreach ($requiredTables as $table) {
    $tableStatus[$table] = in_array($table, $existingTables, true);
}

$allTablesReady = !in_array(false, $tableStatus, true);

send_json([
    'ok' => $allTablesReady,
    'php_version' => PHP_VERSION,
    'database_connected' => true,
    'tables' => $tableStatus,
    'server_time_utc' => gmdate('Y-m-d\TH:i:s\Z'),
    'message' => $allTablesReady
        ? 'API PHP dan database MySQL siap menerima telemetri.'
        : 'Database terhubung, tetapi sebagian tabel belum dibuat. Import database/schema.sql melalui phpMyAdmin.',
], $allTablesReady ? 200 : 503);
