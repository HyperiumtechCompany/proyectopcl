<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InsumoClaseSeeder extends Seeder
{
    /**
     * Seed clases de insumos (estilo S10/Delfin).
     * Usa conexión costos_tenant — debe ejecutarse después de setTenantConnection().
     */
    public function run(): void
    {
        $now = now();
        $connection = DB::connection('costos_tenant');

        $clases = [
            // Mano de Obra
            ['codigo' => '47', 'descripcion' => 'Mano de Obra'],

            // Materiales
            ['codigo' => '02', 'descripcion' => 'Cementos y Concretos'],
            ['codigo' => '03', 'descripcion' => 'Agregados'],
            ['codigo' => '04', 'descripcion' => 'Fierro y Acero'],
            ['codigo' => '05', 'descripcion' => 'Madera'],
            ['codigo' => '06', 'descripcion' => 'Ladrillos y Bloques'],
            ['codigo' => '07', 'descripcion' => 'Tuberías y Accesorios'],
            ['codigo' => '08', 'descripcion' => 'Material Eléctrico'],
            ['codigo' => '09', 'descripcion' => 'Pinturas'],
            ['codigo' => '10', 'descripcion' => 'Sanitarios y Grifería'],
            ['codigo' => '11', 'descripcion' => 'Impermeabilizantes y Aditivos'],
            ['codigo' => '12', 'descripcion' => 'Vidrios y Cerámicos'],
            ['codigo' => '13', 'descripcion' => 'Aparatos y Accesorios Varios'],
            ['codigo' => '14', 'descripcion' => 'Agua'],
            ['codigo' => '15', 'descripcion' => 'Clavos, Pernos y Alambre'],

            // Equipos
            ['codigo' => '48', 'descripcion' => 'Maquinaria y Equipo Nacional'],
            ['codigo' => '49', 'descripcion' => 'Maquinaria y Equipo Importado'],
            ['codigo' => '50', 'descripcion' => 'Herramientas Manuales'],
        ];

        foreach ($clases as $clase) {
            $connection->table('insumo_clases')->updateOrInsert(
                ['codigo' => $clase['codigo']],
                array_merge($clase, [
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }
}
