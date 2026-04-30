<?php

namespace Database\Seeders;

use App\Models\LuminaireProduct;
use Illuminate\Database\Seeder;

class LuminaireProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            [
                'name' => 'Panel LED Pro 60x60',
                'manufacturer' => 'Hyperium',
                'catalog_number' => 'HY-PL-6060-40',
                'article_number' => '930122',
                'description' => 'Panel LED empotrado de alta eficiencia para oficinas y espacios comerciales. Diseño ultra delgado con marco de aluminio.',
                'source_format' => 'ies',
                'source_file_path' => 'luminaires/ies/led-panel.ies',
                'source_file_name' => 'led-panel.ies',
                'product_image_path' => 'luminaires/photos/led-panel.png',
                'brand_logo_path' => 'luminaires/logos/hyperium.png',
                'total_lumens' => 4200.0,
                'power_watts' => 40.0,
                'cct' => '4000K',
                'cri_ra' => 85.0,
                'beam_angle_50' => 110.0,
                'fixture_type' => 'panel',
                'fixture_shape' => 'square',
                'is_global' => true,
                'dimensions' => ['length' => 0.6, 'width' => 0.6, 'height' => 0.03],
                'report_data' => [
                    'technical_table' => [
                        ['label' => 'UGR', 'value' => '< 19'],
                        ['label' => 'Grado IP', 'value' => 'IP40'],
                        ['label' => 'Vida útil', 'value' => '50,000 h (L70)'],
                        ['label' => 'Driver', 'value' => 'Certificado Flicker-Free'],
                    ],
                ],
            ],
            [
                'name' => 'Campana Industrial LED 150W',
                'manufacturer' => 'LuxTech',
                'catalog_number' => 'LX-HB-150',
                'article_number' => 'HB150-IND',
                'description' => 'Luminaria tipo campana para grandes alturas en almacenes y naves industriales. Cuerpo de aluminio inyectado para mejor disipación.',
                'source_format' => 'ies',
                'source_file_path' => 'luminaires/ies/high-bay.ies',
                'source_file_name' => 'high-bay.ies',
                'product_image_path' => 'luminaires/photos/high-bay.png',
                'brand_logo_path' => 'luminaires/logos/luxtech.png',
                'total_lumens' => 18500.0,
                'power_watts' => 150.0,
                'cct' => '5000K',
                'cri_ra' => 80.0,
                'beam_angle_50' => 90.0,
                'fixture_type' => 'other',
                'fixture_shape' => 'cylindrical',
                'is_global' => true,
                'dimensions' => ['length' => 0.35, 'width' => 0.35, 'height' => 0.25],
                'report_data' => [
                    'technical_table' => [
                        ['label' => 'Resistencia Impacto', 'value' => 'IK08'],
                        ['label' => 'Grado IP', 'value' => 'IP65'],
                        ['label' => 'Temp. Operación', 'value' => '-30°C a +50°C'],
                        ['label' => 'Montaje', 'value' => 'Gancho de suspensión'],
                    ],
                ],
            ],
            [
                'name' => 'Spot Empotrado Minimalist 12W',
                'manufacturer' => 'Aura',
                'catalog_number' => 'AU-SP-12RD',
                'article_number' => 'SP12-MINI',
                'description' => 'Foco empotrado de diseño minimalista para iluminación de acento en residencias y hoteles.',
                'source_format' => 'ies',
                'source_file_path' => 'luminaires/ies/spotlight.ies',
                'source_file_name' => 'spotlight.ies',
                'product_image_path' => 'luminaires/photos/spotlight.png',
                'brand_logo_path' => 'luminaires/logos/aura.png',
                'total_lumens' => 980.0,
                'power_watts' => 12.0,
                'cct' => '3000K',
                'cri_ra' => 90.0,
                'beam_angle_50' => 36.0,
                'fixture_type' => 'spot',
                'fixture_shape' => 'round',
                'is_global' => true,
                'dimensions' => ['length' => 0.1, 'width' => 0.1, 'height' => 0.08],
                'report_data' => [
                    'technical_table' => [
                        ['label' => 'Ajustabilidad', 'value' => 'Basculante 30°'],
                        ['label' => 'Corte', 'value' => 'Ø 90mm'],
                        ['label' => 'Acabado', 'value' => 'Blanco Mate'],
                        ['label' => 'Óptica', 'value' => 'Lente de policarbonato'],
                    ],
                ],
            ],
        ];

        foreach ($products as $product) {
            LuminaireProduct::updateOrCreate(
                ['article_number' => $product['article_number']],
                $product
            );
        }
    }
}
