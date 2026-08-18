<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BackupController extends Controller
{
    /**
     * Display a listing of the backups.
     */
    public function index()
    {
        $disk = Storage::disk('local');
        $files = $disk->allFiles('PCL_BACKUP');

        $backups = [];
        foreach ($files as $file) {
            if (str_ends_with($file, '.zip')) {
                $backups[] = [
                    'name' => basename($file),
                    'path' => $file,
                    'size' => $this->formatBytes($disk->size($file)),
                    'date' => date('Y-m-d H:i:s', $disk->lastModified($file)),
                    'timestamp' => $disk->lastModified($file),
                ];
            }
        }

        // Sort by newest
        usort($backups, fn ($a, $b) => $b['timestamp'] <=> $a['timestamp']);

        return Inertia::render('Admin/Backups/Index', [
            'backups' => $backups,
        ]);
    }

    /**
     * Trigger a new manual backup.
     */
    public function store()
    {
        // For web requests, it's safer to queue or use shell_exec in background if it takes long.
        // We will try running it directly for now (with max execution time).
        set_time_limit(0);

        try {
            Artisan::call('pcl:backup', ['--only-db' => true]);

            return redirect()->back()->with('success', 'Backup completado exitosamente.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Error generando backup: '.$e->getMessage());
        }
    }

    /**
     * Download a specific backup.
     */
    public function download($file)
    {
        $path = 'PCL_BACKUP/'.$file;

        if (! Storage::disk('local')->exists($path)) {
            abort(404, 'Backup no encontrado.');
        }

        return Storage::disk('local')->download($path);
    }

    /**
     * Delete a specific backup.
     */
    public function destroy($file)
    {
        $path = 'PCL_BACKUP/'.$file;

        if (Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }

        return redirect()->back()->with('success', 'Backup eliminado exitosamente.');
    }

    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);

        $bytes /= (1 << (10 * $pow));

        return round($bytes, $precision).' '.$units[$pow];
    }
}
