<?php

namespace App\Http\Controllers;

// use App\Events\EstructuraSpreadsheetUpdated; // Opcional, si creas el evento después
use App\Models\MetradoEstructuraSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoEstructuraController extends Controller
{
    public function index(): Response
    {
        $sheets = MetradoEstructuraSpreadsheet::forUser(Auth::id())
            ->with(['owner:id,name,email,avatar'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($s) => [
                'id'                => $s->id,
                'name'              => $s->name,
                'project_name'      => $s->project_name,
                'project_location'  => $s->project_location,
                'building_type'     => $s->building_type,
                'structural_system' => $s->structural_system,
                'is_collaborative'  => $s->is_collaborative,
                'collab_code'       => $s->user_id === Auth::id() ? $s->collab_code : null,
                'owner'             => $s->owner,
                'updated_at'        => $s->updated_at->format('d/m/Y H:i'),
                'is_owner'          => $s->user_id === Auth::id(),
            ]);

        return Inertia::render('costos/metrados/metrado_estructura/index', [
            'spreadsheets' => $sheets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'project_name'      => 'nullable|string|max:255',
            'project_location'  => 'nullable|string|max:255',
            'building_type'     => 'nullable|string|max:100',
            'structural_system' => 'nullable|string|max:100',
        ]);

        $sheet = MetradoEstructuraSpreadsheet::create([
            'user_id'           => Auth::id(),
            'name'              => $validated['name'],
            'project_name'      => $validated['project_name'] ?? null,
            'project_location'  => $validated['project_location'] ?? null,
            'building_type'     => $validated['building_type'] ?? null,
            'structural_system' => $validated['structural_system'] ?? null,
            'sheet_data'        => null,
        ]);

        return redirect()->route('metrados.estructura.show', $sheet->id);
    }

    public function show(MetradoEstructuraSpreadsheet $metradosEstructura): Response
    {
        $this->authorizeAccess($metradosEstructura);

        $metradosEstructura->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

       return Inertia::render('costos/metrados/metrado_estructura/show', [
            'spreadsheet' => [
                'id'                => $metradosEstructura->id,
                'name'              => $metradosEstructura->name,
                'project_name'      => $metradosEstructura->project_name,
                'project_location'  => $metradosEstructura->project_location,
                'building_type'     => $metradosEstructura->building_type,
                'structural_system' => $metradosEstructura->structural_system,
                'sheet_data'        => $metradosEstructura->sheet_data,
                'is_collaborative'  => $metradosEstructura->is_collaborative,
                'collab_code'       => $metradosEstructura->user_id === Auth::id() ? $metradosEstructura->collab_code : null,
                'owner'             => $metradosEstructura->owner,
                'collaborators'     => $metradosEstructura->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $metradosEstructura->canEdit(Auth::user()),
                'is_owner'  => $metradosEstructura->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, MetradoEstructuraSpreadsheet $metradosEstructura)
    {
        $this->authorizeEdit($metradosEstructura);

        $validated = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'project_name'      => 'sometimes|nullable|string|max:255',
            'project_location'  => 'sometimes|nullable|string|max:255',
            'building_type'     => 'sometimes|nullable|string|max:100',
            'structural_system' => 'sometimes|nullable|string|max:100',
            'sheet_data'        => 'sometimes|nullable|array',
        ]);

        $metradosEstructura->update($validated);

        // Si tienes un evento para estructura, descomenta y ajusta
        // broadcast(new EstructuraSpreadsheetUpdated(
        //     spreadsheet: $metradosEstructura->fresh(),
        //     updatedBy: Auth::id(),
        //     updatedByName: Auth::user()->name,
        // ))->toOthers();

        return back()->with('success', 'Metrado guardado correctamente.');
    }

    public function destroy(MetradoEstructuraSpreadsheet $metradosEstructura)
    {
        if ($metradosEstructura->user_id !== Auth::id()) {
            abort(403);
        }

        $metradosEstructura->delete();

        return redirect()->route('metrados.estructura.index')
            ->with('success', 'Metrado eliminado.');
    }

    public function enableCollaboration(MetradoEstructuraSpreadsheet $metradosEstructura)
    {
        if ($metradosEstructura->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $metradosEstructura->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
    }

    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $sheet = MetradoEstructuraSpreadsheet::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();
        if ($sheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de este metrado.']);
        }

        $pivotRole = $user->hasRole('cliente') ? 'viewer' : 'editor';
        $sheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $pivotRole, 'joined_at' => now()],
        ]);

        return redirect()->route('metrados.estructura.show', $sheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    private function authorizeAccess(MetradoEstructuraSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        $isOwner = $sheet->user_id === $userId;
        $isCollab = $sheet->collaborators()->where('users.id', $userId)->exists();
        if (! $isOwner && ! $isCollab) {
            abort(403);
        }
    }

    private function authorizeEdit(MetradoEstructuraSpreadsheet $sheet): void
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