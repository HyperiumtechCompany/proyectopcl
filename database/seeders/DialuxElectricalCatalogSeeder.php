<?php

namespace Database\Seeders;

use App\Models\Dialux\DialuxCircuitDefault;
use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use Illuminate\Database\Seeder;

class DialuxElectricalCatalogSeeder extends Seeder
{
    /**
     * Siembra los catálogos eléctricos por defecto del sistema (user_id null).
     * Idempotente: usa updateOrCreate sobre las claves únicas.
     */
    public function run(): void
    {
        $this->seedOutletRules();
        $this->seedOutletTypes();
        $this->seedConductors();
        $this->seedCircuitDefaults();

        $this->command?->info('Catálogos eléctricos DIALux sembrados.');
    }

    private function seedOutletRules(): void
    {
        $rules = [
            ['room_type' => 'aula', 'method' => 'area', 'value' => 10, 'unit' => 'm2_per_point', 'notes' => 'Un tomacorriente por cada 10 m².'],
            ['room_type' => 'comedor', 'method' => 'area', 'value' => 15, 'unit' => 'm2_per_point', 'notes' => 'Un tomacorriente por cada 15 m².'],
            ['room_type' => 'oficina', 'method' => 'area', 'value' => 10, 'unit' => 'm2_per_point', 'notes' => null],
            ['room_type' => 'pasadizo', 'method' => 'fixed', 'value' => 1, 'unit' => 'points', 'notes' => 'Punto de servicio para limpieza.'],
            ['room_type' => 'sala_reuniones', 'method' => 'area', 'value' => 10, 'unit' => 'm2_per_point', 'notes' => null],
            ['room_type' => 'laboratorio', 'method' => 'area', 'value' => 8, 'unit' => 'm2_per_point', 'notes' => 'Mayor densidad por equipos.'],
            ['room_type' => 'servicios_higienicos', 'method' => 'fixed', 'value' => 1, 'unit' => 'points', 'notes' => 'Tomacorriente con protección diferencial.'],
            ['room_type' => 'almacen', 'method' => 'fixed', 'value' => 2, 'unit' => 'points', 'notes' => null],
            ['room_type' => 'exterior', 'method' => 'perimeter', 'value' => 9, 'unit' => 'm_per_point', 'notes' => 'Separación máxima de 9 m sobre el perímetro útil.'],
            ['room_type' => 'patio', 'method' => 'perimeter', 'value' => 9, 'unit' => 'm_per_point', 'notes' => null],
            ['room_type' => 'auditorio', 'method' => 'area', 'value' => 20, 'unit' => 'm2_per_point', 'notes' => null],
            ['room_type' => 'personalizado', 'method' => 'area', 'value' => 10, 'unit' => 'm2_per_point', 'notes' => 'Regla editable para ambientes personalizados.'],
        ];

        foreach ($rules as $rule) {
            DialuxOutletRule::query()->updateOrCreate(
                ['user_id' => null, 'room_type' => $rule['room_type']],
                array_merge($rule, ['power_per_outlet_va' => 180]),
            );
        }
    }

    private function seedOutletTypes(): void
    {
        $types = [
            ['code' => 'bajo', 'name' => 'Tomacorriente bajo', 'height_m' => 0.40, 'height_label' => '0.40 m', 'use_description' => 'Uso general'],
            ['code' => 'inicial', 'name' => 'Tomacorriente para nivel inicial', 'height_m' => 1.50, 'height_label' => '1.50 m', 'use_description' => 'Mayor seguridad y control'],
            ['code' => 'alto', 'name' => 'Tomacorriente de pared alto', 'height_m' => 1.20, 'height_label' => '1.20 m', 'use_description' => 'Equipos y accesorios'],
            ['code' => 'alto_180', 'name' => 'Tomacorriente de pared alto 1.80 m', 'height_m' => 1.80, 'height_label' => '1.80 m', 'use_description' => 'Equipos y accesorios elevados'],
            ['code' => 'comunicaciones', 'name' => 'Tomacorriente de comunicaciones', 'height_m' => 2.00, 'height_label' => '2.00 m', 'use_description' => 'Cajas o equipos de comunicaciones'],
            ['code' => 'techo', 'name' => 'Tomacorriente de techo', 'height_m' => null, 'height_label' => 'Según proyecto', 'use_description' => 'Proyectores y equipos suspendidos'],
            ['code' => 'piso', 'name' => 'Tomacorriente de piso', 'height_m' => 0.00, 'height_label' => 'Nivel de piso', 'use_description' => 'Mesas, módulos o equipos centrales'],
            ['code' => 'exterior', 'name' => 'Tomacorriente exterior', 'height_m' => null, 'height_label' => 'Según proyecto', 'use_description' => 'Equipos exteriores', 'ip_rating' => 'IP65'],
            ['code' => 'especial', 'name' => 'Tomacorriente especial', 'height_m' => null, 'height_label' => 'Configurable', 'use_description' => 'Equipos específicos'],
        ];

        foreach ($types as $type) {
            DialuxOutletType::query()->updateOrCreate(
                ['user_id' => null, 'code' => $type['code']],
                $type,
            );
        }
    }

