<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    private function root(): string
    {
        return storage_path('app/private/backups/db');
    }

    private function isValidDate(string $d): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
    }

    public function index(Request $request)
    {
        $root = $this->root();
        File::ensureDirectoryExists($root);

        $projects = CostoProject::query()
            ->whereNotNull('database_name')
            ->pluck('nombre', 'database_name')
            ->toArray();
        $projects['pcl_central'] = 'Base de datos central';

        $backups = [];
        foreach (File::directories($root) as $dir) {
            $date = basename($dir);
            if (! $this->isValidDate($date)) {
                continue;
            }

            $files = [];
            $totalBytes = 0;
            foreach (File::files($dir) as $f) {
                if (! str_ends_with($f->getFilename(), '.sql.gz')) {
                    continue;
                }
                $db = substr($f->getFilename(), 0, -7);
                $bytes = $f->getSize();
                $totalBytes += $bytes;
                $files[] = [
                    'database' => $db,
                    'label' => $projects[$db] ?? $db,
                    'is_central' => $db === 'pcl_central',
                    'size' => $this->human($bytes),
                    'size_bytes' => $bytes,
                ];
            }
            if (! $files) {
                continue;
            }

            usort($files, fn ($a, $b) => ($b['is_central'] <=> $a['is_central']) ?: strcmp($a['label'], $b['label']));

            $manifest = @file_get_contents("$dir/MANIFEST.txt") ?: '';
            preg_match('/hora=([\d:]+)/', $manifest, $m);

            $backups[] = [
                'date' => $date,
                'time' => $m[1] ?? date('H:i:s', filemtime($dir)),
                'databases' => $files,
                'count' => count($files),
                'total_size' => $this->human($totalBytes),
                'total_bytes' => $totalBytes,
            ];
        }

        usort($backups, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return Inertia::render('Admin/Backups/Index', [
            'backups' => $backups,
            'status' => [
                'last_ok' => trim((string) @file_get_contents("$root/LAST_RUN_OK")) ?: null,
                'last_failed' => trim((string) @file_get_contents("$root/LAST_RUN_FAILED")) ?: null,
                'disk_free' => $this->human((int) @disk_free_space($root)),
                'disk_total' => $this->human((int) @disk_total_space($root)),
            ],
            'canRestore' => (bool) $request->user()?->hasRole('root'),
        ]);
    }

    public function store()
    {
        set_time_limit(0);

        $code = Artisan::call('db:backup');
        $out = trim(Artisan::output());

        if ($code === 0) {
            return back()->with('success', 'Copia de seguridad generada. '.$this->lastLine($out));
        }

        return back()->with('error', 'Error al generar el backup: '.$this->lastLine($out));
    }

    public function download(Request $request, string $date, string $database): BinaryFileResponse
    {
        abort_unless($this->isValidDate($date), 404);

        $path = "{$this->root()}/{$date}/".basename($database).'.sql.gz';
        abort_unless(is_file($path), 404, 'Archivo no encontrado.');

        return response()->download($path);
    }

    public function restore(Request $request)
    {
        abort_unless($request->user()?->hasRole('root'), 403, 'Solo el rol root puede restaurar.');

        $data = $request->validate([
            'date' => 'required|string',
            'database' => 'required|string',
            'confirm' => 'required|string',
        ]);

        abort_unless($this->isValidDate($data['date']), 422);
        abort_unless($data['confirm'] === $data['database'], 422, 'La confirmación no coincide con el nombre de la BD.');

        $file = "{$this->root()}/{$data['date']}/".basename($data['database']).'.sql.gz';
        abort_unless(is_file($file), 404, 'Backup no encontrado.');

        set_time_limit(0);
        $code = Artisan::call('db:restore', [
            'file' => $file,
            'database' => $data['database'],
            '--force' => true,
        ]);
        $out = trim(Artisan::output());

        if ($code === 0) {
            return back()->with('success', "«{$data['database']}» restaurada desde el backup del {$data['date']} (se guardó una copia previa).");
        }

        return back()->with('error', 'Error al restaurar: '.$this->lastLine($out));
    }

    public function destroy(string $date)
    {
        abort_unless($this->isValidDate($date), 404);

        $dir = "{$this->root()}/{$date}";
        if (File::isDirectory($dir)) {
            File::deleteDirectory($dir);
        }

        return back()->with('success', "Backup del {$date} eliminado.");
    }

    private function lastLine(string $s): string
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $s))));

        return end($lines) ?: '';
    }

    private function human(int $bytes): string
    {
        $u = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < 4) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, $i ? 1 : 0).' '.$u[$i];
    }
}
