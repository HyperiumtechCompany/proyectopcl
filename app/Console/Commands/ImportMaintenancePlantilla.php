<?php

namespace App\Console\Commands;

use App\Models\Mantenimiento\MaintenancePlantilla;
use App\Models\User;
use Illuminate\Console\Command;

// Contraparte de mantenimiento:plantilla-export: lee el JSON portátil y crea la fila en
// mantenimiento_plantillas (conexión DEFAULT de ESTE entorno), para el usuario indicado. Pensado
// para correr en el servidor de producción con el archivo que generó plantilla-export en local.
class ImportMaintenancePlantilla extends Command
{
    protected $signature = 'mantenimiento:plantilla-import
        {file : Ruta al archivo JSON generado por mantenimiento:plantilla-export}
        {--user= : Email o ID del usuario dueño de la plantilla en ESTE entorno}';

    protected $description = 'Importa una plantilla de Mantenimiento (JSON de mantenimiento:plantilla-export) para un usuario de este entorno';

    public function handle(): int
    {
        $path = $this->argument('file');
        if (! is_file($path)) {
            $this->error("No existe el archivo: {$path}");

            return self::FAILURE;
        }

        $payload = json_decode((string) file_get_contents($path), true);
        if (! is_array($payload) || ! isset($payload['nombre'], $payload['estructura'])) {
            $this->error('El archivo no tiene el formato esperado (nombre/descripcion/estructura).');

            return self::FAILURE;
        }

        $userInput = $this->option('user') ?: $this->ask('Email o ID del usuario dueño de la plantilla en este entorno');
        $user = is_numeric($userInput)
            ? User::find($userInput)
            : User::query()->where('email', $userInput)->first();

        if (! $user) {
            $this->error("No se encontró un usuario con \"{$userInput}\" en este entorno.");

            return self::FAILURE;
        }

        $plantilla = MaintenancePlantilla::create([
            'user_id' => $user->id,
            'nombre' => $payload['nombre'],
            'descripcion' => $payload['descripcion'] ?? null,
            'estructura' => $payload['estructura'],
        ]);

        $this->info("Plantilla \"{$plantilla->nombre}\" creada (id={$plantilla->id}) para {$user->email}.");
        $this->info('Nodos: '.count($payload['estructura']));

        return self::SUCCESS;
    }
}
