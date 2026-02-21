<?php

namespace App\Http\Controllers;

use App\Models\AguaCalculation;
use App\Events\SpreadsheetUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AguaCalculationController extends Controller
{
    public function index(): Response
    {
        $spreadsheets = AguaCalculation::forUser(Auth::id())
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

        return Inertia::render('calc-agua/Index', [
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

        $spreadsheet = AguaCalculation::create($data);

        return redirect()->route('agua-calculation.show', $spreadsheet->id);
    }

    public function show(AguaCalculation $aguaCalculation): Response
    {
        $this->authorizeAccess($aguaCalculation);

        $aguaCalculation->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('calc-agua/Show', [
            'spreadsheet' => [
                'id'               => $aguaCalculation->id,
                'name'             => $aguaCalculation->name,
                'project_name'     => $aguaCalculation->project_name,
                'data_sheet'       => $aguaCalculation->data_sheet,
                'is_collaborative' => $aguaCalculation->is_collaborative,
                'collab_code'      => $aguaCalculation->user_id === Auth::id() ? $aguaCalculation->collab_code : null,
                'owner'            => $aguaCalculation->owner,
                'collaborators'    => $aguaCalculation->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $aguaCalculation->canEdit(Auth::user()),
                'is_owner'  => $aguaCalculation->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, AguaCalculation $aguaCalculation)
    {
        $this->authorizeEdit($aguaCalculation);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'project_name'   => 'sometimes|nullable|string|max:255',
            'data_sheet'     => 'sometimes|nullable|array',
        ]);

        $aguaCalculation->update($validated);

        broadcast(new \App\Events\AguaCalculationUpdated(
            spreadsheet: $aguaCalculation->fresh(),
            updatedBy: Auth::id(),
            updatedByName: Auth::user()->name,
        ))->toOthers();

        return back()->with('success', 'Cálculo de agua guardado correctamente.');
    }

    public function destroy(AguaCalculation $aguaCalculation)
    {
        if ($aguaCalculation->user_id !== Auth::id()) {
            abort(403, 'Solo el propietario puede eliminar esta hoja.');
        }

        $aguaCalculation->delete();

        return redirect()->route('agua-calculation.index')
            ->with('success', 'Hoja eliminada.');
    }

    public function enableCollaboration(AguaCalculation $aguaCalculation)
    {
        if ($aguaCalculation->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $aguaCalculation->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
    }

    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $spreadsheet = AguaCalculation::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();

        // No unirse si ya es colaborador o dueño
        if ($spreadsheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de esta hoja.']);
        }

        $spreadsheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => 'editor', 'joined_at' => now()],
        ]);

        return redirect()->route('agua-calculation.show', $spreadsheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    private function authorizeAccess(AguaCalculation $sheet): void
    {
        $userId = Auth::id();
        $isOwner       = $sheet->user_id === $userId;
        $isCollab      = $sheet->collaborators()->where('users.id', $userId)->exists();

        if (!$isOwner && !$isCollab) {
            abort(403, 'No tienes acceso a esta hoja.');
        }
    }

    private function authorizeEdit(AguaCalculation $sheet): void
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
