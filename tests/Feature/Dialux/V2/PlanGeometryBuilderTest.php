<?php

use App\Services\Dialux\CadPlanGeometryBuilder;
use Illuminate\Support\Str;

/** Lee un .dxg: encabezado + tiras por capa (en coordenadas del mundo). */
function readDxg(string $path): array
{
    $data = file_get_contents($path);
    expect(substr($data, 0, 4))->toBe('DXG1');
    $headerLength = unpack('V', substr($data, 4, 4))[1];
    $header = json_decode(substr($data, 8, $headerLength), true);
    $base = 8 + $headerLength;
    [$ox, $oy] = $header['origin'];
    $layers = [];
    foreach ($header['layers'] as $layer) {
        $at = $base + $layer['offset'];
        $counts = array_values(unpack('V*', substr($data, $at, $layer['strips'] * 4)));
        $floats = array_values(unpack('g*', substr($data, $at + $layer['strips'] * 4, $layer['points'] * 8)));
        $strips = [];
        $i = 0;
        foreach ($counts as $count) {
            $strip = [];
            for ($k = 0; $k < $count; $k++, $i += 2) {
                $strip[] = [$floats[$i] + $ox, $floats[$i + 1] + $oy];
            }
            $strips[] = $strip;
        }
        $layers[$layer['name']] = ['meta' => $layer, 'strips' => $strips];
    }

    return ['header' => $header, 'layers' => $layers];
}

function geometryDxf(): string
{
    $pairs = [
        [0, 'SECTION'], [2, 'TABLES'],
        [0, 'TABLE'], [2, 'LAYER'],
        [0, 'LAYER'], [2, 'MUROS'], [70, '0'], [62, '1'],
        [0, 'LAYER'], [2, 'OCULTA'], [70, '0'], [62, '-3'],
        [0, 'ENDTAB'],
        [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'BLOCKS'],
        // Árbol: círculo de radio 1 en el origen del bloque, en la capa 0 (hereda).
        [0, 'BLOCK'], [8, '0'], [2, 'ARBOL'], [70, '0'], [10, '0'], [20, '0'],
        [0, 'CIRCLE'], [8, '0'], [10, '0'], [20, '0'], [40, '1'],
        [0, 'TEXT'], [8, '0'], [10, '0'], [20, '-2'], [40, '0.5'], [1, 'Árbol'],
        [0, 'ENDBLK'],
        // Bloque anidado: contiene un árbol a 10 unidades.
        [0, 'BLOCK'], [8, '0'], [2, 'GRUPO'], [70, '0'], [10, '0'], [20, '0'],
        [0, 'INSERT'], [8, '0'], [2, 'ARBOL'], [10, '10'], [20, '0'],
        [0, 'ENDBLK'],
        [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'ENTITIES'],
        [0, 'LINE'], [8, 'MUROS'], [10, '500000'], [20, '8000000'], [11, '500010'], [21, '8000000'],
        // Árbol a escala 2, girado 90°, en (500020, 8000000).
        [0, 'INSERT'], [8, 'Arboles'], [2, 'ARBOL'], [10, '500020'], [20, '8000000'], [41, '2'], [42, '2'], [50, '90'],
        // Grupo anidado en (500100, 8000000).
        [0, 'INSERT'], [8, 'Arboles'], [2, 'GRUPO'], [10, '500100'], [20, '8000000'],
        [0, 'LWPOLYLINE'], [8, 'MUROS'], [90, '2'], [70, '0'], [10, '500000'], [20, '8000010'], [42, '1'], [10, '500010'], [20, '8000010'],
        [0, 'HATCH'], [8, 'MUROS'], [10, '0'], [20, '0'],
        [0, 'LINE'], [8, 'MARCO'], [67, '1'], [10, '0'], [20, '0'], [11, '1'], [21, '0'],
        [0, 'MTEXT'], [8, 'MUROS'], [10, '500005'], [20, '8000005'], [40, '0.25'], [1, '{\\fArial|b1;Aula}\\P1'],
        [0, 'ENDSEC'],
        [0, 'EOF'],
    ];

    return implode("\r\n", array_map(fn (array $p): string => $p[0]."\r\n".$p[1], $pairs))."\r\n";
}

