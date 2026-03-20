<?php

namespace App\Http\Controllers;

use App\Models\MetradoElectricasSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoElectricasSpreadsheetController extends Controller
{
    public function index(): Response
    {
        $spreadsheets = MetradoElectricasSpreadsheet::forUser(Auth::id())
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

        return Inertia::render('costos/metrados/metrado_electricas/index', [
            'spreadsheets' => $spreadsheets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'project_name' => 'nullable|string|max:255',
        ]);

        $spreadsheet = MetradoElectricasSpreadsheet::create([
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'sheet_data'     => null,
        ]);

        return redirect()->route('metrados.electricas.show', $spreadsheet->id);
    }

    public function show(MetradoElectricasSpreadsheet $metradosElectrica): Response
    {
        $this->authorizeAccess($metradosElectrica);

        $metradosElectrica->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('costos/metrados/ElectricasIndex', [
            'project' => [
                'id'     => $metradosElectrica->id,
                'nombre' => $metradosElectrica->name,
            ],
            'metrado' => $metradosElectrica->sheet_data['metrado'] ?? [],
            'resumen' => $metradosElectrica->sheet_data['resumen'] ?? [],
            'spreadsheet' => [
                'id'               => $metradosElectrica->id,
                'name'             => $metradosElectrica->name,
                'project_name'     => $metradosElectrica->project_name,
                'is_collaborative' => $metradosElectrica->is_collaborative,
                'collab_code'      => $metradosElectrica->user_id === Auth::id() ? $metradosElectrica->collab_code : null,
                'owner'            => $metradosElectrica->owner,
                'can_edit'         => $metradosElectrica->canEdit(Auth::user()),
                'is_owner'         => $metradosElectrica->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, MetradoElectricasSpreadsheet $metradosElectrica)
    {
        $this->authorizeEdit($metradosElectrica);
        $metradosElectrica->update($request->only('name', 'project_name'));
        return back()->with('success', 'Hoja guardada correctamente.');
    }

    public function updateMetrado(Request $request, MetradoElectricasSpreadsheet $metradosElectrica)
    {
        $this->authorizeEdit($metradosElectrica);
        $data = $metradosElectrica->sheet_data ?? [];
        $data['metrado'] = $request->input('rows', []);
        $metradosElectrica->update(['sheet_data' => $data]);
        return response()->json(['success' => true]);
    }

    public function updateResumen(Request $request, MetradoElectricasSpreadsheet $metradosElectrica)
    {
        $this->authorizeEdit($metradosElectrica);
        $data = $metradosElectrica->sheet_data ?? [];
        $data['resumen'] = $request->input('rows', []);
        $metradosElectrica->update(['sheet_data' => $data]);
        return response()->json(['success' => true]);
    }

    public function destroy(MetradoElectricasSpreadsheet $metradosElectrica)
    {
        if ($metradosElectrica->user_id !== Auth::id()) {
            abort(403);
        }
        $metradosElectrica->delete();
        return redirect()->route('metrados.electricas.index');
    }

    public function join(Request $request)
    {
        $validated = $request->validate(['code' => 'required|string|size:8']);
        $spreadsheet = MetradoElectricasSpreadsheet::where('collab_code', strtoupper($validated['code']))->firstOrFail();
        $user = Auth::user();
        if ($spreadsheet->user_id !== $user->id) {
            $spreadsheet->collaborators()->syncWithoutDetaching([$user->id => ['role' => 'editor', 'joined_at' => now()]]);
        }
        return redirect()->route('metrados.electricas.show', $spreadsheet->id);
    }

    private function authorizeAccess($sheet)
    {
        if ($sheet->user_id !== Auth::id() && !$sheet->collaborators()->where('users.id', Auth::id())->exists()) {
            abort(403);
        }
    }

    private function authorizeEdit($sheet)
    {
        if (!$sheet->canEdit(Auth::user())) {
            abort(403);
        }
    }
}
