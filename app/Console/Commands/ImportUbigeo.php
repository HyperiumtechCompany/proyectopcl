<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ImportUbigeo extends Command
{
    protected $signature = 'ubigeo:import';
    protected $description = 'Download and generate ubigeo.json for Peru';

    public function handle(): int
    {
        $url = 'https://raw.githubusercontent.com/ernestorivero/Ubigeo-Peru/master/Json/ubigeo_peru_2016_departamentos_provincias_distritos.json';
        $this->info('Downloading ubigeo data...');

        $json = @file_get_contents($url);
        if (!$json) {
            $this->error('Could not download. Create database/data/ubigeo.json manually.');
            return 1;
        }

        $raw = json_decode($json, true);
        $result = [];

        foreach ($raw as $code => $item) {
            if (substr($code, 2) === '0000') {
                $depId = substr($code, 0, 2);
                $dep = ['id' => $depId, 'nombre' => $item['nombre_ubigeo'], 'provincias' => []];

                foreach ($raw as $pc => $pi) {
                    if (substr($pc, 0, 2) === $depId && substr($pc, 2, 2) !== '00' && substr($pc, 4, 2) === '00') {
                        $provId = substr($pc, 0, 4);
                        $prov = ['id' => $provId, 'nombre' => $pi['nombre_ubigeo'], 'distritos' => []];

                        foreach ($raw as $dc => $di) {
                            if (substr($dc, 0, 4) === $provId && substr($dc, 4, 2) !== '00') {
                                $prov['distritos'][] = ['id' => $dc, 'nombre' => $di['nombre_ubigeo']];
                            }
                        }
                        $dep['provincias'][] = $prov;
                    }
                }
                $result[] = $dep;
            }
        }

        $dir = database_path('data');
        File::ensureDirectoryExists($dir);
        File::put($dir . '/ubigeo.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $this->info('Saved to database/data/ubigeo.json (' . count($result) . ' departamentos)');
        return 0;
    }
}
