<?php

namespace App\Http\Controllers;

use App\Models\AcCalculation;
use App\Models\AguaCalculation;
use App\Models\CaidaTensionSpreadsheet;
use App\Models\DesagueCalculation;
use App\Models\SpattPararrayoSpreadsheet;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user    = Auth::user();
        $userId  = $user->id;
        $isAdmin = $user->hasRole('root') || $user->hasRole('gerencia') || $user->hasRole('administracion');

        // ── Stats
        if ($isAdmin) {
            $stats = [
                'agua'    => AguaCalculation::count(),
                'desague' => DesagueCalculation::count(),
                'ac'      => AcCalculation::count(),
                'caida'   => CaidaTensionSpreadsheet::count(),
                'spatt'   => SpattPararrayoSpreadsheet::count(),
            ];
        } else {
            $stats = [
                'agua'    => AguaCalculation::forUser($userId)->count(),
                'desague' => DesagueCalculation::forUser($userId)->count(),
                'ac'      => AcCalculation::forUser($userId)->count(),
                'caida'   => CaidaTensionSpreadsheet::forUser($userId)->count(),
                'spatt'   => SpattPararrayoSpreadsheet::forUser($userId)->count(),
            ];
        }

        // ── Proyectos recientes accesibles por el usuario
        $recentProjects = $this->getRecentProjects($userId, $isAdmin);

        return Inertia::render('dashboard', [
            'stats'          => $stats,
            'recentProjects' => $recentProjects,
            'isAdmin'        => $isAdmin,
        ]);
    }

    /**
     * Obtiene los proyectos recientes de todos los módulos accesibles por el usuario.
     */
    private function getRecentProjects(int $userId, bool $isAdmin): array
    {
        $projects = collect();

        $modules = [
            'Cálculo de Agua'        => [AguaCalculation::class,           '/agua-calculation'],
            'Cálculo de Desagüe'     => [DesagueCalculation::class,        '/desague-calculation'],
            'Aire Acondicionado'     => [AcCalculation::class,             '/ac-calculation'],
            'Caída de Tensión'       => [CaidaTensionSpreadsheet::class,   '/caida-tension'],
            'SPAT y Pararrayos'      => [SpattPararrayoSpreadsheet::class, '/spatt-pararrayos'],
        ];

        foreach ($modules as $label => [$model, $route]) {
            $query = $isAdmin
                ? $model::with('owner:id,name,avatar')
                : $model::forUser($userId)->with('owner:id,name,avatar');

            $rows = $query->orderByDesc('updated_at')->limit(3)->get();

            foreach ($rows as $row) {
                // Determinar rol del usuario en este proyecto
                $collabRole = null;
                if ($row->user_id === $userId) {
                    $collabRole = 'owner';
                } else {
                    $pivot = $row->collaboratorPivots()
                        ->where('user_id', $userId)
                        ->first();
                    $collabRole = $pivot?->role ?? 'viewer';
                }

                $projects->push([
                    'id'         => $row->id,
                    'name'       => $row->name ?? ($row->project_name ?? '—'),
                    'type'       => $label,
                    'route'      => "{$route}/{$row->id}",
                    'owner'      => $row->owner?->name ?? '—',
                    'updated_at' => $row->updated_at?->format('d/m/Y H:i') ?? '—',
                    'is_owner'   => $row->user_id === $userId,
                    'collab_role' => $collabRole,
                ]);
            }
        }

        return $projects->sortByDesc('updated_at')->take(10)->values()->toArray();
    }
}
