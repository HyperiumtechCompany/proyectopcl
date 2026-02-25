<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\DesagueCalculation;
use App\Events\DesagueCalculationUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DesagueCalculationController extends Controller
{
    public function index(): Response
    {
        $spreadsheets = DesagueCalculation::forUser(Auth::id())
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

        return Inertia::render('calc-desague/Index', [
            'spreadsheets' => $spreadsheets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'project_name' => 'nullable|string|max:255',
        ]);

        $data = [
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'data_sheet'     => null,
        ];

        $spreadsheet = DesagueCalculation::create($data);

        return redirect()->route('desague-calculation.show', $spreadsheet->id);
    }

    public function show(DesagueCalculation $desagueCalculation): Response
    {
        $this->authorizeAccess($desagueCalculation);

        $desagueCalculation->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('calc-desague/Show', [
            'spreadsheet' => [
                'id'               => $desagueCalculation->id,
                'name'             => $desagueCalculation->name,
                'project_name'     => $desagueCalculation->project_name,
                'data_sheet'       => $desagueCalculation->data_sheet,
                'is_collaborative' => $desagueCalculation->is_collaborative,
                'collab_code'      => $desagueCalculation->user_id === Auth::id() ? $desagueCalculation->collab_code : null,
                'owner'            => $desagueCalculation->owner,
                'collaborators'    => $desagueCalculation->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $desagueCalculation->canEdit(Auth::user()),
                'is_owner'  => $desagueCalculation->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, DesagueCalculation $desagueCalculation)
    {
        $this->authorizeEdit($desagueCalculation);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'project_name'   => 'sometimes|nullable|string|max:255',
            'data_sheet'     => 'sometimes|nullable|array',
        ]);

        $desagueCalculation->update($validated);

        broadcast(new DesagueCalculationUpdated(
            spreadsheet: $desagueCalculation->fresh(),
            updatedBy: Auth::id(),
            updatedByName: Auth::user()->name,
        ))->toOthers();

        return back()->with('success', 'Cálculo de desagüe guardado correctamente.');
    }

    public function destroy(DesagueCalculation $desagueCalculation)
    {
        if ($desagueCalculation->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede eliminar esta hoja.');
        }

        $desagueCalculation->delete();

        return redirect()->route('desague-calculation.index')
            ->with('success', 'Hoja eliminada.');
    }

    public function enableCollaboration(DesagueCalculation $desagueCalculation)
    {
        if ($desagueCalculation->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $desagueCalculation->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
    }

    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $spreadsheet = DesagueCalculation::where('collab_code', strtoupper($validated['code']))
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

        return redirect()->route('desague-calculation.show', $spreadsheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    private function authorizeAccess(DesagueCalculation $sheet): void
    {
        $userId = Auth::id();
        $isOwner       = $sheet->user_id === $userId;
        $isCollab      = $sheet->collaborators()->where('users.id', $userId)->exists();

        if (!$isOwner && !$isCollab) {
            abort(403, 'No tienes acceso a esta hoja.');
        }
    }

    private function authorizeEdit(DesagueCalculation $sheet): void
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
