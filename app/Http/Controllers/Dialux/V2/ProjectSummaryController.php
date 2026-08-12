<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\V2\ProjectSummaryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProjectSummaryController extends Controller
{
    use AuthorizesDialuxProject;

    public function __construct(private readonly ProjectSummaryService $summaries) {}

    public function show(DialuxProject $dialuxProject): JsonResponse|Response
    {
        $this->authorizeProyecto($dialuxProject);
        $summary = $this->summaries->get($dialuxProject);

        if (request()->wantsJson()) {
            return response()->json(['summary' => $summary]);
        }

        return Inertia::render('dialux/v2/Summary', [
            'project' => $dialuxProject->only([
                'id', 'name', 'description', 'client_name', 'location', 'project_code', 'status',
            ]),
            'summary' => $summary,
        ]);
    }

    public function export(DialuxProject $dialuxProject): HttpResponse
    {
        $this->authorizeProyecto($dialuxProject);
        $summary = $this->summaries->get($dialuxProject);
        $filename = Str::slug($dialuxProject->name ?: 'proyecto-dialux').'-consolidado.pdf';

        return Pdf::loadView('dialux.export.project-summary-pdf', [
            'project' => $dialuxProject,
            'summary' => $summary,
        ])->setPaper('a4')->download($filename);
    }
}
