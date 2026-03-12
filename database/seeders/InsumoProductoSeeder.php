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
        // Primero ejecutar clases si no existen
        $this->call(InsumoClaseSeeder::class);

        $now = now();
        $fechaLista = '2026-01-01';
        $connection = DB::connection('costos_tenant');

        // Obtener IDs de las clases
        $clases = $connection->table('insumo_clases')
            ->pluck('id', 'codigo')
            ->toArray();

        $productos = [
            // ═══════════════════════════════════════════════════════════════════════
            // MANO DE OBRA (clase 47)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0147000001', 'descripcion' => 'CAPATAZ',                                'unidad' => 'hh',  'costo' => 27.54, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000002', 'descripcion' => 'OPERARIO',                               'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000003', 'descripcion' => 'OFICIAL',                                'unidad' => 'hh',  'costo' => 18.26, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000004', 'descripcion' => 'PEON',                                   'unidad' => 'hh',  'costo' => 16.60, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000005', 'descripcion' => 'OPERADOR DE EQUIPO LIVIANO',             'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000006', 'descripcion' => 'OPERADOR DE EQUIPO PESADO',              'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000007', 'descripcion' => 'TOPOGRAFO',                              'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000008', 'descripcion' => 'ELECTRICISTA',                           'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000009', 'descripcion' => 'GASFITERO',                              'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],
            ['codigo_producto' => '0147000010', 'descripcion' => 'SOLDADOR',                               'unidad' => 'hh',  'costo' => 23.46, 'clase' => '47', 'tipo' => 'mano_de_obra'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Cementos y Concretos (clase 02)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0202000001', 'descripcion' => 'CEMENTO PORTLAND TIPO I (42.5 kg)',       'unidad' => 'bls', 'costo' => 28.50, 'clase' => '02', 'tipo' => 'materiales'],
            ['codigo_producto' => '0202000002', 'descripcion' => 'CEMENTO PORTLAND TIPO V',                'unidad' => 'bls', 'costo' => 32.00, 'clase' => '02', 'tipo' => 'materiales'],
            ['codigo_producto' => '0202000003', 'descripcion' => 'CEMENTO PORTLAND TIPO IP',               'unidad' => 'bls', 'costo' => 26.00, 'clase' => '02', 'tipo' => 'materiales'],
            ['codigo_producto' => '0202000004', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=175 kg/cm2',   'unidad' => 'm3',  'costo' => 320.00, 'clase' => '02', 'tipo' => 'materiales'],
            ['codigo_producto' => '0202000005', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=210 kg/cm2',   'unidad' => 'm3',  'costo' => 350.00, 'clase' => '02', 'tipo' => 'materiales'],
            ['codigo_producto' => '0202000006', 'descripcion' => 'CONCRETO PREMEZCLADO f\'c=280 kg/cm2',   'unidad' => 'm3',  'costo' => 400.00, 'clase' => '02', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Agregados (clase 03)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0303000001', 'descripcion' => 'ARENA FINA',                             'unidad' => 'm3',  'costo' => 40.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000002', 'descripcion' => 'ARENA GRUESA',                           'unidad' => 'm3',  'costo' => 50.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000003', 'descripcion' => 'PIEDRA CHANCADA 1/2"',                   'unidad' => 'm3',  'costo' => 65.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000004', 'descripcion' => 'PIEDRA CHANCADA 3/4"',                   'unidad' => 'm3',  'costo' => 60.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000005', 'descripcion' => 'PIEDRA MEDIANA DE 6"',                   'unidad' => 'm3',  'costo' => 55.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000006', 'descripcion' => 'PIEDRA GRANDE DE 8"',                    'unidad' => 'm3',  'costo' => 50.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000007', 'descripcion' => 'HORMIGON',                               'unidad' => 'm3',  'costo' => 35.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000008', 'descripcion' => 'AFIRMADO',                               'unidad' => 'm3',  'costo' => 30.00, 'clase' => '03', 'tipo' => 'materiales'],
            ['codigo_producto' => '0303000009', 'descripcion' => 'MATERIAL PARA RELLENO',                  'unidad' => 'm3',  'costo' => 15.00, 'clase' => '03', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Fierro y Acero (clase 04)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0404000001', 'descripcion' => 'ACERO CORRUGADO fy=4200 kg/cm2 GRADO 60','unidad' => 'kg',  'costo' => 4.50, 'clase' => '04', 'tipo' => 'materiales'],
            ['codigo_producto' => '0404000002', 'descripcion' => 'ALAMBRE NEGRO RECOCIDO N° 8',            'unidad' => 'kg',  'costo' => 5.00, 'clase' => '04', 'tipo' => 'materiales'],
            ['codigo_producto' => '0404000003', 'descripcion' => 'ALAMBRE NEGRO RECOCIDO N° 16',           'unidad' => 'kg',  'costo' => 5.00, 'clase' => '04', 'tipo' => 'materiales'],
            ['codigo_producto' => '0404000004', 'descripcion' => 'CLAVOS PARA MADERA CON CABEZA DE 3"',    'unidad' => 'kg',  'costo' => 5.50, 'clase' => '04', 'tipo' => 'materiales'],
            ['codigo_producto' => '0404000005', 'descripcion' => 'CLAVOS PARA MADERA CON CABEZA DE 4"',    'unidad' => 'kg',  'costo' => 5.50, 'clase' => '04', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Madera (clase 05)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0505000001', 'descripcion' => 'MADERA TORNILLO',                        'unidad' => 'p2',  'costo' => 6.50, 'clase' => '05', 'tipo' => 'materiales'],
            ['codigo_producto' => '0505000002', 'descripcion' => 'MADERA EUCALIPTO (ROLLIZO)',              'unidad' => 'p2',  'costo' => 4.00, 'clase' => '05', 'tipo' => 'materiales'],
            ['codigo_producto' => '0505000003', 'descripcion' => 'TRIPLAY DE 4\' x 8\' x 4 mm',           'unidad' => 'pln', 'costo' => 28.00, 'clase' => '05', 'tipo' => 'materiales'],
            ['codigo_producto' => '0505000004', 'descripcion' => 'TRIPLAY DE 4\' x 8\' x 6 mm',           'unidad' => 'pln', 'costo' => 42.00, 'clase' => '05', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Ladrillos y Bloques (clase 06)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0606000001', 'descripcion' => 'LADRILLO KING KONG 18 HUECOS',           'unidad' => 'und', 'costo' => 0.85, 'clase' => '06', 'tipo' => 'materiales'],
            ['codigo_producto' => '0606000002', 'descripcion' => 'LADRILLO PANDERETA',                     'unidad' => 'und', 'costo' => 0.60, 'clase' => '06', 'tipo' => 'materiales'],
            ['codigo_producto' => '0606000003', 'descripcion' => 'BLOQUE DE CONCRETO 15x20x40',            'unidad' => 'und', 'costo' => 3.50, 'clase' => '06', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Tuberías (clase 07)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0707000001', 'descripcion' => 'TUBERIA PVC SAL 2"',                     'unidad' => 'm',   'costo' => 5.50, 'clase' => '07', 'tipo' => 'materiales'],
            ['codigo_producto' => '0707000002', 'descripcion' => 'TUBERIA PVC SAL 4"',                     'unidad' => 'm',   'costo' => 10.00, 'clase' => '07', 'tipo' => 'materiales'],
            ['codigo_producto' => '0707000003', 'descripcion' => 'TUBERIA PVC SAP C-10 1/2"',              'unidad' => 'm',   'costo' => 3.50, 'clase' => '07', 'tipo' => 'materiales'],
            ['codigo_producto' => '0707000004', 'descripcion' => 'TUBERIA PVC SAP C-10 3/4"',              'unidad' => 'm',   'costo' => 5.00, 'clase' => '07', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Eléctrico (clase 08)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0808000001', 'descripcion' => 'CABLE THW 14 AWG',                       'unidad' => 'm',   'costo' => 2.50, 'clase' => '08', 'tipo' => 'materiales'],
            ['codigo_producto' => '0808000002', 'descripcion' => 'CABLE THW 12 AWG',                       'unidad' => 'm',   'costo' => 3.50, 'clase' => '08', 'tipo' => 'materiales'],
            ['codigo_producto' => '0808000003', 'descripcion' => 'TUBERIA PVC SEL 3/4"',                   'unidad' => 'm',   'costo' => 1.80, 'clase' => '08', 'tipo' => 'materiales'],
            ['codigo_producto' => '0808000004', 'descripcion' => 'INTERRUPTOR TERMOMAGNETICO 2x20A',       'unidad' => 'und', 'costo' => 35.00, 'clase' => '08', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Pinturas (clase 09)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0909000001', 'descripcion' => 'PINTURA LATEX LAVABLE',                  'unidad' => 'gal', 'costo' => 38.00, 'clase' => '09', 'tipo' => 'materiales'],
            ['codigo_producto' => '0909000002', 'descripcion' => 'PINTURA ESMALTE',                        'unidad' => 'gal', 'costo' => 50.00, 'clase' => '09', 'tipo' => 'materiales'],
            ['codigo_producto' => '0909000003', 'descripcion' => 'IMPRIMANTE',                             'unidad' => 'gal', 'costo' => 18.00, 'clase' => '09', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Agua (clase 14)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '1414000001', 'descripcion' => 'AGUA',                                   'unidad' => 'm3',  'costo' => 6.00, 'clase' => '14', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // MATERIALES — Clavos, Pernos y Alambre (clase 15)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '1515000001', 'descripcion' => 'PERNOS HEXAGONALES DE 3/8" x 3"',        'unidad' => 'und', 'costo' => 1.50, 'clase' => '15', 'tipo' => 'materiales'],

            // ═══════════════════════════════════════════════════════════════════════
            // EQUIPOS — Maquinaria Nacional (clase 48)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0348000001', 'descripcion' => 'MEZCLADORA DE CONCRETO 9 p3 (8 HP)',     'unidad' => 'hm',  'costo' => 20.00, 'clase' => '48', 'tipo' => 'equipos'],
            ['codigo_producto' => '0348000002', 'descripcion' => 'VIBRADOR DE CONCRETO 4 HP 1.35"',       'unidad' => 'hm',  'costo' => 8.00, 'clase' => '48', 'tipo' => 'equipos'],
            ['codigo_producto' => '0348000003', 'descripcion' => 'COMPACTADOR VIBR. TIPO PLANCHA 7 HP',   'unidad' => 'hm',  'costo' => 12.00, 'clase' => '48', 'tipo' => 'equipos'],
            ['codigo_producto' => '0348000004', 'descripcion' => 'WINCHE ELECTRICO 3.6 HP DE 2 BALDES',   'unidad' => 'hm',  'costo' => 15.00, 'clase' => '48', 'tipo' => 'equipos'],
            ['codigo_producto' => '0348000005', 'descripcion' => 'MOTOBOMBA 4" (12 HP)',                   'unidad' => 'hm',  'costo' => 10.00, 'clase' => '48', 'tipo' => 'equipos'],

            // ═══════════════════════════════════════════════════════════════════════
            // EQUIPOS — Maquinaria Importada (clase 49)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0349000001', 'descripcion' => 'RETROEXCAVADORA S/LLANTAS 58 HP 1 yd3',  'unidad' => 'hm',  'costo' => 180.00, 'clase' => '49', 'tipo' => 'equipos'],
            ['codigo_producto' => '0349000002', 'descripcion' => 'CARGADOR S/LLANTAS 125-155 HP 3 yd3',    'unidad' => 'hm',  'costo' => 200.00, 'clase' => '49', 'tipo' => 'equipos'],
            ['codigo_producto' => '0349000003', 'descripcion' => 'CAMION VOLQUETE DE 15 m3',               'unidad' => 'hm',  'costo' => 160.00, 'clase' => '49', 'tipo' => 'equipos'],
            ['codigo_producto' => '0349000004', 'descripcion' => 'RODILLO LISO VIBRATORIO AUTOPROP. 101-135HP 10-12T', 'unidad' => 'hm', 'costo' => 170.00, 'clase' => '49', 'tipo' => 'equipos'],
            ['codigo_producto' => '0349000005', 'descripcion' => 'TRACTOR DE ORUGAS DE 190-240 HP',        'unidad' => 'hm',  'costo' => 350.00, 'clase' => '49', 'tipo' => 'equipos'],
            ['codigo_producto' => '0349000006', 'descripcion' => 'CAMION CISTERNA (2500 GLNS)',             'unidad' => 'hm',  'costo' => 140.00, 'clase' => '49', 'tipo' => 'equipos'],

            // ═══════════════════════════════════════════════════════════════════════
            // EQUIPOS — Herramientas Manuales (clase 50)
            // ═══════════════════════════════════════════════════════════════════════
            ['codigo_producto' => '0350000001', 'descripcion' => 'HERRAMIENTAS MANUALES',                  'unidad' => '%mo', 'costo' => 0.00, 'clase' => '50', 'tipo' => 'equipos'],
            ['codigo_producto' => '0350000002', 'descripcion' => 'NIVEL TOPOGRAFICO CON TRIPODE',          'unidad' => 'he',  'costo' => 10.00, 'clase' => '50', 'tipo' => 'equipos'],
            ['codigo_producto' => '0350000003', 'descripcion' => 'ESTACION TOTAL',                         'unidad' => 'he',  'costo' => 25.00, 'clase' => '50', 'tipo' => 'equipos'],
        ];

        foreach ($productos as $prod) {
            $claseId = $clases[$prod['clase']] ?? null;

            if (!$claseId) {
                continue;
            }

            $connection->table('insumo_productos')->updateOrInsert(
                ['codigo_producto' => $prod['codigo_producto']],
                [
                    'descripcion'         => $prod['descripcion'],
                    'especificaciones'    => null,
                    'unidad'              => $prod['unidad'],
                    'costo_unitario_lista' => $prod['costo'],
                    'costo_unitario'      => $prod['costo'],
                    'costo_flete'         => 0,
                    'fecha_lista'         => $fechaLista,
                    'insumo_clase_id'     => $claseId,
                    'tipo'                => $prod['tipo'],
                    'estado'              => true,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ]
            );
        }
    }
}
