<?php

// Load Laravel bootstrap
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

// Get database connection
$db = $app->make('database');

// Count users by role
echo "=== User Count by Role ===\n";
$users = $db->table('users')->select('role')->selectRaw('role, count(*) as count')->groupBy('role')->get();
$total = 0;
foreach ($users as $row) {
    echo "{$row->role}: {$row->count}\n";
    $total += $row->count;
}
echo "Total: $total\n\n";

// Show sample users
echo "=== Sample Users ===\n";
$samples = $db->table('users')->limit(15)->get(['id', 'name', 'email', 'role']);
foreach ($samples as $user) {
    echo "{$user->name} ({$user->email}) - {$user->role}\n";
}
