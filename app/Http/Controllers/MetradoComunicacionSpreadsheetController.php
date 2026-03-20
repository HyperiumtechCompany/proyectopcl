<?php

namespace App\Http\Controllers;

use App\Models\MetradoComunicacionSpreadsheet;
// use App\Events\MetradoComunicacionUpdated; // Check if exists later
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradoComunicacionSpreadsheetController extends Controller
{
    public function index(): Response
    {
        $spreadsheets = MetradoComunicacionSpreadsheet::forUser(Auth::id())
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

        return Inertia::render('costos/metrados/metrado_comunicacion/index', [
            'spreadsheets' => $spreadsheets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'project_name' => 'nullable|string|max:255',
        ]);

        $spreadsheet = MetradoComunicacionSpreadsheet::create([
            'user_id'        => Auth::id(),
            'name'           => $validated['name'],
            'project_name'   => $validated['project_name'] ?? null,
            'sheet_data'     => null,
        ]);

        return redirect()->route('metrados.comunicaciones.show', $spreadsheet->id);
    }

    public function show(MetradoComunicacionSpreadsheet $metradosComunicacion): Response
    {
        $this->authorizeAccess($metradosComunicacion);

        $metradosComunicacion->load([
            'owner:id,name,email,avatar',
            'collaborators:id,name,email,avatar',
        ]);

        return Inertia::render('costos/metrados/ComunicacionesIndex', [
            'project' => [
                'id'     => $metradosComunicacion->id,
                'nombre' => $metradosComunicacion->name,
            ],
            // Map sheet_data to metrado/resumen if expected by the view
            'metrado' => $metradosComunicacion->sheet_data['metrado'] ?? [],
            'resumen' => $metradosComunicacion->sheet_data['resumen'] ?? [],
            'spreadsheet' => [
                'id'               => $metradosComunicacion->id,
                'name'             => $metradosComunicacion->name,
                'project_name'     => $metradosComunicacion->project_name,
                'is_collaborative' => $metradosComunicacion->is_collaborative,
                'collab_code'      => $metradosComunicacion->user_id === Auth::id() ? $metradosComunicacion->collab_code : null,
                'owner'            => $metradosComunicacion->owner,
                'can_edit'         => $metradosComunicacion->canEdit(Auth::user()),
                'is_owner'         => $metradosComunicacion->user_id === Auth::id(),
            ],
        ]);
    }

    public function update(Request $request, MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        $this->authorizeEdit($metradosComunicacion);

        $validated = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'project_name' => 'sometimes|nullable|string|max:255',
            'rows'         => 'sometimes|nullable|array',
        ]);
        
        // Handle sheet data updates (if coming from the Luckysheet index)
        if ($request->has('rows')) {
            // This is a simplified version, usually you'd want to know which sheet
            $currentData = $metradosComunicacion->sheet_data ?? [];
            // If the view sends rows, we might need to know which part (metrado or resumen)
            // For now, let's assume it's updating based on the context or URL
            // Actually, the current ComunicacionesIndex.tsx does separate PATCHes.
        }

        $metradosComunicacion->update($validated);

        return back()->with('success', 'Hoja guardada correctamente.');
    }

    public function updateMetrado(Request $request, MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        $this->authorizeEdit($metradosComunicacion);
        $data = $metradosComunicacion->sheet_data ?? [];
        $data['metrado'] = $request->input('rows', []);
        $metradosComunicacion->update(['sheet_data' => $data]);
        return response()->json(['success' => true]);
    }

    public function updateResumen(Request $request, MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        $this->authorizeEdit($metradosComunicacion);
        $data = $metradosComunicacion->sheet_data ?? [];
        $data['resumen'] = $request->input('rows', []);
        $metradosComunicacion->update(['sheet_data' => $data]);
        return response()->json(['success' => true]);
    }

    public function destroy(MetradoComunicacionSpreadsheet $metradosComunicacion)
    {
        if ($metradosComunicacion->user_id !== Auth::id()) {
            abort(403);
        }
        $metradosComunicacion->delete();
        return redirect()->route('metrados.comunicaciones.index');
    }

    public function join(Request $request)
    {
        $validated = $request->validate(['code' => 'required|string|size:8']);
        $spreadsheet = MetradoComunicacionSpreadsheet::where('collab_code', strtoupper($validated['code']))->firstOrFail();
        $user = Auth::user();
        if ($spreadsheet->user_id !== $user->id) {
            $spreadsheet->collaborators()->syncWithoutDetaching([$user->id => ['role' => 'editor', 'joined_at' => now()]]);
        }
        return redirect()->route('metrados.comunicaciones.show', $spreadsheet->id);
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
