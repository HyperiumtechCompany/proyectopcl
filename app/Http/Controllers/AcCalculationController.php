<?php

namespace App\Http\Controllers;

use App\Models\AcCalculation;
use App\Events\AcCalculationUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AcCalculationController extends Controller
{
    /**
     * Lista de hojas del usuario autenticado.
     */
    public function index(): Response
    {
        $spreadsheets = AcCalculation::forUser(Auth::id())
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

        return Inertia::render('AcCalculation/Index', [
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

        $spreadsheet = AcCalculation::create([
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'data'           => null,
        ]);

        return redirect()->route('ac-calculation.show', $spreadsheet->id);
    }

    /**
     * Abrir editor de una hoja específica.
     */
    public function show(AcCalculation $acCalculation): Response
    {
        $this->authorizeAccess($acCalculation);

        $acCalculation->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('AcCalculation/Show', [
            'spreadsheet' => [
                'id'               => $acCalculation->id,
                'name'             => $acCalculation->name,
                'project_name'     => $acCalculation->project_name,
                'data'             => $acCalculation->data,
                'is_collaborative' => $acCalculation->is_collaborative,
                'collab_code'      => $acCalculation->user_id === Auth::id() ? $acCalculation->collab_code : null,
                'owner'            => $acCalculation->owner,
                'collaborators'    => $acCalculation->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $acCalculation->canEdit(Auth::user()),
                'is_owner'  => $acCalculation->user_id === Auth::id(),
            ],
        ]);
    }

    /**
     * Guardar el estado completo de la hoja.
     */
    public function update(Request $request, AcCalculation $acCalculation)
    {
        $this->authorizeEdit($acCalculation);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'project_name'   => 'sometimes|nullable|string|max:255',
            'data'           => 'sometimes|nullable|array',
        ]);

        $acCalculation->update($validated);

        // Notificar a los demás colaboradores en tiempo real (toOthers = excluye al emisor)
        broadcast(new AcCalculationUpdated(
            spreadsheet: $acCalculation->fresh(),
            updatedBy: Auth::id(),
            updatedByName: Auth::user()->name,
        ))->toOthers();

        // return response()->json(['success' => true]); // Can return json if preferred
        return back()->with('success', 'Hoja guardada correctamente.');
    }

    /**
     * Eliminar hoja (solo el propietario).
     */
    public function destroy(AcCalculation $acCalculation)
    {
        if ($acCalculation->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede eliminar esta hoja.');
        }

        $acCalculation->delete();

        return redirect()->route('ac-calculation.index')
            ->with('success', 'Hoja eliminada.');
    }

    /**
     * Activar colaboración y generar código de invitación.
     */
    public function enableCollaboration(AcCalculation $acCalculation)
    {
        if ($acCalculation->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $acCalculation->generateCollabCode();

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

        $spreadsheet = AcCalculation::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();

        // No unirse si ya es colaborador o dueño
        if ($spreadsheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de esta hoja.']);
        }

        $spreadsheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => 'editor', 'joined_at' => now()],
        ]);

        return redirect()->route('ac-calculation.show', $spreadsheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private function authorizeAccess(AcCalculation $sheet): void
    {
        $userId = Auth::id();
        $isOwner       = $sheet->user_id === $userId;
        $isCollab      = $sheet->collaborators()->where('users.id', $userId)->exists();

        if (!$isOwner && !$isCollab) {
            abort(403, 'No tienes acceso a esta hoja.');
        }
    }

    private function authorizeEdit(AcCalculation $sheet): void
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
