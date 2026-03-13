<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UbigeoSeeder extends Seeder
{
    public function run(): void
    {
        $jsonPath = database_path('data/ubigeo.json');

        if (! file_exists($jsonPath)) {
            $this->command->error("Ubigeo JSON not found at {$jsonPath}. Run: php artisan ubigeo:import");
            return;
        }

        $data = json_decode(file_get_contents($jsonPath), true);

        // Departamentos
        foreach ($data as $dep) {
            DB::table('ubigeos')->updateOrInsert(
                ['id' => $dep['id']],
                [
                    'departamento' => $dep['nombre'],
                    'provincia' => null,
                    'distrito' => null,
                    'level' => 'departamento',
                    'parent_id' => null,
                ]
            );

            // Provincias
            foreach ($dep['provincias'] ?? [] as $prov) {
                DB::table('ubigeos')->updateOrInsert(
                    ['id' => $prov['id']],
                    [
                        'departamento' => $dep['nombre'],
                        'provincia' => $prov['nombre'],
                        'distrito' => null,
                        'level' => 'provincia',
                        'parent_id' => $dep['id'],
                    ]
                );

                // Distritos
                foreach ($prov['distritos'] ?? [] as $dist) {
                    DB::table('ubigeos')->updateOrInsert(
                        ['id' => $dist['id']],
                        [
                            'departamento' => $dep['nombre'],
                            'provincia' => $prov['nombre'],
                            'distrito' => $dist['nombre'],
                            'level' => 'distrito',
                            'parent_id' => $prov['id'],
                        ]
                    );
                }
            }
        }

        $count = DB::table('ubigeos')->count();
        $this->command->info("Seeded {$count} ubigeo records.");
    }
}
