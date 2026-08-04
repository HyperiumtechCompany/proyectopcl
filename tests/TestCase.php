<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();

        // La caché de configuración puede contener la conexión MySQL de
        // desarrollo e ignorar phpunit.xml. Forzamos el aislamiento antes de
        // que RefreshDatabase ejecute una sola operación sobre la conexión.
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');

        $connection = $app['config']->get('database.default');
        $database = $app['config']->get("database.connections.{$connection}.database");

        if ($connection !== 'sqlite' || $database !== ':memory:') {
            throw new RuntimeException(
                'Pruebas bloqueadas: la conexión debe ser sqlite con DB_DATABASE=:memory:. '.
                "Conexión detectada: {$connection}; base: {$database}. Ejecuta php artisan config:clear.",
            );
        }

        return $app;
    }
}
