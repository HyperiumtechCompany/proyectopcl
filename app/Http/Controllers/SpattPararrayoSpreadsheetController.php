<?php

namespace App\Http\Controllers;

use App\Models\SpattPararrayoSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SpattPararrayoSpreadsheetController extends Controller
{
    /**
     * Lista de hojas del usuario autenticado.
     */
    public function index(): Response
    {
        $spreadsheets = SpattPararrayoSpreadsheet::forUser(Auth::id())
            ->with(['owner:id,name,email,avatar'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($s) => [
                'id'               => $s->id,
                'name'             => $s->name,
                'project_name'     => $s->project_name,
                'is_collaborative' => $s->is_collaborative,
                'collab_code'      => $s->user_id === Auth::id() ? $s->collab_code : null,
                'owner'            => $s->owner,
                'updated_at'       => $s->updated_at->format('d/m/Y H:i'),
                'is_owner'         => $s->user_id === Auth::id(),
            ]);

        return Inertia::render('spatt-pararrayos/Index', [
            'spreadsheets' => $spreadsheets,
        ]);
    }

    /**
     * Crear nueva hoja con datos vacíos.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'project_name' => 'nullable|string|max:255',
        ]);

        $spreadsheet = SpattPararrayoSpreadsheet::create([
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'pozo_data'      => null,
            'pararrayo_data' => null,
        ]);

        return redirect()->route('spatt-pararrayos.show', $spreadsheet->id);
    }

    /**
     * Abrir editor de una hoja específica.
     */
    public function show(SpattPararrayoSpreadsheet $spattPararrayo): Response
    {
        $this->authorizeAccess($spattPararrayo);

        $spattPararrayo->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('spatt-pararrayos/Show', [
            'spreadsheet' => [
                'id'               => $spattPararrayo->id,
                'name'             => $spattPararrayo->name,
                'project_name'     => $spattPararrayo->project_name,
                'pozo_data'        => $spattPararrayo->pozo_data,
                'pararrayo_data'   => $spattPararrayo->pararrayo_data,
                'is_collaborative' => $spattPararrayo->is_collaborative,
                'collab_code'      => $spattPararrayo->user_id === Auth::id() ? $spattPararrayo->collab_code : null,
                'owner'            => $spattPararrayo->owner,
                'collaborators'    => $spattPararrayo->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $spattPararrayo->canEdit(Auth::user()),
                'is_owner'  => $spattPararrayo->user_id === Auth::id(),
            ],
        ]);
    }

    /**
     * Guardar el estado completo de la hoja.
     */
    public function update(Request $request, SpattPararrayoSpreadsheet $spattPararrayo)
    {
        $this->authorizeEdit($spattPararrayo);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'project_name'   => 'sometimes|nullable|string|max:255',
            'pozo_data'      => 'sometimes|nullable|array',
            'pararrayo_data' => 'sometimes|nullable|array',
        ]);

        $spattPararrayo->update($validated);

        return back()->with('success', 'Hoja guardada correctamente.');
    }

    /**
     * Eliminar hoja (solo el propietario).
     */
    public function destroy(SpattPararrayoSpreadsheet $spattPararrayo)
    {
        if ($spattPararrayo->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede eliminar esta hoja.');
        }

        $spattPararrayo->delete();

        return redirect()->route('spatt-pararrayos.index')
            ->with('success', 'Hoja eliminada.');
    }

    /**
     * Unirse a una hoja colaborativa con código de invitación.
     */
    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $spreadsheet = SpattPararrayoSpreadsheet::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();

        if ($spreadsheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de esta hoja.']);
        }

        $pivotRole = $user->hasRole('cliente') ? 'viewer' : 'editor';

        $spreadsheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $pivotRole, 'joined_at' => now()],
        ]);

        return redirect()->route('spatt-pararrayos.show', $spreadsheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    /**
     * Habilitar colaboración para una hoja y generar código.
     */
    public function enableCollaboration(SpattPararrayoSpreadsheet $spattPararrayo)
    {
        $this->requireCollabPlan();

        if ($spattPararrayo->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede habilitar la colaboración.');
        }

        if (!$spattPararrayo->is_collaborative) {
            $spattPararrayo->update([
                'is_collaborative' => true,
                'collab_code'      => SpattPararrayoSpreadsheet::generateCollabCode(),
            ]);
        }

        return back()->with('success', 'Colaboración habilitada. Código: ' . $spattPararrayo->collab_code);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private function authorizeAccess(SpattPararrayoSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        $isOwner       = $sheet->user_id === $userId;
        $isCollab      = $sheet->collaborators()->where('users.id', $userId)->exists();

        if (!$isOwner && !$isCollab) {
            abort(403, 'No tienes acceso a esta hoja.');
        }
    }

    private function authorizeEdit(SpattPararrayoSpreadsheet $sheet): void
    {
        if (!$sheet->canEdit(Auth::user())) {
            abort(403, 'No tienes permiso para editar esta hoja.');
        }
    }

    private function requireCollabPlan(): void
    {
        $plan = Auth::user()->plan;
        if (!in_array($plan, ['mensual', 'anual', 'lifetime'])) {
            abort(403, 'El trabajo colaborativo requiere un plan de pago.');
        }
    }
}
