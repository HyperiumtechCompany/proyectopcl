<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // ─────────────────────────────────────────────
        // PERMISOS
        // ─────────────────────────────────────────────
        $permissions = [
            // Usuarios
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',

            // Roles
            'roles.view',
            'roles.create',
            'roles.edit',
            'roles.delete',

            // Personal
            'personal.view',
            'personal.create',
            'personal.edit',
            'personal.delete',

            // Hojas de cálculo
            'spreadsheets.view',
            'spreadsheets.create',
            'spreadsheets.edit',
            'spreadsheets.delete',

            // Planes
            'plans.view',
            'plans.manage',

            // Sistema
            'system.settings',
            'system.reports',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // ─────────────────────────────────────────────
        // ROLES Y ASIGNACIÓN DE PERMISOS
        // ─────────────────────────────────────────────

        // ROOT: acceso total
        $root = Role::firstOrCreate(['name' => 'root', 'guard_name' => 'web']);
        $root->syncPermissions(Permission::all());

        // GERENCIA: acceso total
        $gerencia = Role::firstOrCreate(['name' => 'gerencia', 'guard_name' => 'web']);
        $gerencia->syncPermissions(Permission::all());

        // ADMINISTRACION: administra sistema y planes, CRUD de personal
        $admin = Role::firstOrCreate(['name' => 'administracion', 'guard_name' => 'web']);
        $admin->syncPermissions([
            'users.view',
            'users.create',
            'users.edit',
            'roles.view',
            'personal.view',
            'personal.create',
            'personal.edit',
            'personal.delete',
            'plans.view',
            'plans.manage',
            'system.settings',
            'system.reports',
            'spreadsheets.view',
        ]);

        // ASISTENTES: CRUD de hojas de cálculo propias
        $asistentes = Role::firstOrCreate(['name' => 'asistentes', 'guard_name' => 'web']);
        $asistentes->syncPermissions([
            'spreadsheets.view',
            'spreadsheets.create',
            'spreadsheets.edit',
            'spreadsheets.delete',
            'personal.view',
        ]);

        // CLIENTES: solo visualización de hojas compartidas
        $clientes = Role::firstOrCreate(['name' => 'clientes', 'guard_name' => 'web']);
        $clientes->syncPermissions([
            'spreadsheets.view',
        ]);

        $this->command->info('✅ Roles y permisos creados correctamente.');
    }
}
