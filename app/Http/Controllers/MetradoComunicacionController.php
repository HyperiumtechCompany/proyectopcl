<?php

namespace App\Http\Controllers;

use App\Events\ComunicacionSpreadsheetUpdated;
use App\Models\MetradoComunicacionSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoComunicacionController extends Controller
{
    public function index(): Response
    {
        $sheets = MetradoComunicacionSpreadsheet::forUser(Auth::id())
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
//resources/js/pages/costos/metrados/metrado_comunicacion/Index.tsx
        return Inertia::render('costos/metrados/metrado_comunicacion/Index', [
            'spreadsheets' => $sheets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'project_name' => 'nullable|string|max:255',
        ]);

        $sheet = MetradoComunicacionSpreadsheet::create([
            'user_id'      => Auth::id(),
            'name'         => $validated['name'],
            'project_name' => $validated['project_name'] ?? null,
            'sheet_data'   => null,
        ]);

        return redirect()->route('metrados.comunicacion.show', $sheet->id);
    }

    public function show(MetradoComunicacionSpreadsheet $metradosComunicacion): Response
    {
        $this->authorizeAccess($metradosComunicacion);

        $metradosComunicacion->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('costos/metrados/metrado_comunicacion/Show', [
            'spreadsheet' => [
                'id'               => $metradosComunicacion->id,
                'name'             => $metradosComunicacion->name,
                'project_name'     => $metradosComunicacion->project_name,
                'sheet_data'       => $metradosComunicacion->sheet_data,
                'is_collaborative' => $metradosComunicacion->is_collaborative,
                'collab_code'      => $metradosComunicacion->user_id === Auth::id() ? $metradosComunicacion->collab_code : null,
                'owner'            => $metradosComunicacion->owner,
                'collaborators'    => $metradosComunicacion->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $metradosComunicacion->canEdit(Auth::user()),
                'is_owner'  => $metradosComunicacion->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        $this->authorizeEdit($metradosComunicacion);

        $validated = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'project_name' => 'sometimes|nullable|string|max:255',
            'sheet_data'   => 'sometimes|nullable|array',
        ]);

        $metradosComunicacion->update($validated);

        broadcast(new ComunicacionSpreadsheetUpdated(
            spreadsheet: $metradosComunicacion->fresh(),
            updatedBy: Auth::id(),
            updatedByName: Auth::user()->name,
        ))->toOthers();

        return back()->with('success', 'Hoja guardada correctamente.');
    }

    public function destroy(MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        if ($metradosComunicacion->user_id !== Auth::id()) {
            abort(403);
        }

        $metradosComunicacion->delete();

        return redirect()->route('metrados.comunicacion.index')
            ->with('success', 'Hoja eliminada.');
    }

    public function enableCollaboration(MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        if ($metradosComunicacion->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $metradosComunicacion->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
    }

    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $sheet = MetradoComunicacionSpreadsheet::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();
        if ($sheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de esta hoja.']);
        }

        $pivotRole = $user->hasRole('cliente') ? 'viewer' : 'editor';
        $sheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $pivotRole, 'joined_at' => now()],
        ]);

        return redirect()->route('metrados.comunicacion.show', $sheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    private function authorizeAccess(MetradoComunicacionSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        $isOwner = $sheet->user_id === $userId;
        $isCollab = $sheet->collaborators()->where('users.id', $userId)->exists();
        if (! $isOwner && ! $isCollab) {
            abort(403);
        }
    }

    private function authorizeEdit(MetradoComunicacionSpreadsheet $sheet): void
    {
        if (! $sheet->canEdit(Auth::user())) {
            abort(403);
        }
    }

    private function requireCollabPlan(): void
    {
        $plan = Auth::user()->plan;
        if (! in_array($plan, ['mensual', 'anual', 'lifetime'])) {
            abort(403, 'El trabajo colaborativo requiere un plan de pago.');
        }
    }
}
