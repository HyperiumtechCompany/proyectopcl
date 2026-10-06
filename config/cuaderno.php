<?php

return [
    'enabled' => (bool) env('CUADERNO_ENABLED', false),
    'runner_port' => (int) env('CUADERNO_RUNNER_PORT', 43127),
    'runner_token' => env('CUADERNO_RUNNER_TOKEN'),
    // Lets the project owner start the local connector from Costos (local installations only).
    'runner_autostart' => (bool) env('CUADERNO_RUNNER_AUTOSTART', false),
    'node_path' => env('CUADERNO_NODE_PATH', 'node'),
];
