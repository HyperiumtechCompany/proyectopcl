<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::where('email', 'root@pcl.com')->first();

        $organization = Organization::updateOrCreate(
            ['nombre' => 'PCL'],
            [
                'plan' => 'empresarial',
                'owner_id' => $owner?->id,
            ]
        );

        $this->command->info("✅ Organización '{$organization->nombre}' (plan {$organization->plan}) creada correctamente.");
    }
}
