<?php

namespace App\Http\Controllers;

use App\Models\CaidaTensionSpreadsheet;
use App\Events\SpreadsheetUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CaidaTensionController extends Controller
{
    /**
     * Lista de hojas del usuario autenticado.
     */
    public function index(): Response
    {
        $spreadsheets = CaidaTensionSpreadsheet::forUser(Auth::id())
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

        return Inertia::render('caida-tension/Index', [
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

        $spreadsheet = CaidaTensionSpreadsheet::create([
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'td_data'        => null,
            'tg_data'        => null,
            'selection_data' => null,
        ]);

        return redirect()->route('caida-tension.show', $spreadsheet->id);
    }

    /**
     * Abrir editor de una hoja específica.
     */
    public function show(CaidaTensionSpreadsheet $caidaTension): Response
    {
        $this->authorizeAccess($caidaTension);

        $caidaTension->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('caida-tension/Show', [
            'spreadsheet' => [
                'id'               => $caidaTension->id,
                'name'             => $caidaTension->name,
                'project_name'     => $caidaTension->project_name,
                'td_data'          => $caidaTension->td_data,
                'tg_data'          => $caidaTension->tg_data,
                'selection_data'   => $caidaTension->selection_data,
                'is_collaborative' => $caidaTension->is_collaborative,
                'collab_code'      => $caidaTension->user_id === Auth::id() ? $caidaTension->collab_code : null,
                'owner'            => $caidaTension->owner,
                'collaborators'    => $caidaTension->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $caidaTension->canEdit(Auth::user()),
                'is_owner'  => $caidaTension->user_id === Auth::id(),
            ],
        ]);
    }

    /**
     * Guardar el estado completo de la hoja (los 3 tabs: td, tg, selection).
     */
    public function update(Request $request, CaidaTensionSpreadsheet $caidaTension)
    {
        $this->authorizeEdit($caidaTension);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'project_name'   => 'sometimes|nullable|string|max:255',
            'td_data'        => 'sometimes|nullable|array',
            'tg_data'        => 'sometimes|nullable|array',
            'selection_data' => 'sometimes|nullable|array',
        ]);

        $caidaTension->update($validated);

        // Notificar a los demás colaboradores en tiempo real (toOthers = excluye al emisor)
        broadcast(new SpreadsheetUpdated(
            spreadsheet: $caidaTension->fresh(),
            updatedBy: Auth::id(),
            updatedByName: Auth::user()->name,
        ))->toOthers();

        return back()->with('success', 'Hoja guardada correctamente.');
    }

    /**
     * Eliminar hoja (solo el propietario).
     */
    public function destroy(CaidaTensionSpreadsheet $caidaTension)
    {
        if ($caidaTension->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede eliminar esta hoja.');
        }

        $caidaTension->delete();

        return redirect()->route('caida-tension.index')
            ->with('success', 'Hoja eliminada.');
    }

    /**
     * Activar colaboración y generar código de invitación.
     */
    public function enableCollaboration(CaidaTensionSpreadsheet $caidaTension)
    {
        if ($caidaTension->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $caidaTension->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
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

        $spreadsheet = CaidaTensionSpreadsheet::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();

        // No unirse si ya es colaborador o dueño
        if ($spreadsheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de esta hoja.']);
        }

        $pivotRole = $user->hasRole('cliente') ? 'viewer' : 'editor';

        $spreadsheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $pivotRole, 'joined_at' => now()],
        ]);

        return redirect()->route('caida-tension.show', $spreadsheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private function authorizeAccess(CaidaTensionSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        $isOwner       = $sheet->user_id === $userId;
        $isCollab      = $sheet->collaborators()->where('users.id', $userId)->exists();

        if (!$isOwner && !$isCollab) {
            abort(403, 'No tienes acceso a esta hoja.');
        }
    }

    private function authorizeEdit(CaidaTensionSpreadsheet $sheet): void
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
