<?php

namespace App\Http\Controllers;

use App\Models\MetradoGasSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoGasController extends Controller
{
    public function index(): Response
    {
        $sheets = MetradoGasSpreadsheet::forUser(Auth::id())
            ->with(['owner:id,name,email,avatar'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($s) => [
                'id'                => $s->id,
                'name'              => $s->name,
                'project_name'      => $s->project_name,
                'project_location'  => $s->project_location,
                'building_type'     => $s->building_type,
                'gas_type'          => $s->gas_type,
                'installation_type' => $s->installation_type,
                'is_collaborative'  => $s->is_collaborative,
                'collab_code'       => $s->user_id === Auth::id() ? $s->collab_code : null,
                'owner'             => $s->owner,
                'updated_at'        => $s->updated_at->format('d/m/Y H:i'),
                'is_owner'          => $s->user_id === Auth::id(),
                'summary'           => $s->summary,
            ]);

        return Inertia::render('costos/metrados/metrado_gas/index', [
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
            'gas_type'          => 'nullable|string|max:50',
            'installation_type' => 'nullable|string|max:100',
        ]);

        // OBTENER PLANTILLA SEGÚN TIPO DE GAS E INSTALACIÓN
        $initialData = $this->getTemplateData(
            $validated['gas_type'] ?? null,
            $validated['installation_type'] ?? null
        );

        $sheet = MetradoGasSpreadsheet::create([
            'user_id'           => Auth::id(),
            'name'              => $validated['name'],
            'project_name'      => $validated['project_name'] ?? null,
            'project_location'  => $validated['project_location'] ?? null,
            'building_type'     => $validated['building_type'] ?? null,
            'gas_type'          => $validated['gas_type'] ?? null,
            'installation_type' => $validated['installation_type'] ?? null,
            'sheet_data'        => $initialData,
        ]);

        return redirect()->route('metrados.gas.show', $sheet->id);
    }

    public function show(MetradoGasSpreadsheet $metradosGas): Response
    {
        $this->authorizeAccess($metradosGas);

        $metradosGas->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('costos/metrados/metrado_gas/show', [
            'spreadsheet' => [
                'id'                => $metradosGas->id,
                'name'              => $metradosGas->name,
                'project_name'      => $metradosGas->project_name,
                'project_location'  => $metradosGas->project_location,
                'building_type'     => $metradosGas->building_type,
                'gas_type'          => $metradosGas->gas_type,
                'installation_type' => $metradosGas->installation_type,
                'sheet_data'        => $metradosGas->sheet_data,
                'is_collaborative'  => $metradosGas->is_collaborative,
                'collab_code'       => $metradosGas->user_id === Auth::id() ? $metradosGas->collab_code : null,
                'owner'             => $metradosGas->owner,
                'collaborators'     => $metradosGas->collaborators->map(fn($u) => [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $u->avatar,
                    'role'   => $u->pivot->role,
                ]),
                'can_edit'  => $metradosGas->canEdit(Auth::user()),
                'is_owner'  => $metradosGas->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, MetradoGasSpreadsheet $metradosGas)
    {
        $this->authorizeEdit($metradosGas);

        $validated = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'project_name'      => 'sometimes|nullable|string|max:255',
            'project_location'  => 'sometimes|nullable|string|max:255',
            'building_type'     => 'sometimes|nullable|string|max:100',
            'gas_type'          => 'sometimes|nullable|string|max:50',
            'installation_type' => 'sometimes|nullable|string|max:100',
            'sheet_data'        => 'sometimes|nullable|array',
        ]);

        $metradosGas->update($validated);

        return back()->with('success', 'Metrado guardado correctamente.');
    }

    public function destroy(MetradoGasSpreadsheet $metradosGas)
    {
        if ($metradosGas->user_id !== Auth::id()) {
            abort(403);
        }

        $metradosGas->delete();

        return redirect()->route('metrados.gas.index')
            ->with('success', 'Metrado eliminado.');
    }

    public function enableCollaboration(MetradoGasSpreadsheet $metradosGas)
    {
        if ($metradosGas->user_id !== Auth::id()) {
            abort(403);
        }

        $this->requireCollabPlan();

        $code = $metradosGas->generateCollabCode();

        return back()->with(['collab_code' => $code, 'success' => 'Código de colaboración generado.']);
    }

    public function join(Request $request)
    {
        $this->requireCollabPlan();

        $validated = $request->validate([
            'code' => 'required|string|size:8',
        ]);

        $sheet = MetradoGasSpreadsheet::where('collab_code', strtoupper($validated['code']))
            ->firstOrFail();

        $user = Auth::user();
        if ($sheet->user_id === $user->id) {
            return back()->withErrors(['code' => 'Eres el propietario de este metrado.']);
        }

        $pivotRole = $user->hasRole('cliente') ? 'viewer' : 'editor';
        $sheet->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $pivotRole, 'joined_at' => now()],
        ]);

        return redirect()->route('metrados.gas.show', $sheet->id)
            ->with('success', 'Te has unido como colaborador.');
    }

    private function authorizeAccess(MetradoGasSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        $isOwner = $sheet->user_id === $userId;
        $isCollab = $sheet->collaborators()->where('users.id', $userId)->exists();
        if (! $isOwner && ! $isCollab) {
            abort(403);
        }
    }

    private function authorizeEdit(MetradoGasSpreadsheet $sheet): void
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
     * Obtener plantilla según tipo de gas e instalación
     * Formato: [ITEM, DESCRIPCION, UNID, ELEM, DIAM, LARGO, N_VECES, PERDIDA, PRESION, CAUDAL, VELOCIDAD, LONGITUD, ACCESORIOS, VALVULAS, TOTAL]
     */
    private function getTemplateData(?string $gasType, ?string $installationType): array
    {
        // PLANTILLA: GAS NATURAL - RESIDENCIAL
        if ($gasType === 'gn' && $installationType === 'residencial') {
            return [
                ['01', 'TUBERÍAS Y ACCESORIOS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de cobre 1/2"', 'ml', '20', '15', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.02', 'Tubería de cobre 3/4"', 'ml', '15', '20', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.03', 'Codo 90° 1/2"', 'und', '30', '15', '', '1', '', '', '', '', '', '', '', ''],
                ['01.04', 'Codo 90° 3/4"', 'und', '20', '20', '', '1', '', '', '', '', '', '', '', ''],
                ['01.05', 'Te 1/2"', 'und', '10', '15', '', '1', '', '', '', '', '', '', '', ''],
                ['01.06', 'Reducción 3/4" a 1/2"', 'und', '5', '20', '', '1', '', '', '', '', '', '', '', ''],
                ['01.07', 'Válvula de esfera 1/2"', 'und', '8', '15', '', '1', '', '', '', '', '', '', '', ''],
                ['01.08', 'Válvula de esfera 3/4"', 'und', '4', '20', '', '1', '', '', '', '', '', '', '', ''],
                
                ['02', 'EQUIPOS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Calentador de paso 16L', 'und', '1', '', '', '1', '', '', '1.6', '', '', '', '', ''],
                ['02.02', 'Cocina a gas 4 hornillas', 'und', '1', '', '', '1', '', '', '0.8', '', '', '', '', ''],
                ['02.03', 'Medidor de gas G4', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
                
                ['03', 'PRUEBAS Y PUESTA EN MARCHA', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Prueba de hermeticidad', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
                ['03.02', 'Puesta en marcha', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: GLP - RESIDENCIAL
        if ($gasType === 'glp' && $installationType === 'residencial') {
            return [
                ['01', 'TUBERÍAS Y ACCESORIOS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de cobre 1/2"', 'ml', '15', '15', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.02', 'Tubería de cobre 3/4"', 'ml', '10', '20', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.03', 'Codo 90° 1/2"', 'und', '20', '15', '', '1', '', '', '', '', '', '', '', ''],
                ['01.04', 'Codo 90° 3/4"', 'und', '15', '20', '', '1', '', '', '', '', '', '', '', ''],
                ['01.05', 'Válvula de esfera 1/2"', 'und', '6', '15', '', '1', '', '', '', '', '', '', '', ''],
                
                ['02', 'EQUIPOS GLP', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Tanque estacionario 500L', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
                ['02.02', 'Regulador de presión', 'und', '1', '', '', '1', '', '0.3', '', '', '', '', '', ''],
                ['02.03', 'Cocina a gas GLP', 'und', '1', '', '', '1', '', '', '0.6', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: GAS NATURAL - COMERCIAL
        if ($gasType === 'gn' && $installationType === 'comercial') {
            return [
                ['01', 'TUBERÍAS PRINCIPALES', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de acero 1"', 'ml', '30', '25', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.02', 'Tubería de acero 2"', 'ml', '20', '50', '1000', '1', '', '', '', '', '', '', '', ''],
                
                ['02', 'ACCESORIOS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Codo 90° 1"', 'und', '15', '25', '', '1', '', '', '', '', '', '', '', ''],
                ['02.02', 'Codo 90° 2"', 'und', '10', '50', '', '1', '', '', '', '', '', '', '', ''],
                ['02.03', 'Te 1"', 'und', '8', '25', '', '1', '', '', '', '', '', '', '', ''],
                ['02.04', 'Válvula de compuerta 1"', 'und', '4', '25', '', '1', '', '', '', '', '', '', '', ''],
                
                ['03', 'EQUIPOS COMERCIALES', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Caldera 100kW', 'und', '1', '', '', '1', '', '', '10.5', '', '', '', '', ''],
                ['03.02', 'Cocina industrial 4 quemadores', 'und', '2', '', '', '1', '', '', '2.5', '', '', '', '', ''],
                ['03.03', 'Horno de convección', 'und', '1', '', '', '1', '', '', '3.2', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: INDUSTRIAL
        if ($gasType === 'industrial') {
            return [
                ['01', 'TUBERÍA PRINCIPAL', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de acero 4"', 'ml', '50', '100', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.02', 'Tubería de acero 6"', 'ml', '30', '150', '1000', '1', '', '', '', '', '', '', '', ''],
                
                ['02', 'ACCESORIOS INDUSTRIALES', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Codo 90° 4"', 'und', '8', '100', '', '1', '', '', '', '', '', '', '', ''],
                ['02.02', 'Codo 90° 6"', 'und', '5', '150', '', '1', '', '', '', '', '', '', '', ''],
                ['02.03', 'Válvula de mariposa 4"', 'und', '3', '100', '', '1', '', '', '', '', '', '', '', ''],
                
                ['03', 'EQUIPOS INDUSTRIALES', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Horno industrial', 'und', '1', '', '', '1', '', '', '25.0', '', '', '', '', ''],
                ['03.02', 'Secador rotativo', 'und', '1', '', '', '1', '', '', '18.5', '', '', '', '', ''],
                ['03.03', 'Quemador industrial', 'und', '2', '', '', '1', '', '', '12.0', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: GAS NATURAL VEHICULAR (GNV)
        if ($gasType === 'gnv') {
            return [
                ['01', 'SISTEMA GNV', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Cilindro GNV Tipo 1', 'und', '4', '', '', '1', '', '200', '', '', '', '', '', ''],
                ['01.02', 'Válvula de cilindro', 'und', '4', '', '', '1', '', '', '', '', '', '', '', ''],
                ['01.03', 'Tubería de alta presión', 'ml', '10', '6', '1000', '1', '', '', '', '', '', '', '', ''],
                ['01.04', 'Regulador de presión', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
                ['01.05', 'Manómetro', 'und', '2', '', '', '1', '', '', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA: MIXTA (MÚLTIPLES TIPOS)
        if ($installationType === 'mixta') {
            return [
                ['01', 'RED PRINCIPAL', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['01.01', 'Tubería de acero 2"', 'ml', '40', '50', '1000', '1', '', '', '', '', '', '', '', ''],
                
                ['02', 'RAMAL RESIDENCIAL', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['02.01', 'Tubería de cobre 3/4"', 'ml', '15', '20', '1000', '1', '', '', '', '', '', '', '', ''],
                ['02.02', 'Válvula de esfera 3/4"', 'und', '4', '20', '', '1', '', '', '', '', '', '', '', ''],
                
                ['03', 'RAMAL COMERCIAL', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['03.01', 'Tubería de acero 1"', 'ml', '20', '25', '1000', '1', '', '', '', '', '', '', '', ''],
                ['03.02', 'Válvula de compuerta 1"', 'und', '2', '25', '', '1', '', '', '', '', '', '', '', ''],
            ];
        }

        // PLANTILLA POR DEFECTO
        return [
            ['01', 'TUBERÍAS', '', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['01.01', 'Tubería de cobre', 'ml', '1', '15', '1000', '1', '', '', '', '', '', '', '', ''],
            ['01.02', 'Accesorios varios', 'und', '1', '', '', '1', '', '', '', '', '', '', '', ''],
        ];
    }
}