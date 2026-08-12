<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen consolidado - {{ $project->name }}</title>
    <style>
        @page { margin: 24px; }
        body { color: #172033; font-family: DejaVu Sans, sans-serif; font-size: 10px; }
        h1 { margin: 0; color: #111827; font-size: 22px; }
        h2 { margin: 22px 0 8px; color: #92400e; font-size: 14px; }
        .muted { color: #64748b; }
        .meta { margin-top: 6px; }
        .metrics { margin-top: 18px; width: 100%; border-collapse: collapse; }
        .metrics td { width: 25%; padding: 9px; border: 1px solid #e2e8f0; }
        .metrics strong { display: block; color: #111827; font-size: 15px; }
        table.modules { width: 100%; border-collapse: collapse; }
        .modules th { padding: 7px 5px; background: #f1f5f9; text-align: left; }
        .modules td { padding: 7px 5px; border-bottom: 1px solid #e2e8f0; }
        .number { text-align: right; }
        footer { position: fixed; bottom: 0; color: #94a3b8; font-size: 8px; }
    </style>
</head>
<body>
    <h1>{{ $project->name }}</h1>
    <div class="meta muted">
        Resumen consolidado DIALux V2
        @if($project->project_code) · {{ $project->project_code }} @endif
        @if($project->client_name) · Cliente: {{ $project->client_name }} @endif
        @if($project->location) · {{ $project->location }} @endif
    </div>

    <table class="metrics">
        <tr>
            <td><span class="muted">Módulos</span><strong>{{ $summary['totals']['modules'] }}</strong></td>
            <td><span class="muted">Ambientes</span><strong>{{ $summary['totals']['rooms'] }}</strong></td>
            <td><span class="muted">Luminarias</span><strong>{{ $summary['totals']['luminaires'] }}</strong></td>
            <td><span class="muted">Potencia</span><strong>{{ number_format($summary['totals']['installed_power_w'], 2) }} W</strong></td>
        </tr>
        <tr>
            <td><span class="muted">Planos</span><strong>{{ $summary['totals']['plans'] }}</strong></td>
            <td><span class="muted">Tomacorrientes</span><strong>{{ $summary['totals']['outlets'] }}</strong></td>
            <td><span class="muted">Cumplen</span><strong>{{ $summary['totals']['compliant_rooms'] }}</strong></td>
            <td><span class="muted">No cumplen</span><strong>{{ $summary['totals']['non_compliant_rooms'] }}</strong></td>
        </tr>
    </table>

    <h2>Detalle por módulo</h2>
    <table class="modules">
        <thead><tr><th>Módulo</th><th>Estado</th><th class="number">Amb.</th><th class="number">Lum.</th><th class="number">Tomas</th><th class="number">Potencia</th><th class="number">Cumplen</th><th class="number">No cumplen</th></tr></thead>
        <tbody>
        @foreach($summary['modules'] as $module)
            <tr>
                <td>{{ $module['name'] }}</td><td>{{ $module['status'] }}</td>
                <td class="number">{{ $module['rooms_count'] }}</td><td class="number">{{ $module['luminaires_count'] }}</td>
                <td class="number">{{ $module['outlets_count'] }}</td><td class="number">{{ number_format($module['installed_power_w'], 2) }} W</td>
                <td class="number">{{ $module['compliant_rooms'] }}</td><td class="number">{{ $module['non_compliant_rooms'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
    <footer>Generado el {{ \Illuminate\Support\Carbon::parse($summary['generated_at'])->format('d/m/Y H:i') }} · DIALux V2</footer>
</body>
</html>
