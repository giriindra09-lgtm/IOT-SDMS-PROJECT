<?php
// Salin file ini menjadi api/config.local.php langsung di cPanel File Manager.
// Jangan pernah commit config.local.php ke Git.

return [
    'db_host' => 'localhost',
    'db_name' => 'usernamecpanel_sdms',
    'db_user' => 'usernamecpanel_sdmsuser',
    'db_pass' => 'GANTI_PASSWORD_MYSQL_YANG_KUAT',
    'webhook_secret' => 'GANTI_SECRET_WEBHOOK_EMQX_MINIMAL_32_KARAKTER',
    'allowed_origins' => [
        'https://domainkamu.com',
        'https://www.domainkamu.com',
    ],
];
