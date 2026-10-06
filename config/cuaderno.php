<?php

return [
    'enabled' => (bool) env('CUADERNO_ENABLED', false),
    // "agent": connector installed on each holder's computer (production, OECE blocks datacenter IPs).
    // "local": runner on 127.0.0.1 of the same computer as Costos (development).
    'mode' => env('CUADERNO_MODE', 'local'),
    'agent_timeout' => (int) env('CUADERNO_AGENT_TIMEOUT', 45),
    // Store listing of the browser extension (Chrome Web Store / Edge Add-ons) once published.
    'extension_url' => env('CUADERNO_EXTENSION_URL'),
    'runner_port' => (int) env('CUADERNO_RUNNER_PORT', 43127),
    'runner_token' => env('CUADERNO_RUNNER_TOKEN'),
    // Lets the project owner start the local connector from Costos (local installations only).
    'runner_autostart' => (bool) env('CUADERNO_RUNNER_AUTOSTART', false),
    'node_path' => env('CUADERNO_NODE_PATH', 'node'),
];
