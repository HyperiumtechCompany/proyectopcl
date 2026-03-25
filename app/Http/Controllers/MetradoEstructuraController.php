<?php

namespace App\Http\Controllers;

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
                'summary'           => $s->summary, // ← Ahora incluye el resumen
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

        // ← OBTENER PLANTILLA SEGÚN SISTEMA ESTRUCTURAL
        $initialData = $this->getTemplateData($validated['structural_system'] ?? null);

        $sheet = MetradoEstructuraSpreadsheet::create([
            'user_id'           => Auth::id(),
            'name'              => $validated['name'],
            'project_name'      => $validated['project_name'] ?? null,
            'project_location'  => $validated['project_location'] ?? null,
            'building_type'     => $validated['building_type'] ?? null,
            'structural_system' => $validated['structural_system'] ?? null,
            'sheet_data'        => $initialData, // ← USA LA PLANTILLA EN VEZ DE NULL
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

    /**
     * ← NUEVO MÉTODO: Obtener plantilla según sistema estructural
     * Formato: [ITEM, DESCRIPCION, UNID, ELEM_SIMIL, LARGO, ANCHO, ALTO, N_VECES, LON, AREA, VOL, KG, UNID_METRADO, TOTAL]
     */
    private function getTemplateData(?string $structuralSystem): array
    {
        // PLANTILLA: APORTICADO
        if ($structuralSystem === 'aporticado') {
            return [
                ['01', 'CIMENTACIÓN', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'ZAPATAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01.01', 'Zapata Z1', 'm3', '4', '1.20', '1.20', '0.60', '1', '', '', '', '', '', ''],
                ['01.01.02', 'Zapata Z2', 'm3', '6', '1.00', '1.00', '0.50', '1', '', '', '', '', '', ''],
                ['02', 'COLUMNAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Columnas Nivel 1', 'm3', '8', '0.30', '0.30', '3.00', '1', '', '', '', '', '', ''],
                ['02.02', 'Columnas Nivel 2', 'm3', '8', '0.30', '0.30', '3.00', '1', '', '', '', '', '', ''],
                ['03', 'VIGAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Viga Principal V1', 'm3', '4', '0.30', '0.40', '5.00', '1', '', '', '', '', '', ''],
                ['03.02', 'Viga Secundaria V2', 'm3', '6', '0.25', '0.35', '4.00', '1', '', '', '', '', '', ''],
                ['04', 'LOSAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['04.01', 'Losa Aligerada h=20cm', 'm2', '1', '0', '0', '0.20', '1', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: MUROS ESTRUCTURALES
        if ($structuralSystem === 'muros') {
            return [
                ['01', 'CIMENTACIÓN', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Zapatas Corridas', 'm3', '1', '0.60', '0.80', '0.50', '1', '', '', '', '', '', ''],
                ['02', 'MUROS ESTRUCTURALES', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Muro E-1 (Sótano)', 'm3', '2', '0.25', '3.50', '2.80', '1', '', '', '', '', '', ''],
                ['02.02', 'Muro E-2 (PB)', 'm3', '2', '0.20', '3.00', '2.80', '1', '', '', '', '', '', ''],
                ['03', 'PLACAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Placa P-1', 'm3', '4', '0.20', '2.00', '2.80', '1', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: DUAL
        if ($structuralSystem === 'dual') {
            return [
                ['01', 'CIMENTACIÓN', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Zapatas', 'm3', '6', '1.00', '1.00', '0.60', '1', '', '', '', '', '', ''],
                ['02', 'COLUMNAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Columnas C1', 'm3', '8', '0.35', '0.35', '3.00', '1', '', '', '', '', '', ''],
                ['03', 'MUROS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Muro Estructural', 'm3', '2', '0.20', '3.00', '2.80', '1', '', '', '', '', '', ''],
                ['04', 'VIGAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['04.01', 'Viga V1', 'm3', '4', '0.30', '0.40', '5.00', '1', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: ALBAÑILERÍA CONFINADA
        if ($structuralSystem === 'albañileria') {
            return [
                ['01', 'CIMENTACIÓN', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Zapatas Corridas', 'm3', '1', '0.60', '0.80', '0.50', '1', '', '', '', '', '', ''],
                ['02', 'MUROS DE ALBAÑILERÍA', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Muro A-1 (Ladrillo)', 'm2', '4', '0.15', '3.00', '2.80', '1', '', '', '', '', '', ''],
                ['03', 'COLUMNAS DE CONFINAMIENTO', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Columna C1', 'm3', '8', '0.15', '0.25', '2.80', '1', '', '', '', '', '', ''],
                ['04', 'VIGAS DE CORONA', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['04.01', 'Viga de Corona', 'm3', '4', '0.15', '0.30', '3.00', '1', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: METÁLICO
        if ($structuralSystem === 'metalico') {
            return [
                ['01', 'CIMENTACIÓN', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Zapatas', 'm3', '4', '1.00', '1.00', '0.50', '1', '', '', '', '', '', ''],
                ['02', 'COLUMNAS METÁLICAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Columna HEB 200', 'kg', '8', '0', '0', '3.00', '1', '', '', '', '', '', ''],
                ['02.02', 'Columna HEB 240', 'kg', '4', '0', '0', '3.00', '1', '', '', '', '', '', ''],
                ['03', 'VIGAS METÁLICAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Viga IPE 300', 'kg', '6', '0', '0', '5.00', '1', '', '', '', '', '', ''],
                ['04', 'CORREAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['04.01', 'Correa PNL 150', 'kg', '20', '0', '0', '5.00', '1', '', '', '', '', '', ''],
            ];
        }

        // POR DEFECTO: HOJA VACÍA (solo headers)
        return [
            ['01', 'ITEM INICIAL', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['01.01', 'Descripción del elemento', 'm3', '1', '0', '0', '0', '1', '', '', '', '', '', ''],
        ];
    }
}