<?php

declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'config.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Akses langsung ditolak.']);
    exit;
}

function load_app_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $localPath = __DIR__ . '/config.local.php';
    if (!is_file($localPath)) {
        send_json([
            'ok' => false,
            'error' => 'Konfigurasi server belum siap (api/config.local.php belum dibuat di cPanel).',
        ], 503);
    }

    $loaded = require $localPath;
    if (!is_array($loaded)) {
        send_json([
            'ok' => false,
            'error' => 'Format api/config.local.php tidak valid.',
        ], 500);
    }

    $config = $loaded;
    return $config;
}

function apply_cors_headers(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $localPath = __DIR__ . '/config.local.php';
    $allowed = [];

    if (is_file($localPath)) {
        $cfg = require $localPath;
        if (is_array($cfg) && isset($cfg['allowed_origins']) && is_array($cfg['allowed_origins'])) {
            $allowed = $cfg['allowed_origins'];
        }
    }

    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Webhook-Secret');
    header('Content-Type: application/json; charset=utf-8');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function send_json(array $data, int $status = 200): void
{
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = load_app_config();
    $host = (string) ($cfg['db_host'] ?? 'localhost');
    $name = (string) ($cfg['db_name'] ?? '');
    $user = (string) ($cfg['db_user'] ?? '');
    $pass = (string) ($cfg['db_pass'] ?? '');

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $host, $name);

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException) {
        send_json([
            'ok' => false,
            'error' => 'Koneksi database MySQL gagal. Periksa kredensial pada api/config.local.php.',
        ], 503);
    }

    return $pdo;
}

function get_request_header(string $headerName): string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $headerName));
    if (isset($_SERVER[$serverKey])) {
        return trim((string) $_SERVER[$serverKey]);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp((string) $key, $headerName) === 0) {
                    return trim((string) $value);
                }
            }
        }
    }

    return '';
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        send_json(['ok' => false, 'error' => 'Body request harus berupa JSON valid.'], 400);
    }

    return $decoded;
}
