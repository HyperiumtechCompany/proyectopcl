<?php

namespace App\Http\Controllers;

use App\Models\MetradoGasSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class MetradoGasController extends Controller
{
    /**
     * Maneja tanto la LISTA de proyectos como el EDITOR.
     */
    public function gasIndex(?MetradoGasSpreadsheet $metradosGas = null): Response|RedirectResponse
    {
        $userId = Auth::id();

        if ($metradosGas && $metradosGas->exists) {
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
                'sheet_data'        => $metradosGas->sheet_data ?? [],
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
                'auth'         => ['user' => Auth::user()],
            ]);

       } else {
    // --- MODO LISTA ---
    $sheets = MetradoGasSpreadsheet::forUser($userId)
        ->orderByDesc('updated_at')
        ->get();

    // Si solo hay uno, ir directo al editor
    if ($sheets->count() === 1) {
        return redirect()->route('metrados.gas.show', $sheets->first()->id);
    }

    $sheets = $sheets->load(['owner:id,name,email,avatar'])
        ->map(fn($s) => [
            'id'               => $s->id,
            'name'             => $s->name,
            'project_name'     => $s->project_name,
            'project_location' => $s->project_location,
            'updated_at'       => $s->updated_at->format('d/m/Y H:i'),
            'is_owner'         => $s->user_id === $userId,
        ]);

    return Inertia::render('costos/metrados/GasIndex', [
        'spreadsheets' => $sheets,
        'spreadsheet'  => null,
    ]);
}
    }

    /**
     * Crea un nuevo metrado de gas.
     * sheet_data se deja vacío — el frontend genera la hoja con rowsToSheet.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'project_name'      => 'nullable|string|max:255',
            'project_location'  => 'nullable|string|max:255',
            'building_type'     => 'nullable|string|max:100',
            'gas_type'          => 'nullable|string|max:50',
            'installation_type' => 'nullable|string|max:100',
        ]);

        $sheet = MetradoGasSpreadsheet::create([
            'user_id'           => Auth::id(),
            'name'              => $validated['name'],
            'project_name'      => $validated['project_name'] ?? null,
            'project_location'  => $validated['project_location'] ?? null,
            'building_type'     => $validated['building_type'] ?? null,
            'gas_type'          => $validated['gas_type'] ?? null,
            'installation_type' => $validated['installation_type'] ?? null,
            'sheet_data'        => [], // vacío: el frontend construye la hoja inicial
        ]);

        return redirect()->route('metrados.gas.show', $sheet->id);
    }

    /**
     * Actualiza el contenido del metrado (Luckysheet guarda sheet_data completo).
     */
    public function update(Request $request, MetradoGasSpreadsheet $metradosGas): \Illuminate\Http\JsonResponse
    {
        $this->authorizeEdit($metradosGas);

        $validated = $request->validate([
            'sheet_data' => 'sometimes|nullable',
            'name'       => 'sometimes|string|max:255',
        ]);

        $metradosGas->update($validated);

        return response()->json(['ok' => true]);
    }

    /**
     * Elimina un metrado.
     */
    public function destroy(MetradoGasSpreadsheet $metradosGas): RedirectResponse
    {
        if ($metradosGas->user_id !== Auth::id()) abort(403);

        $metradosGas->delete();

        return redirect()->route('metrados.gas.index')->with('success', 'Eliminado.');
    }

    /**
     * Se une a un metrado colaborativo mediante código.
     */
    public function join(Request $request): RedirectResponse
    {
        $validated = $request->validate(['code' => 'required|string|size:8']);

        $sheet = MetradoGasSpreadsheet::where('collab_code', strtoupper($validated['code']))->firstOrFail();

        if ($sheet->user_id === Auth::id()) {
            return back()->withErrors(['code' => 'Eres el dueño de este metrado.']);
        }

        $sheet->collaborators()->syncWithoutDetaching([
            Auth::id() => ['role' => 'editor', 'joined_at' => now()],
        ]);

        return redirect()->route('metrados.gas.show', $sheet->id);
    }

    /**
     * Habilita la colaboración y devuelve el código generado.
     */
    public function enableCollaboration(MetradoGasSpreadsheet $metradosGas): \Illuminate\Http\JsonResponse
    {
        if ($metradosGas->user_id !== Auth::id()) abort(403);

        $code = $metradosGas->generateCollabCode();

        return response()->json(['code' => $code]);
    }

    // ── Métodos privados ──────────────────────────────────────────────────────

    private function authorizeAccess(MetradoGasSpreadsheet $sheet): void
    {
        $userId = Auth::id();
        if ($sheet->user_id !== $userId && !$sheet->collaborators()->where('users.id', $userId)->exists()) {
            abort(403, 'No tienes permiso para ver este metrado.');
        }
    }

    private function authorizeEdit(MetradoGasSpreadsheet $sheet): void
    {
        if (!$sheet->canEdit(Auth::user())) {
            abort(403, 'No tienes permisos de edición.');
        }
    }
}
