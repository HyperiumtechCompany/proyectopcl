<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Versión ligera de planos CAD pesados
    |--------------------------------------------------------------------------
    |
    | El navegador abre los planos CAD en su propio hilo y se queda sin memoria
    | con archivos de decenas de MB. Por encima de estos tamaños, la cola del
    | servidor genera una versión LIGERA (DXF sin sombreados, imágenes ni
    | objetos proxy) que es la que abre el editor. Mismos topes que
    | `cadOpenHardMax` en resources/js/pages/dialux/hooks/dialuxPlanStorage.ts.
    |
    */

    'plan_light' => [
        'threshold_bytes' => [
            'dwg' => 6_000_000,
            'dxf' => 20_000_000,
        ],

        // Conexión y cola dedicadas (un solo proceso en Supervisor: no compite con la web).
        'connection' => env('DIALUX_PLAN_QUEUE_CONNECTION', 'database-cad'),
        'queue' => env('DIALUX_PLAN_QUEUE', 'cad'),

        // Tiempo máximo de conversión + aligerado, en segundos.
        'timeout' => (int) env('DIALUX_PLAN_TIMEOUT', 1800),

        /*
        | Comando para convertir DWG → DXF en el servidor (opcional). Sin él,
        | los DWG pesados piden subir el DXF. Marcadores: {input} (ruta del
        | .dwg), {output} (ruta del .dxf a generar), {input_dir}, {output_dir},
        | {input_name}.
        |
        | ODA File Converter (recomendado; sin pantalla requiere xvfb):
        |   xvfb-run -a /usr/bin/ODAFileConverter "{input_dir}" "{output_dir}" ACAD2013 DXF 0 1 "{input_name}"
        | LibreDWG:
        |   dwg2dxf -y -o "{output}" "{input}"
        */
        'dwg_converter' => env('DIALUX_DWG_CONVERTER'),
    ],

];
