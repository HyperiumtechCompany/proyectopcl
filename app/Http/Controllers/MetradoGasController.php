<?php

namespace App\Http\Controllers;

use App\Models\MetradoGasSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoGasController extends Controller
{
    /**
     * Maneja tanto la LISTA de proyectos como el EDITOR (Fusión Gas-Sanitarias).
     */
    public function gasIndex(?MetradoGasSpreadsheet $metradosGas = null)
    {
        $userId = Auth::id();

        if ($metradosGas) {
            // --- MODO EDITOR ---
            $this->authorizeAccess($metradosGas);

            $metradosGas->load([
                'owner:id,name,email,avatar',
                'collaborators:id,name,email,avatar'
            ]);

            $spreadsheet = [
                'id'                => $metradosGas->id,
                'name'              => $metradosGas->name,
                'project_name'      => $metradosGas->project_name,
                'project_location'  => $metradosGas->project_location,
                'building_type'     => $metradosGas->building_type,
                'gas_type'          => $metradosGas->gas_type,
                'installation_type' => $metradosGas->installation_type,
                'sheet_data'        => $metradosGas->sheet_data, 
                'is_collaborative'  => $metradosGas->is_collaborative,
                'collab_code'       => $metradosGas->user_id === $userId ? $metradosGas->collab_code : null,
                'owner'             => $metradosGas->owner,
                'collaborators'     => $metradosGas->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'          => $metradosGas->canEdit(Auth::user()),
                'is_owner'          => $metradosGas->user_id === $userId,
            ];

            return Inertia::render('costos/metrados/GasIndex', [
                'spreadsheet'  => $spreadsheet,
                'spreadsheets' => [],
                'auth'         => ['user' => Auth::user()]
            ]);

        } else {
            // --- MODO LISTA ---
            $sheets = MetradoGasSpreadsheet::forUser($userId)
                ->with(['owner:id,name,email,avatar'])
                ->orderByDesc('updated_at')
                ->get()
                ->map(fn($s) => [
                    'id'                => $s->id,
                    'name'              => $s->name,
                    'project_name'      => $s->project_name,
                    'project_location'  => $s->project_location,
                    'updated_at'        => $s->updated_at->format('d/m/Y H:i'),
                    'is_owner'          => $s->user_id === $userId,
                ]);

            return Inertia::render('costos/metrados/GasIndex', [
                'spreadsheets' => $sheets,
                'spreadsheet'  => null,
            ]);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'project_name'      => 'nullable|string|max:255',
            'project_location'  => 'nullable|string|max:255',
            'building_type'     => 'nullable|string|max:100',
            'gas_type'          => 'nullable|string|max:50',
            'installation_type' => 'nullable|string|max:100',
        ]);

        $initialData = $this->getTemplateData(
            $validated['gas_type'] ?? null,
            $validated['installation_type'] ?? null
        );

        $sheet = MetradoGasSpreadsheet::create([
            'user_id'           => Auth::id(),
            'name'              => $validated['name'],
            'project_name'      => $validated['project_name'],
            'project_location'  => $validated['project_location'],
            'building_type'     => $validated['building_type'],
            'gas_type'          => $validated['gas_type'],
            'installation_type' => $validated['installation_type'],
            'sheet_data'        => $initialData,
        ]);

        return redirect()->route('metrados.gas.index', $sheet->id);
    }

    public function update(Request $request, MetradoGasSpreadsheet $metradosGas)
    {
        $this->authorizeEdit($metradosGas);

        $validated = $request->validate([
            'sheet_data' => 'sometimes|nullable|array',
            'name'       => 'sometimes|string|max:255',
        ]);

        $metradosGas->update($validated);

        return back()->with('success', 'Guardado correctamente.');
    }

    public function destroy(MetradoGasSpreadsheet $metradosGas)
    {
        if ($metradosGas->user_id !== Auth::id()) abort(403);
        $metradosGas->delete();
        return redirect()->route('metrados.gas.index')->with('success', 'Eliminado.');
    }

    // --- MÉTODOS DE COLABORACIÓN ---

    public function join(Request $request)
    {
        $validated = $request->validate(['code' => 'required|string|size:8']);
        $sheet = MetradoGasSpreadsheet::where('collab_code', strtoupper($validated['code']))->firstOrFail();
        
        if ($sheet->user_id === Auth::id()) return back()->withErrors(['code' => 'Eres el dueño.']);

        $sheet->collaborators()->syncWithoutDetaching([
            Auth::id() => ['role' => 'editor', 'joined_at' => now()],
        ]);

        return redirect()->route('metrados.gas.index', $sheet->id);
    }

    // --- MÉTODOS PRIVADOS Y PLANTILLAS ---

    private function authorizeAccess(MetradoGasSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        if ($sheet->user_id !== $userId && !$sheet->collaborators()->where('users.id', $userId)->exists()) {
            abort(403);
        }
    }

    private function authorizeEdit(MetradoGasSpreadsheet $sheet): void
    {
        if (!$sheet->canEdit(Auth::user())) abort(403);
    }

    private function getTemplateData(?string $gasType, ?string $installationType): array
    {
        // Tu lógica de plantillas (GN, GLP, etc.)
        if ($gasType === 'gn' && $installationType === 'residencial') {
            return [
                ['01', 'TUBERÍAS Y ACCESORIOS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de cobre 1/2"', 'ml', '20', '15', '1000', '1', '', '', '', '', '', '', '', ''],
                // ... resto de tu plantilla residencial
            ];
        }
        
        return [['01', 'GENERAL', 'und', '1', '', '', '1', '', '', '', '', '', '', '', '']];
    }
}