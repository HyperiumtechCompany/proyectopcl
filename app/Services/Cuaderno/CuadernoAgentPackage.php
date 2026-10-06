<?php

namespace App\Services\Cuaderno;

/**
 * The connector the holder installs: the same browser engine as the local runner plus the
 * agent loop. Its version is a hash of the files, so any deploy updates the computers.
 */
class CuadernoAgentPackage
{
    /** Published path => repository path. */
    private const FILES = [
        'cuaderno-agent.mjs' => 'scripts/cuaderno-agent.mjs',
        'cuaderno/engine.mjs' => 'scripts/cuaderno/engine.mjs',
        'cuaderno/browser.mjs' => 'scripts/cuaderno/browser.mjs',
        'cuaderno/dom.mjs' => 'scripts/cuaderno/dom.mjs',
    ];

    /** @return array<string, string> */
    public function files(): array
    {
        return array_map(fn (string $path): string => (string) file_get_contents(base_path($path)), self::FILES);
    }

    public function version(): string
    {
        return substr(hash('sha256', implode("\0", $this->files())), 0, 12);
    }
}