    private function seedConductors(): void
    {
        // Ampacidades referenciales para cobre THW-90 (CNE Utilización, editable).
        $conductors = [
            ['section_mm2' => 2.5, 'awg_ref' => '14', 'ampacity_a' => 20, 'price_per_meter' => 1.20],
            ['section_mm2' => 4, 'awg_ref' => '12', 'ampacity_a' => 25, 'price_per_meter' => 1.80],
            ['section_mm2' => 6, 'awg_ref' => '10', 'ampacity_a' => 35, 'price_per_meter' => 2.70],
            ['section_mm2' => 10, 'awg_ref' => '8', 'ampacity_a' => 50, 'price_per_meter' => 4.50],
            ['section_mm2' => 16, 'awg_ref' => '6', 'ampacity_a' => 65, 'price_per_meter' => 7.20],
            ['section_mm2' => 25, 'awg_ref' => '4', 'ampacity_a' => 85, 'price_per_meter' => 11.50],
            ['section_mm2' => 35, 'awg_ref' => '2', 'ampacity_a' => 100, 'price_per_meter' => 16.00],
            ['section_mm2' => 50, 'awg_ref' => '1', 'ampacity_a' => 125, 'price_per_meter' => 22.50],
            ['section_mm2' => 70, 'awg_ref' => '2/0', 'ampacity_a' => 160, 'price_per_meter' => 31.00],
            ['section_mm2' => 95, 'awg_ref' => '3/0', 'ampacity_a' => 190, 'price_per_meter' => 42.00],
            ['section_mm2' => 120, 'awg_ref' => '4/0', 'ampacity_a' => 220, 'price_per_meter' => 53.00],
        ];

        foreach ($conductors as $conductor) {
            DialuxConductor::query()->updateOrCreate(
                [
                    'user_id' => null,
                    'material' => 'cobre',
                    'section_mm2' => $conductor['section_mm2'],
                    'insulation' => 'THW-90',
                ],
                $conductor,
            );
        }
    }

    /**
     * Valores por defecto por tipo de circuito Y por tipo de instalación
     * (residencial/casas, educativa/colegios, industrial/zona industrial).
     * Son puntos de partida editables en Catálogos, no una norma cerrada:
     * la instalación educativa asume menor simultaneidad de aulas (F.D. más
     * bajo) y recorridos más largos entre pabellones (sección de alimentador
     * mayor); la industrial asume cargas trifásicas mayores y admite algo más
     * de caída de tensión (criterio habitual en instalaciones de fuerza).
     */
    private function seedCircuitDefaults(): void
    {
        $defaults = [
            // Residencial (casas).
            ['circuit_type' => 'lighting', 'installation_category' => 'residencial', 'min_section_mm2' => 2.5, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 1.00, 'breaker_poles' => 2],
            ['circuit_type' => 'outlets', 'installation_category' => 'residencial', 'min_section_mm2' => 4, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 1.00, 'breaker_poles' => 2],
            ['circuit_type' => 'feeder', 'installation_category' => 'residencial', 'min_section_mm2' => 6, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 0.80, 'breaker_poles' => 2],
            ['circuit_type' => 'special', 'installation_category' => 'residencial', 'min_section_mm2' => 4, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 1.00, 'breaker_poles' => 2],

            // Educativa (colegios).
            ['circuit_type' => 'lighting', 'installation_category' => 'educativa', 'min_section_mm2' => 2.5, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 0.90, 'breaker_poles' => 2],
            ['circuit_type' => 'outlets', 'installation_category' => 'educativa', 'min_section_mm2' => 4, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 0.80, 'breaker_poles' => 2],
            ['circuit_type' => 'feeder', 'installation_category' => 'educativa', 'min_section_mm2' => 10, 'max_voltage_drop_pct' => 2.0, 'demand_factor' => 0.70, 'breaker_poles' => 2],
            ['circuit_type' => 'special', 'installation_category' => 'educativa', 'min_section_mm2' => 6, 'max_voltage_drop_pct' => 2.5, 'demand_factor' => 1.00, 'breaker_poles' => 2],

            // Industrial (zona industrial).
            ['circuit_type' => 'lighting', 'installation_category' => 'industrial', 'min_section_mm2' => 2.5, 'max_voltage_drop_pct' => 3.0, 'demand_factor' => 1.00, 'breaker_poles' => 2],
            ['circuit_type' => 'outlets', 'installation_category' => 'industrial', 'min_section_mm2' => 6, 'max_voltage_drop_pct' => 3.0, 'demand_factor' => 1.00, 'breaker_poles' => 2],
            ['circuit_type' => 'feeder', 'installation_category' => 'industrial', 'min_section_mm2' => 16, 'max_voltage_drop_pct' => 3.0, 'demand_factor' => 0.85, 'breaker_poles' => 3],
            ['circuit_type' => 'special', 'installation_category' => 'industrial', 'min_section_mm2' => 10, 'max_voltage_drop_pct' => 3.0, 'demand_factor' => 1.00, 'breaker_poles' => 3],
        ];

        foreach ($defaults as $default) {
            DialuxCircuitDefault::query()->updateOrCreate(
                [
                    'user_id' => null,
                    'circuit_type' => $default['circuit_type'],
                    'installation_category' => $default['installation_category'],
                ],
                $default,
            );
        }
    }
}
