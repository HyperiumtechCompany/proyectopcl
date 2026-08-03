<?php

namespace App\Services;

use App\Models\AcCalculation;
use App\Models\AguaCalculation;
use App\Models\CaidaTensionSpreadsheet;
use App\Models\CostoProject;
use App\Models\DesagueCalculation;
use App\Models\Dialux\DialuxProject;
use App\Models\GestorProyecto;
use App\Models\SpattPararrayoSpreadsheet;
use App\Models\User;

class ProjectQuotaService
{
    /**
     * Modules that get their own demo project when the user is on the free plan.
     */
    private const DEMO_MODULES = ['costos', 'dialux', 'gestor_proyectos'];

    private const MODEL_MAP = [
        'costos' => CostoProject::class,
        'gestor_proyectos' => GestorProyecto::class,
        'dialux' => DialuxProject::class,
        'ac' => AcCalculation::class,
        'agua' => AguaCalculation::class,
        'caida_tension' => CaidaTensionSpreadsheet::class,
        'desague' => DesagueCalculation::class,
        'pararrayos' => SpattPararrayoSpreadsheet::class,
    ];

    /**
     * Abort with 422 if $user has already reached their plan's limit for $module.
     */
    public function assertCanCreate(User $user, string $module): void
    {
        $limits = $this->limitsFor($user);

        if (! empty($limits['demo'])) {
            $this->assertCanCreateDemo($user, $module);

            return;
        }

        $modelClass = self::MODEL_MAP[$module] ?? null;
        if ($modelClass === null) {
            return;
        }

        $limit = $limits[$module] ?? $limits['resto'] ?? null;
        if ($limit === null) {
            return;
        }

        $count = $modelClass::whereIn('user_id', $this->ownerIdsFor($user))->count();

        if ($count >= $limit) {
            abort(422, "Alcanzaste el límite de {$limit} proyectos de tu plan para este módulo. Actualiza tu plan para crear más.");
        }
    }

    /**
     * Attributes to merge into a new costos/gestor-proyectos record when the
     * user is on the free plan, marking it as a time-limited demo. Empty for
     * paid plans.
     */
    public function demoAttributesFor(User $user): array
    {
        $limits = $this->limitsFor($user);

        if (empty($limits['demo'])) {
            return [];
        }

        return [
            'is_demo' => true,
            'demo_expires_at' => now()->addDays($limits['demo_days'] ?? 5),
        ];
    }

    private function assertCanCreateDemo(User $user, string $module): void
    {
        if (! in_array($module, self::DEMO_MODULES, true)) {
            return;
        }

        $modelClass = self::MODEL_MAP[$module] ?? null;
        if ($modelClass === null) {
            return;
        }

        $hasActiveDemo = $modelClass::whereIn('user_id', $this->ownerIdsFor($user))
            ->where('is_demo', true)
            ->where(function ($query) {
                $query->whereNull('demo_expires_at')->orWhere('demo_expires_at', '>', now());
            })
            ->exists();

        if ($hasActiveDemo) {
            abort(422, 'Ya tienes un proyecto demo activo en este módulo. Espera a que expire o actualiza tu plan.');
        }
    }

    private function limitsFor(User $user): array
    {
        if ($user->organization_id) {
            $orgPlan = $user->organization?->plan;

            return config("plans.{$orgPlan}") ?? config('plans.free');
        }

        $plan = $user->plan ?? 'free';

        return config("plans.{$plan}") ?? config('plans.free');
    }

    /**
     * User ids whose projects count toward the quota: the whole organization
     * when the user belongs to one (shared pool), otherwise just the user.
     */
    private function ownerIdsFor(User $user): array
    {
        if ($user->organization_id) {
            return $user->organization->users()->pluck('id')->all();
        }

        return [$user->id];
    }
}