test('el plano se reduce a geometría con bloques expandidos, capas y textos', function () {
    $dir = sys_get_temp_dir().'/dxg-'.Str::uuid();
    mkdir($dir);
    file_put_contents("$dir/in.dxf", geometryDxf());

    $report = app(CadPlanGeometryBuilder::class)->build("$dir/in.dxf", "$dir/out.dxg");
    $dxg = readDxg("$dir/out.dxg");
    $layers = $dxg['layers'];

    expect($report['bytes'])->toBe(filesize("$dir/out.dxg"))
        // Espacio papel y relleno no entran; la capa 0 de los bloques hereda "Arboles".
        ->and($layers)->not->toHaveKey('MARCO')
        ->and($layers)->not->toHaveKey('0')
        ->and($layers)->toHaveKeys(['MUROS', 'Arboles'])
        ->and($layers['MUROS']['meta']['color'])->toBe(1)
        ->and($layers['MUROS']['meta']['visible'])->toBeTrue();

    // Línea exacta en coordenadas grandes (UTM): precisión conservada.
    $line = $layers['MUROS']['strips'][0];
    expect($line[0][0])->toEqualWithDelta(500000, 1e-3)
        ->and($line[1][0])->toEqualWithDelta(500010, 1e-3)
        ->and($line[1][1])->toEqualWithDelta(8000000, 1e-3);

    // Polilínea con bulge 1 = semicírculo (varios puntos entre extremos).
    expect(count($layers['MUROS']['strips'][1]))->toBeGreaterThan(4);

    // Árbol escalado ×2: todos sus puntos a 2 del centro (500020, 8000000).
    $tree = $layers['Arboles']['strips'][0];
    foreach ($tree as [$x, $y]) {
        expect(hypot($x - 500020, $y - 8000000))->toEqualWithDelta(2, 1e-3);
    }
    // Árbol anidado del grupo: centro en (500110, 8000000), radio 1.
    $nested = $layers['Arboles']['strips'][1];
    expect(hypot($nested[0][0] - 500110, $nested[0][1] - 8000000))->toEqualWithDelta(1, 1e-3);

    // Textos: MTEXT sin formato; el del bloque, girado 90° con su inserción.
    $texts = collect($dxg['header']['texts'])->keyBy(fn (array $t) => $t[4]);
    expect($texts)->toHaveKeys(['Aula 1', 'Árbol']);
    $treeText = $dxg['header']['texts'][array_search('Árbol', array_column($dxg['header']['texts'], 4), true)];
    [$ox, $oy] = $dxg['header']['origin'];
    // (0, −2)·2 girado 90° = (4, 0) → (500024, 8000000).
    expect($treeText[0] + $ox)->toEqualWithDelta(500024, 1e-3)
        ->and($treeText[1] + $oy)->toEqualWithDelta(8000000, 1e-3)
        ->and($treeText[2])->toEqualWithDelta(1.0, 1e-6)
        ->and($treeText[5])->toBe('Arboles');
});

/** DXF mínimo: cabecera con extensión opcional + entidades del modelo. */
function modelDxf(array $entities, ?array $extents = null): string
{
    $pairs = [[0, 'SECTION'], [2, 'HEADER']];
    if ($extents !== null) {
        $pairs = array_merge($pairs, [
            [9, '$EXTMIN'], [10, (string) $extents[0]], [20, (string) $extents[1]],
            [9, '$EXTMAX'], [10, (string) $extents[2]], [20, (string) $extents[3]],
        ]);
    }
    $pairs = array_merge($pairs, [[0, 'ENDSEC'], [0, 'SECTION'], [2, 'ENTITIES']], $entities, [[0, 'ENDSEC'], [0, 'EOF']]);

    return implode("\r\n", array_map(fn (array $p): string => $p[0]."\r\n".$p[1], $pairs))."\r\n";
}

function buildDxg(string $dxf): array
{
    $dir = sys_get_temp_dir().'/dxg-'.Str::uuid();
    mkdir($dir);
    file_put_contents("$dir/in.dxf", $dxf);
    $report = app(CadPlanGeometryBuilder::class)->build("$dir/in.dxf", "$dir/out.dxg");

    return ['report' => $report, 'dxg' => readDxg("$dir/out.dxg")];
}

test('líneas sueltas que forman un contorno se unen en una sola tira, sin puntos repetidos', function () {
    $line = fn (float $x1, float $y1, float $x2, float $y2): array => [
        [0, 'LINE'], [8, 'MUROS'], [10, (string) $x1], [20, (string) $y1], [11, (string) $x2], [21, (string) $y2],
    ];
    $result = buildDxg(modelDxf(array_merge(
        $line(0, 0, 10, 0),
        $line(10, 0, 10, 10),
        $line(10, 10, 0, 10),
        // Línea de largo cero: se descarta.
        $line(5, 5, 5, 5),
        // Otra suelta, no conectada: tira aparte.
        $line(20, 0, 30, 0),
    )));
    $strips = $result['dxg']['layers']['MUROS']['strips'];

    expect($strips)->toHaveCount(2)
        ->and($strips[0])->toHaveCount(4)
        ->and($strips[0][3])->toEqual([0.0, 10.0])
        ->and($result['report']['points'])->toBe(6);
});

test('las curvas se subdividen según su tamaño respecto al plano', function () {
    $circle = fn (float $r): array => [[0, 'CIRCLE'], [8, 'C'.$r], [10, '500'], [20, '500'], [40, (string) $r]];
    $layers = buildDxg(modelDxf(array_merge($circle(0.5), $circle(200)), [0, 0, 1000, 1000]))['dxg']['layers'];

    // Pequeño (árbol, poste): pocos segmentos. Grande (curva de vía): suave.
    expect(count($layers['C0.5']['strips'][0]) - 1)->toBe(12)
        ->and(count($layers['C200']['strips'][0]) - 1)->toBe(72);
    foreach ($layers['C200']['strips'][0] as [$x, $y]) {
        expect(hypot($x - 500, $y - 500))->toEqualWithDelta(200, 1e-2);
    }
});
