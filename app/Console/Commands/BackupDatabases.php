<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class BackupDatabases extends Command
{
    protected $signature = 'db:backup
        {--only= : Respaldar solo esta BD}
        {--list : Solo listar las BD que respaldaría}
        {--dir= : Directorio destino (default: storage/app/private/backups/db)}
        {--json : Salida JSON}
        {--retention-days=14}
        {--monthly-keep=6}
        {--min-free-mb=2048}';

    protected $description = 'Backup de pcl_central + BD tenant de Costos (mysqldump, gzip, rotación). Usa la config de Laravel, no parsea .env.';

    public function handle(): int
    {
        // Credenciales EXACTAS que usa la app (env + defaults ya resueltos).
        $c = config('database.connections.mysql');

        $root = rtrim(
            (string) ($this->option('dir') ?: storage_path('app/private/backups/db')),
            '/'
        );
        $date = date('Y-m-d');
        $dest = "$root/$date";
        $log = "$root/backup.log";

        @mkdir($root, 0775, true);
        @chmod($root, 0775);
        $write = function (string $msg) use ($log) {
            $line = '['.date('Y-m-d H:i:s')."] $msg";
            $this->line($line);
            @file_put_contents($log, $line.PHP_EOL, FILE_APPEND);
        };
        $fail = function (string $msg) use ($write, $root): int {
            $write("FALLÓ: $msg");
            @file_put_contents("$root/LAST_RUN_FAILED", date('Y-m-d H:i:s').PHP_EOL);

            return self::FAILURE;
        };

        // ── Descubrir BD (usa la conexión PDO que ya funciona) ───────────────
        if ($this->option('only')) {
            $dbs = [(string) $this->option('only')];
        } else {
            try {
                $dbs = collect(DB::connection('mysql')->select(
                    "SELECT schema_name AS n FROM information_schema.schemata
                     WHERE schema_name = 'pcl_central' OR schema_name LIKE 'costos\\_%'
                     ORDER BY schema_name"
                ))->pluck('n')->all();
            } catch (\Throwable $e) {
                return $fail('no se pudo listar BD: '.$e->getMessage());
            }
        }

        if (empty($dbs)) {
            return $fail('0 BD encontradas');
        }

        if ($this->option('list')) {
            $this->option('json')
                ? $this->line(json_encode(['databases' => $dbs]))
                : $this->line(implode(PHP_EOL, $dbs));

            return self::SUCCESS;
        }

        // ── Espacio libre ───────────────────────────────────────────────────
        $freeMb = (int) (@disk_free_space($root) / 1024 / 1024);
        $minFree = (int) $this->option('min-free-mb');
        if ($freeMb > 0 && $freeMb < $minFree) {
            return $fail("espacio insuficiente: {$freeMb}MB < {$minFree}MB");
        }

        @mkdir($dest, 0775, true);
        @chmod($dest, 0775);
        $write('Respaldando '.count($dbs)." BD → $dest");

        // ── Archivo de credenciales temporal (600) para mysqldump ────────────
        $cnf = tempnam(sys_get_temp_dir(), 'dbbk');
        chmod($cnf, 0600);
        $creds = "[client]\n";
        if (! empty($c['unix_socket'])) {
            $creds .= "socket={$c['unix_socket']}\n";
        } else {
            $creds .= 'host='.($c['host'] ?? '127.0.0.1')."\n";
            $creds .= 'port='.($c['port'] ?? '3306')."\n";
        }
        $creds .= 'user='.($c['username'] ?? '')."\n";
        $creds .= 'password="'.str_replace(['\\', '"'], ['\\\\', '\\"'], (string) ($c['password'] ?? ''))."\"\n";
        file_put_contents($cnf, $creds);

        $mysqldump = getenv('MYSQLDUMP_PATH') ?: 'mysqldump';
        $baseOpts = [
            $mysqldump, "--defaults-extra-file=$cnf",
            '--single-transaction', '--quick', '--routines', '--triggers', '--events',
            '--no-tablespaces', '--set-gtid-purged=OFF', '--column-statistics=0',
            '--default-character-set=utf8mb4', '--hex-blob',
        ];

        $fails = 0;
        foreach ($dbs as $db) {
            $out = "$dest/$db.sql.gz";
            $proc = Process::fromShellCommandline(
                implode(' ', array_map('escapeshellarg', [...$baseOpts, $db]))
                .' | gzip -6 > '.escapeshellarg($out),
                base_path(),
                null,
                null,
                3600
            );
            $proc->run();

            if ($proc->isSuccessful() && is_file($out) && filesize($out) > 0) {
                @chmod($out, 0664);
                $write(sprintf('  ✔ %s  (%s)', $db, $this->human((int) filesize($out))));
            } else {
                @unlink($out);
                $fails++;
                $write("  ✖ $db  ".trim($proc->getErrorOutput() ?: 'mysqldump falló'));
            }
        }

        @unlink($cnf);

        if ($fails > 0) {
            return $fail("$fails BD fallaron");
        }

        // ── Manifiesto + symlink + copia mensual + retención ────────────────
        file_put_contents(
            "$dest/MANIFEST.txt",
            "fecha=$date\nhora=".date('H:i:s')."\ncount=".count($dbs)."\n".implode("\n", $dbs)."\n"
        );
        @unlink("$root/latest");
        @symlink($dest, "$root/latest");

        if (date('d') === '01' && ! $this->option('only')) {
            $mdir = "$root/monthly/$date";
            if (! is_dir($mdir)) {
                (new Process(['cp', '-a', $dest, $mdir]))->run();
                $write("copia mensual → monthly/$date");
            }
        }

        $this->pruneOld($root, (int) $this->option('retention-days'), (int) $this->option('monthly-keep'));

        @unlink("$root/LAST_RUN_FAILED");
        file_put_contents("$root/LAST_RUN_OK", date('Y-m-d H:i:s').PHP_EOL);
        @chmod("$root/LAST_RUN_OK", 0664);
        $write("OK — $dest");

        if ($this->option('json')) {
            $this->line(json_encode([
                'ok' => true,
                'date' => $date,
                'dest' => $dest,
                'databases' => $dbs,
            ]));
        }

        return self::SUCCESS;
    }

    private function pruneOld(string $root, int $retentionDays, int $monthlyKeep): void
    {
        $cutoff = strtotime("-{$retentionDays} days");
        foreach (glob("$root/[0-9]*-[0-9]*-[0-9]*", GLOB_ONLYDIR) ?: [] as $d) {
            if (preg_match('~/\d{4}-\d{2}-\d{2}$~', $d) && filemtime($d) < $cutoff) {
                (new Process(['rm', '-rf', $d]))->run();
            }
        }
        $monthly = glob("$root/monthly/*", GLOB_ONLYDIR) ?: [];
        rsort($monthly);
        foreach (array_slice($monthly, $monthlyKeep) as $d) {
            (new Process(['rm', '-rf', $d]))->run();
        }
    }

    private function human(int $bytes): string
    {
        $u = ['B', 'K', 'M', 'G'];
        $i = 0;
        while ($bytes >= 1024 && $i < 3) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 1).$u[$i];
    }
}
