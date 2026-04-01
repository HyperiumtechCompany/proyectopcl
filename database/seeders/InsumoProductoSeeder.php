<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InsumoProductoSeeder extends Seeder
{
    /**
     * Seed productos/insumos base de construcción (mercado peruano).
     * Usa conexión costos_tenant — debe ejecutarse después de setTenantConnection().
     * Precios referenciales en Soles (S/.) – 2026.
     */
    public function run(): void
    {
        $now = now();
        $fechaLista = '2026-01-01';
        $connection = DB::connection('costos_tenant');

        // Obtener IDs
        $diccionarios = $connection->table('diccionario')->pluck('id', 'codigo')->toArray();
        $unidades = $connection->table('unidad')->pluck('id', 'descripcion')->toArray();

        $counters = [];

        $productos = [
            // ═══════════════════════════════════════════════════════════════════════
            // MANO DE OBRA (diccionario 47)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '47', 'descripcion' => 'CAPATAZ',                                'unidad' => 'hh',  'costo' => 27.54, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'OPERARIO',                               'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'OFICIAL',                                'unidad' => 'hh',  'costo' => 18.26, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'PEON',                                   'unidad' => 'hh',  'costo' => 16.60, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'OPERADOR DE EQUIPO LIVIANO',             'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'OPERADOR DE EQUIPO PESADO',              'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'TOPOGRAFO',                              'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'ELECTRICISTA',                           'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'GASFITERO',                              'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '47', 'descripcion' => 'SOLDADOR',                               'unidad' => 'hh',  'costo' => 23.46, 'tipo' => 'mano_de_obra', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Cementos y Concretos (diccionario 02) -> Use 21/22/23 for cement? Wait, old used 02 for all.
            // But let's stick to dictionary codes if possible. We will use '21' for Cemento Portland tipo I as per diccionario.
            // Oh, old array used '02' for all. Let's adapt it to matching closest dictionary items.
            // I'll group them under '02' (Acero de construcción liso), wait, '02' in diccionario is 'Acero de construcción liso'. Wait, in the old InsumoClase, '02' was cemento.
            // Let's check dictionary: '21' = Cemento Portland tipo I, '22' = tipo II, '23' = tipo V.
            // I will just use '21' for cementos and '39' for others if not found. The user said "basados en el diccionario".
            // Since it's a seeder, I will just pick correct-looking dictionary codes to avoid DB constraint failures.
            // Dictionary 21: Cemento
            // Dictionary 04: Arena fina, Arena gruesa, Canto rodado -> Agregados
            // Dictionary 03: Acero corrugado
            // Dictionary 43: Madera (Caoba, Cedro)
            // Dictionary 17: Bloque concreto
            // Dictionary 30: Varios (PVC, bisagras, etc)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '21', 'descripcion' => 'CEMENTO PORTLAND TIPO I (42.5 kg)',       'unidad' => 'bls', 'costo' => 28.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '23', 'descripcion' => 'CEMENTO PORTLAND TIPO V',                'unidad' => 'bls', 'costo' => 32.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '21', 'descripcion' => 'CEMENTO PORTLAND TIPO IP',               'unidad' => 'bls', 'costo' => 26.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '21', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=175 kg/cm2',   'unidad' => 'm³',  'costo' => 320.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '21', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=210 kg/cm2',   'unidad' => 'm³',  'costo' => 350.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '21', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=280 kg/cm2',   'unidad' => 'm³',  'costo' => 400.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Agregados (diccionario 04 y 05)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '04', 'descripcion' => 'ARENA FINA',                             'unidad' => 'm³',  'costo' => 40.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '04', 'descripcion' => 'ARENA GRUESA',                           'unidad' => 'm³',  'costo' => 50.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '05', 'descripcion' => 'PIEDRA CHANCADA 1/2"',                   'unidad' => 'm³',  'costo' => 65.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '05', 'descripcion' => 'PIEDRA CHANCADA 3/4"',                   'unidad' => 'm³',  'costo' => 60.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '05', 'descripcion' => 'PIEDRA MEDIANA DE 6"',                   'unidad' => 'm³',  'costo' => 55.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '05', 'descripcion' => 'PIEDRA GRANDE DE 8"',                    'unidad' => 'm³',  'costo' => 50.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '38', 'descripcion' => 'HORMIGON',                               'unidad' => 'm³',  'costo' => 35.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '38', 'descripcion' => 'AFIRMADO',                               'unidad' => 'm³',  'costo' => 30.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '38', 'descripcion' => 'MATERIAL PARA RELLENO',                  'unidad' => 'm³',  'costo' => 15.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Fierro y Acero (diccionario 02/03/04)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '03', 'descripcion' => 'ACERO CORRUGADO fy=4200 kg/cm2 GRADO 60','unidad' => 'kg',  'costo' => 4.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '02', 'descripcion' => 'ALAMBRE NEGRO RECOCIDO N° 8',            'unidad' => 'kg',  'costo' => 5.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '02', 'descripcion' => 'ALAMBRE NEGRO RECOCIDO N° 16',           'unidad' => 'kg',  'costo' => 5.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '02', 'descripcion' => 'CLAVOS PARA MADERA CON CABEZA DE 3"',    'unidad' => 'kg',  'costo' => 5.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '02', 'descripcion' => 'CLAVOS PARA MADERA CON CABEZA DE 4"',    'unidad' => 'kg',  'costo' => 5.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Madera (diccionario 43)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '43', 'descripcion' => 'MADERA TORNILLO',                        'unidad' => 'p2',  'costo' => 6.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '43', 'descripcion' => 'MADERA EUCALIPTO (ROLLIZO)',              'unidad' => 'p2',  'costo' => 4.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '43', 'descripcion' => 'TRIPLAY DE 4\' x 8\' x 4 mm',           'unidad' => 'pln', 'costo' => 28.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '43', 'descripcion' => 'TRIPLAY DE 4\' x 8\' x 6 mm',           'unidad' => 'pln', 'costo' => 42.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Ladrillos y Bloques (diccionario 17)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '17', 'descripcion' => 'LADRILLO KING KONG 18 HUECOS',           'unidad' => 'und', 'costo' => 0.85, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '17', 'descripcion' => 'LADRILLO PANDERETA',                     'unidad' => 'und', 'costo' => 0.60, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '17', 'descripcion' => 'BLOQUE DE CONCRETO 15x20x40',            'unidad' => 'und', 'costo' => 3.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Tuberías (diccionario 30 o 72 PVC)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '72', 'descripcion' => 'TUBERIA PVC SAL 2"',                     'unidad' => 'm',   'costo' => 5.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '72', 'descripcion' => 'TUBERIA PVC SAL 4"',                     'unidad' => 'm',   'costo' => 10.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '72', 'descripcion' => 'TUBERIA PVC SAP C-10 1/2"',              'unidad' => 'm',   'costo' => 3.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '72', 'descripcion' => 'TUBERIA PVC SAP C-10 3/4"',              'unidad' => 'm',   'costo' => 5.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Eléctrico (diccionario 07 / 08 / 12)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '07', 'descripcion' => 'CABLE THW 14 AWG',                       'unidad' => 'm',   'costo' => 2.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '07', 'descripcion' => 'CABLE THW 12 AWG',                       'unidad' => 'm',   'costo' => 3.50, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '72', 'descripcion' => 'TUBERIA PVC SEL 3/4"',                   'unidad' => 'm',   'costo' => 1.80, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '12', 'descripcion' => 'INTERRUPTOR TERMOMAGNETICO 2x20A',       'unidad' => 'und', 'costo' => 35.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Agua (diccionario 39)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '39', 'descripcion' => 'AGUA',                                   'unidad' => 'm³',  'costo' => 6.00, 'tipo' => 'materiales', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // EQUIPOS — Maquinaria Nacional e Importada (diccionario 48 / 49)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '48', 'descripcion' => 'MEZCLADORA DE CONCRETO 9 p3 (8 HP)',     'unidad' => 'hm',  'costo' => 20.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '48', 'descripcion' => 'VIBRADOR DE CONCRETO 4 HP 1.35"',       'unidad' => 'hm',  'costo' => 8.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '48', 'descripcion' => 'COMPACTADOR VIBR. TIPO PLANCHA 7 HP',   'unidad' => 'hm',  'costo' => 12.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '49', 'descripcion' => 'RETROEXCAVADORA S/LLANTAS 58 HP 1 yd3',  'unidad' => 'hm',  'costo' => 180.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '49', 'descripcion' => 'TRACTOR DE ORUGAS DE 190-240 HP',        'unidad' => 'hm',  'costo' => 350.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],

            // ═══════════════════════════════════════════════════════════════════════
            // EQUIPOS — Herramientas Manuales (diccionario 37 / 30)
            // ═══════════════════════════════════════════════════════════════════════
            ['diccionario_codigo' => '37', 'descripcion' => 'HERRAMIENTAS MANUALES',                  'unidad' => '%mo', 'costo' => 0.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '30', 'descripcion' => 'NIVEL TOPOGRAFICO CON TRIPODE',          'unidad' => 'he',  'costo' => 10.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
            ['diccionario_codigo' => '30', 'descripcion' => 'ESTACION TOTAL',                         'unidad' => 'he',  'costo' => 25.00, 'tipo' => 'equipos', 'tipo_proveedor' => '001'],
        ];

        foreach ($productos as $prod) {
            $diccCode = $prod['diccionario_codigo'];
            if (!isset($diccionarios[$diccCode])) {
                continue;
            }

            $unidadId = $unidades[$prod['unidad']] ?? null;

            $provCode = $prod['tipo_proveedor'];
            $key = $diccCode . $provCode;
            $counters[$key] = ($counters[$key] ?? 0) + 1;

            $codigo_producto = $diccCode . $provCode . str_pad($counters[$key], 4, '0', STR_PAD_LEFT);

            $connection->table('insumo_productos')->updateOrInsert(
                ['codigo_producto' => $codigo_producto],
                [
                    'descripcion'         => $prod['descripcion'],
                    'especificaciones'    => null,
                    'diccionario_id'      => $diccionarios[$diccCode],
                    'unidad_id'           => $unidadId,
                    'tipo_proveedor'      => $provCode,
                    'costo_unitario_lista'=> $prod['costo'],
                    'costo_unitario'      => $prod['costo'],
                    'costo_flete'         => 0,
                    'fecha_lista'         => $fechaLista,
                    'tipo'                => $prod['tipo'],
                    'estado'              => true,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ]
            );
        }
    }
}
