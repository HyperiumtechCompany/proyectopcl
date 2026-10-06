<?php

namespace App\Http\Controllers\Cuaderno;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cuaderno\CuadernoAsientoOficialRequest;
use App\Http\Requests\Cuaderno\CuadernoConsultaRequest;
use App\Http\Requests\Cuaderno\CuadernoPdfZipRequest;
use App\Http\Requests\Cuaderno\StoreCuadernoReferenciaRequest;
use App\Http\Requests\Cuaderno\UpdateCuadernoAsientoRequest;
use App\Models\CostoProject;
use App\Models\CuadernoAsiento;
use App\Models\CuadernoReferencia;
use App\Models\CuadernoVinculo;
use App\Services\Cuaderno\CuadernoRunner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class CuadernoAsientoController extends Controller
{
    /** Local search shared by the inbox screen and the export. */
    public static function filtered(CuadernoVinculo $vinculo, array $filters): HasMany
    {
        return $vinculo->asientos()
            ->when($filters['q'] ?? null, fn (Builder $query, string $value) => $query->where(fn (Builder $query) => $query
                ->where('titulo', 'like', '%'.$value.'%')->orWhere('numero', $value)
                ->orWhere('usuario', 'like', '%'.$value.'%')->orWhere('nota_local', 'like', '%'.$value.'%')))
            ->when($filters['tipo'] ?? null, fn (Builder $query, string $value) => $query->where('tipo', $value))
            ->when($filters['estado'] ?? null, fn (Builder $query, string $value) => $query->where('estado', $value));
    }

    public function update(UpdateCuadernoAsientoRequest $request, CostoProject $costoProject, CuadernoAsiento $asiento): RedirectResponse
    {
        $asiento->nota_local = $request->validated('nota_local');
        $asiento->save();

        return back()->with('success', 'Nota del asiento N.º '.$asiento->numero.' guardada.');
    }

    public function link(StoreCuadernoReferenciaRequest $request, CostoProject $costoProject, CuadernoAsiento $asiento): RedirectResponse
    {
        $destino = CuadernoAsiento::query()->where('cuaderno_vinculo_id', $asiento->cuaderno_vinculo_id)
            ->where('numero', $request->integer('numero'))->firstOrFail();
        $referencia = CuadernoReferencia::query()->firstOrNew([
            'origen_asiento_id' => $asiento->id,
            'destino_asiento_id' => $destino->id,
        ]);
        $referencia->user_id ??= $request->user()->id;
        $referencia->save();

        return back()->with('success', 'Asiento N.º '.$asiento->numero.' enlazado con el N.º '.$destino->numero.'.');
    }

    public function unlink(Request $request, CostoProject $costoProject, CuadernoAsiento $asiento, CuadernoReferencia $referencia): RedirectResponse
    {
        abort_unless($request->user()?->id === $costoProject->user_id
            && $asiento->vinculo?->costo_project_id === $costoProject->id
            && in_array($asiento->id, [$referencia->origen_asiento_id, $referencia->destino_asiento_id], true), 403);
        $referencia->delete();

        return back()->with('success', 'Enlace eliminado.');
    }

    /** Brings the official detail and PDF of one entry from OECE through the connector. */
    public function oficial(CuadernoAsientoOficialRequest $request, CostoProject $costoProject, CuadernoAsiento $asiento, CuadernoRunner $runner): JsonResponse|RedirectResponse
    {
        $vinculo = $asiento->vinculo;
        abort_unless($vinculo->active_slot === 1, 404);
        $lock = Cache::lock('cuaderno-operacion:'.$vinculo->id, 70);
        if (! $lock->get()) {
            throw ValidationException::withMessages(['conexion' => 'Hay una operación en curso. Espera un momento.']);
        }
        try {
            $asiento = $runner->fetchAsiento($vinculo, $asiento, $request->boolean('pdf', true), $request->boolean('detalle', true));
        } finally {
            $lock->release();
        }

        if ($request->expectsJson()) {
            return response()->json(['asiento' => $asiento->only('id', 'numero', 'external_id', 'tiene_pdf', 'detalle_at')]);
        }

        return back()->with('success', 'Asiento N.º '.$asiento->numero.' actualizado con su detalle'.($asiento->tiene_pdf ? ' y PDF oficial.' : '.'));
    }

    /** Serves the stored official PDF only to the project owner (never from a public URL). */
    public function pdf(CuadernoAsientoOficialRequest $request, CostoProject $costoProject, CuadernoAsiento $asiento): StreamedResponse
    {
        abort_unless($asiento->tiene_pdf && Storage::disk('local')->exists($asiento->pdf_path), 404);
        $name = 'asiento-'.$asiento->numero.'-'.Str::slug(Str::limit($asiento->titulo, 60, '')).'.pdf';

        return Storage::disk('local')->response($asiento->pdf_path, $name, [
            'Content-Type' => 'application/pdf',
            'X-Content-Type-Options' => 'nosniff',
        ], $request->boolean('descargar') ? 'attachment' : 'inline');
    }

    /**
     * Official PDFs already stored in Costos, as one ZIP ordered by entry number
     * ("0007 - Título.pdf"): all, a number range or a selection.
     */
    public function zip(CuadernoPdfZipRequest $request, CostoProject $costoProject): BinaryFileResponse|RedirectResponse
    {
        $vinculo = $costoProject->cuadernoVinculos()->where('active_slot', 1)->firstOrFail();
        $asientos = $vinculo->asientos()->whereNotNull('pdf_path')
            ->when($request->integer('desde'), fn (Builder $query, int $desde) => $query->where('numero', '>=', $desde))
            ->when($request->integer('hasta'), fn (Builder $query, int $hasta) => $query->where('numero', '<=', $hasta))
            ->when($request->validated('ids'), fn (Builder $query, array $ids) => $query->whereKey($ids))
            ->orderBy('numero')->get(['id', 'numero', 'titulo', 'pdf_path']);
        $disk = Storage::disk('local');
        $asientos = $asientos->filter(fn (CuadernoAsiento $asiento): bool => $disk->exists($asiento->pdf_path))->values();
        if ($asientos->isEmpty()) {
            return back()->with('error', 'No hay PDF oficiales descargados en esa selección. Tráelos primero desde OECE.');
        }

        $width = max(4, strlen((string) $asientos->max('numero')));
        $temporary = $disk->path('cuaderno/tmp/'.Str::uuid().'.zip');
        if (! is_dir(dirname($temporary))) {
            mkdir(dirname($temporary), 0750, true);
        }
        $zip = new ZipArchive;
        $zip->open($temporary, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($asientos as $asiento) {
            // Windows-safe names that sort by number.
            $title = Str::squish((string) preg_replace('#[\\\\/:*?"<>|]+#u', ' ', Str::limit($asiento->titulo, 80, '')));
            $zip->addFile($disk->path($asiento->pdf_path), str_pad((string) $asiento->numero, $width, '0', STR_PAD_LEFT).' - '.$title.'.pdf');
        }
        $zip->close();
        $range = $asientos->first()->numero.'-'.$asientos->last()->numero;

        return response()->download($temporary, 'cuaderno-'.Str::slug($costoProject->nombre).'-asientos-'.$range.'.zip', [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend();
    }

    public function export(CuadernoConsultaRequest $request, CostoProject $costoProject): StreamedResponse
    {
        $vinculo = $costoProject->cuadernoVinculos()->where('active_slot', 1)->firstOrFail();
        $query = self::filtered($vinculo, $request->safe()->only(['q', 'tipo', 'estado']))
            ->with(['referencias.destino:id,numero', 'referenciadoPor.origen:id,numero'])
            ->orderBy('numero');
        $filename = 'cuaderno-'.Str::slug($costoProject->nombre).'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query): void {
            $output = fopen('php://output', 'w');
            // UTF-8 BOM so Excel opens accents correctly.
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['N.º', 'Título', 'Tipo', 'Fecha oficial', 'Usuario', 'Rol', 'Estado', 'Enlaza a', 'Enlazado desde', 'Nota local']);
            $query->chunk(500, function ($asientos) use ($output): void {
                foreach ($asientos as $asiento) {
                    fputcsv($output, [
                        $asiento->numero, $asiento->titulo, $asiento->tipo, $asiento->fecha_oficial,
                        $asiento->usuario, $asiento->rol, $asiento->estado,
                        $asiento->referencias->pluck('destino.numero')->implode(', '),
                        $asiento->referenciadoPor->pluck('origen.numero')->implode(', '),
                        $asiento->nota_local,
                    ]);
                }
            });
            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
