<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class RestoreDatabase extends Command
{
    protected $signature = 'db:restore {file : Ruta al .sql.gz (o .sql)} {database? : BD destino (default: nombre del archivo)} {--force}';

    protected $description = 'Restaura UNA base de datos desde un dump de db:backup. Pide confirmación si la BD ya existe.';

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        if (! is_readable($file)) {
            $this->error("No puedo leer: $file");

            return self::FAILURE;
        }

        $target = (string) ($this->argument('database')
            ?: preg_replace('/\.(sql\.gz|sql|gz)$/', '', basename($file)));

        $c = config('database.connections.mysql');

        $exists = (int) DB::connection('mysql')->scalar(
            'SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?',
            [$target]
        ) > 0;

        $this->line("Origen : $file");
        $this->line("Destino: $target  ".($exists ? '(YA EXISTE — se sobrescribe)' : '(se creará)'));

        if ($exists && ! $this->option('force')) {
            $confirm = $this->ask('Escribe el nombre de la BD para confirmar');
            if ($confirm !== $target) {
                $this->warn('Cancelado.');

                return self::FAILURE;
            }
        }

        $cnf = tempnam(sys_get_temp_dir(), 'dbrs');
        chmod($cnf, 0600);
        $creds = "[client]\n";
        if (! empty($c['unix_socket'])) {
            $creds .= "socket={$c['unix_socket']}\n";
        } else {
            $creds .= 'host='.($c['host'] ?? '127.0.0.1')."\nport=".($c['port'] ?? '3306')."\n";
        }
        $creds .= 'user='.($c['username'] ?? '')."\n";
        $creds .= 'password="'.str_replace(['\\', '"'], ['\\\\', '\\"'], (string) ($c['password'] ?? ''))."\"\n";
        file_put_contents($cnf, $creds);

        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$target}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        $cat = str_ends_with($file, '.gz') ? 'gunzip -c' : 'cat';
        $cmd = $cat.' '.escapeshellarg($file)
            .' | mysql --defaults-extra-file='.escapeshellarg($cnf).' '.escapeshellarg($target);

        $this->line('Restaurando…');
        $proc = Process::fromShellCommandline($cmd, base_path(), null, null, 7200);
        $proc->run(fn ($t, $b) => $this->output->write($b));

        @unlink($cnf);

        if (! $proc->isSuccessful()) {
            $this->error('Falló: '.trim($proc->getErrorOutput()));

            return self::FAILURE;
        }

        $this->info("OK — $target restaurada desde $file");

        return self::SUCCESS;
    }
}
