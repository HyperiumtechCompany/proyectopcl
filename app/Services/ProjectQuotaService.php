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
use Illuminate\Validation\ValidationException;

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
     * Reject with a 422 (ValidationException, key 'quota') if $user has already
     * reached their plan's limit for $module. A ValidationException — not
     * abort(422) — so Inertia requests get a redirect back with errors.quota
     * (shown by QuotaErrorAlert in the app layout) instead of Inertia's raw
     * error modal, while JSON clients still receive a 422 with the message.
     */
    public function assertCanCreate(User $user, string $module): void
    {
        $limits = $this->limitsFor($user);

        if (! empty($limits['demo'])) {
            $this->assertCanCreateDemo($user, $module);

            return;
        }

        $status = $this->quotaStatus($user, $module);

        if ($status['limit'] !== null && $status['remaining'] === 0) {
            $this->rejectQuota("Alcanzaste el límite de {$status['limit']} proyectos de tu plan para este módulo. Sube de plan o elimina un proyecto que ya no uses para crear otro.");
        }
    }

    /**
     * Cupo de $module para $user: cuántos proyectos permite el plan (null =
     * ilimitado), cuántos ya se usaron y cuántos quedan. En plan free el cupo
     * es 1 demo activo; en organizaciones se cuenta el pool compartido.
     *
     * @return array{limit: int|null, used: int, remaining: int|null, demo: bool, shared: bool}
     */
    public function quotaStatus(User $user, string $module): array
    {
        $limits = $this->limitsFor($user);
        $modelClass = self::MODEL_MAP[$module] ?? null;
        $isDemo = ! empty($limits['demo']);
        $shared = (bool) $user->organization_id;

        if ($modelClass === null || ($isDemo && ! in_array($module, self::DEMO_MODULES, true))) {
            return ['limit' => null, 'used' => 0, 'remaining' => null, 'demo' => $isDemo, 'shared' => $shared];
        }

        $query = $modelClass::whereIn('user_id', $this->ownerIdsFor($user));

        if ($isDemo) {
            $used = $query->where('is_demo', true)
                ->where(function ($query) {
                    $query->whereNull('demo_expires_at')->orWhere('demo_expires_at', '>', now());
                })
                ->count();

            return ['limit' => 1, 'used' => min($used, 1), 'remaining' => max(0, 1 - $used), 'demo' => true, 'shared' => $shared];
        }

        $limit = $limits[$module] ?? $limits['resto'] ?? null;
        $used = $query->count();

        return [
            'limit' => $limit,
            'used' => $used,
            'remaining' => $limit === null ? null : max(0, $limit - $used),
            'demo' => false,
            'shared' => $shared,
        ];
    }

    /**
     * Compartir proyectos requiere plan de pago (individual u organización),
     * igual que el trabajo colaborativo de los demás módulos.
     */
    public function allowsCollaboration(User $user): bool
    {
        return empty($this->limitsFor($user)['demo']);
    }

    /**
     * Aviso para mostrar justo después de crear un proyecto: cuántos cupos
     * quedan, o que se usó el último. Null si el plan es ilimitado.
     */
    public function remainingNotice(User $user, string $module): ?string
    {
        $status = $this->quotaStatus($user, $module);

        if ($status['limit'] === null) {
            return null;
        }

        if ($status['remaining'] === 0) {
            return $status['demo']
                ? 'Usaste tu proyecto demo. Para crear más proyectos sube de plan.'
                : "Usaste tu último cupo ({$status['used']} de {$status['limit']}). Para crear otro proyecto sube de plan o elimina uno que ya no uses.";
        }

        $plural = $status['remaining'] === 1 ? 'proyecto' : 'proyectos';

        return "Te quedan {$status['remaining']} {$plural} de {$status['limit']} en tu plan.";
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
            $this->rejectQuota('Ya tienes un proyecto demo activo en este módulo. Espera a que expire o actualiza tu plan.');
        }
    }

    /**
     * @throws ValidationException
     */
    private function rejectQuota(string $message): never
    {
        throw ValidationException::withMessages(['quota' => $message]);
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
