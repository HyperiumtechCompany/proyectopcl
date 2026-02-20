<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $users = [
            [
                'name'     => 'Root Admin',
                'email'    => 'root@pcl.com',
                'password' => Hash::make('root123'),
                'phone'    => '+51 999 000 001',
                'position' => 'Superadministrador',
                'plan'     => 'lifetime',
                'plan_expires_at' => null,
                'status'   => 'active',
                'role'     => 'root',
            ],
            [
                'name'     => 'Gerencia General',
                'email'    => 'gerencia@pcl.com',
                'password' => Hash::make('gerencia123'),
                'phone'    => '+51 999 000 002',
                'position' => 'Gerente General',
                'plan'     => 'lifetime',
                'plan_expires_at' => null,
                'status'   => 'active',
                'role'     => 'gerencia',
            ],
            [
                'name'     => 'Administrador',
                'email'    => 'admin@pcl.com',
                'password' => Hash::make('admin123'),
                'phone'    => '+51 999 000 003',
                'position' => 'Administrador del Sistema',
                'plan'     => 'lifetime',
                'plan_expires_at' => null,
                'status'   => 'active',
                'role'     => 'administracion',
            ],
            [
                'name'     => 'Asistente PCL',
                'email'    => 'asistente@pcl.com',
                'password' => Hash::make('asistente123'),
                'phone'    => '+51 999 000 004',
                'position' => 'Asistente Técnico',
                'plan'     => 'lifetime',
                'plan_expires_at' => null,
                'status'   => 'active',
                'role'     => 'asistentes',
            ],
            [
                'name'     => 'Cliente Demo',
                'email'    => 'cliente@pcl.com',
                'password' => Hash::make('cliente123'),
                'phone'    => '+51 999 000 005',
                'position' => 'Cliente',
                'plan'     => 'free',
                'plan_expires_at' => now()->addDays(5),
                'status'   => 'active',
                'role'     => 'clientes',
            ],
        ];

        foreach ($users as $userData) {
            $role = $userData['role'];
            unset($userData['role']);

            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );

            $user->syncRoles([$role]);

            $this->command->info("✅ Usuario '{$user->name}' creado con rol '{$role}'");
        }
    }
}
