<?php
// Copy to config.php for local development. In production config.php is written
// by the GitHub deploy workflow from the repository secrets (never commit it).
return [
    'db_host' => 'localhost',          // Hostinger: always localhost
    'db_port' => 3306,
    'db_name' => 'u123456789_invoices', // hPanel → Databases → MySQL Databases
    'db_user' => 'u123456789_inv',
    'db_pass' => 'change-me',
    'debug'   => false,                 // true shows error details in API responses
];
