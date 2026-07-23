<?php

namespace App\Concerns;

use App\Models\Dialux\DialuxProject;
use Illuminate\Support\Facades\Auth;

trait AuthorizesDialuxProject
{
    /**
     * Verifica dueño del proyecto y bloquea demos expiradas.
     */
    protected function authorizeProyecto(DialuxProject $dialuxProject): void
    {
        if ($dialuxProject->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }

        if ($dialuxProject->is_demo && $dialuxProject->demo_expires_at?->isPast()) {
            abort(403, 'Tu demo expiró. Actualiza tu plan para seguir accediendo.');
        }
    }
}
