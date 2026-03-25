<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DiccionarioSeeder extends Seeder
{
    public function run(): void
    {
        $now        = now();
        $connection = DB::connection('costos_tenant'); // ← igual que InsumoClaseSeeder

        $data = [
            [
                'codigo'      => '48',
                'descripcion' => 'Acumulador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Acrílico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Acero para pretensado',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Acido muriático',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Acero de construcción liso',
            ],
            [
                'codigo'      => '03',
                'descripcion' => 'Acero de construcción corrugado',
            ],
            [
                'codigo'      => '01',
                'descripcion' => 'Aceite para transformadores',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Aceite linaza',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Acabadora de concreto',
            ],
            [
                'codigo'      => '01',
                'descripcion' => 'Aceite',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Abasto (Provición de elementos necesarios)',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Accesorios de continuidad de pantalla',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Abrazadera de Fierro Fundido',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Adobe',
            ],
            [
                'codigo'      => '38',
                'descripcion' => 'Afirmado',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Agregado fino',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Agregado grueso',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Agua',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Aislador carrete',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Aislador pin',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Aislamiento lana de vidrio',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Alambre acero',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Alambre cobre',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Alambre de púas',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Alambre negro',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Alambre para devanado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Alambre pretensor',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Alambre y cable de cobre desnudo',
            ],
            [
                'codigo'      => '07',
                'descripcion' => 'Alambre y cable tipo TW y THW',
            ],
            [
                'codigo'      => '08',
                'descripcion' => 'Alambre y cable tipo WP',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Alambrón Liso',
            ],
            [
                'codigo'      => '09',
                'descripcion' => 'Alcantarilla metálica',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Alcayata',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Alfombra',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Alquitrán',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Amasadora de asfalto',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Amperímetro',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Anclaje para pretensado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Anillo de jebe',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Anticorrosivo',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Aparato sanitario',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Apoyos neopreno',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Arandela de cuero',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Arandela de fierro',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Arbol',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Arcilla',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Arena fina',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Arena gruesa',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Armella',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Arrancador P/V sodio',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Artefacto de alumbrado exterior',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Artefacto de alumbrado interior',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Artefacto farol',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Artefacto fluorescente',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Ascensor',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Asfalto',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Asfalto industrial sólido',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Asfalto RC-250',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Asignación  excepcional',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Automóvil',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Ayudante',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Azufre',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Azulejo',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Badilejo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Balanza',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Balde',
            ],
            [
                'codigo'      => '14',
                'descripcion' => 'Baldosa acústica',
            ],
            [
                'codigo'      => '16',
                'descripcion' => 'Baldosa vinílica',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Baldosin semigres',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Bambú',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Barníz',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Barredora mecánica',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Barreno',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Barro',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Batea',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Batería',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bentonita',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Berbiquí',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Bidet',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bisagra importada',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Bisagra nacional',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bisagra vaiven',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bisagras de extensión',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bita',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Bloque concreto',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Bloque concreto para muro',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Bloque concreto para techo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bloque de 50 pares para armario',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bloque de vidrio',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Bobina',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bolardo',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Bomba centrífuga',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Bomba de agua Diesel',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Bomba de agua tipo turbina',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Bomba de concreto',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Bomba de inyección de cemento',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Bomba neumática para vaciado de concreto',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Borne',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Botas de jebe',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Bote',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Botón de campanilla',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Boya',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Braquete',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Brea',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Brida',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Broca',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Brocha',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bronce',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Bujía',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Bushing de fierro galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Bushing de PVC',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Buzón para ducto de basura',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cable de acero para concreto pretensado',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable mensajero de 6.000, 10,000 y 16,000 lbs',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable telefónico armado',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable telefónico autosoportado con aislamiento ',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable telefónico con aislamiento de papel',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable telefónico con aislamiento de polietileno',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Cable telefónico para formas con PVC y plomo',
            ],
            [
                'codigo'      => '19',
                'descripcion' => 'Cable NKBA',
            ],
            [
                'codigo'      => '19',
                'descripcion' => 'Cable NKY',
            ],
            [
                'codigo'      => '19',
                'descripcion' => 'Cable NYY',
            ],
            [
                'codigo'      => '07',
                'descripcion' => 'Cable TW y THW',
            ],
            [
                'codigo'      => '08',
                'descripcion' => 'Cable WP',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Cabo',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Cabría',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cadena',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja cabina eléctrica',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja cuadrada eléctrica',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja de conexión de agua y desagüe',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja de fierro galvanizado eléctrica',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja de madera tablero eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja eléctrica',
            ],
            [
                'codigo'      => '50',
                'descripcion' => 'Caja interna de fierrro fundido',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja metálica tablero eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja octogonal liviana eléctrica',
            ],
            [
                'codigo'      => '50',
                'descripcion' => 'Caja para medidor de agua fierro fundido',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Caja portafusibles',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja prefabricada grifo',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja protección concreto prefabricada',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Caja terminal de 10 ó 20 pares, sin protección, sin cola y sin sellar',
            ],
            [
                'codigo'      => '18',
                'descripcion' => 'Caja terminal de 10 ó 20 pares, sin protección, con cola y sellada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Caja terminal de 10 ó 20 pares, con protección, con cola y sellada',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja sumidero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cal',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Calamina de aluminio',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Calamina de zinc',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Caldera',
            ],
            [
                'codigo'      => '29',
                'descripcion' => 'Cámara neumática',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cambia vía',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Camión',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Camión cisterna',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Camión concretero',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Camión imprimador',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Camión plataforma de baranda',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Camión tractor',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Camión volquete',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Camioneta',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Campana extractora',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Campana timbre eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Campanilla timbre',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Caña',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Canaleta aluminio',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Canaleta asbesto cemento',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Canaleta zinc',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Canalón asbesto cemento',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Candado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cañería plomo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cangilón ',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Canopla cromada',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Canto rodado',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Cantonera acero',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Cantonera aluminio',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Caoba',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Capataz',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Secador de Aridos',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Carretilla',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Carros decauville',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cartón',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cartón embreado',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Casco minero',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Cascote',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Casquete Spot Light',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Caucho',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Cedro',
            ],
            [
                'codigo'      => '20',
                'descripcion' => 'Cemento asfáltico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cemento blanco',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Cmento Portland tipo I',
            ],
            [
                'codigo'      => '22',
                'descripcion' => 'Cemento Portland tipo II',
            ],
            [
                'codigo'      => '23',
                'descripcion' => 'Cemento Portland tipo V',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Cepilladora pisos',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Cepillo',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Cera',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Cerámica esmaltada y sin esmaltar',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cerrajería importada',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Cerrajería nacional',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Cerrojo',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Césped',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Chalana',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Chancadora',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Chapa importada',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Chapa nacional',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Chapa flotante de acero',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Cilindro',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Cimbras metálicas',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Cincel',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cinta aislante eléctrica',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Cizalla',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Clavos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cobre',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Cocina asfáltica',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Codo de fierro fundido',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Codo de fierro negro y/o galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo PVC agua',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo PVC sal desagüe',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo PVC sap eléctrico',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo ventilacion PVC desagüe',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Cola',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Cola sintética',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Compactador manual',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Compactadora de rodillos',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Compactadora vibratoria',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Compresora',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Compresora Diesel',
            ],
            [
                'codigo'      => '09',
                'descripcion' => 'Compuerta metálica',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Condensador',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Conductor aéreo',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Conductor desnudo',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Conector eléctrico PVC',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Confitillo',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Confitillo o cascajo de ladrillo',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Conmutador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Contracarril',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Contrapaso madera',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Contrazócalo aluminio',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Contrazócalo loseta',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Contrazócalo madera',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Contrazócalo sanitario',
            ],
            [
                'codigo'      => '64',
                'descripcion' => 'Contrazócalo terrazo',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Contrazócalo veneciano',
            ],
            [
                'codigo'      => '16',
                'descripcion' => 'Contrazócalo vinílico',
            ],
            [
                'codigo'      => '29',
                'descripcion' => 'Corcho',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Cordel',
            ],
            [
                'codigo'      => '27',
                'descripcion' => 'Cordón detonante',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cornamusa',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Cortadora de fierro de construcción ',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Crawler Drill',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Criba',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cristal templado',
            ],
            [
                'codigo'      => '62',
                'descripcion' => 'Cruceta de concreto',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Cruceta de madera',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Cruz de fierrro galvanizado',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Cruz de fierro fundido',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Cruz de PVC',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Cuarzo',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Cumbrera asbesto cemento',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Cuña de madera',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Curva de PVC eléctrico',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Decorpanel',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Defensas de caucho',
            ],
            [
                'codigo'      => '73',
                'descripcion' => 'Desvío de PVC desagüe',
            ],
            [
                'codigo'      => '27',
                'descripcion' => 'Detonador eléctrico',
            ],
            [
                'codigo'      => '27',
                'descripcion' => 'Detonante',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Dinamita',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Dinamo',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Dobladora de fierro',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Dobladora de tubos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Dólar',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Dólar más inflación mercado USA',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Dosificadora de concreto',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Ducto de concreto',
            ],
            [
                'codigo'      => '61',
                'descripcion' => 'Ducto de plancha fierro galvanizado',
            ],
            [
                'codigo'      => '73',
                'descripcion' => 'Ducto telefónico de PVC',
            ],
            [
                'codigo'      => '70',
                'descripcion' => 'Durmiente de concreto',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Durmiente de madera',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Eclisa',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Electrobomba',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Electrodos',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Elementos arcilla para celosía',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Elementos asbesto, cemento para celosías',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Elementos concreto para celosía',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Elevador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Embeco',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Empaquetadura',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Encofrado metálico',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Encuentro asbesto comento',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Enchape cerámico',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Energía eléctrica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Epóxico',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Escantillón',
            ],
            [
                'codigo'      => '09',
                'descripcion' => 'Esclusa',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Escoba',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Esmalte',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Esmeril',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Esparcidora de agregados',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Esparcidora de asfalto en frío',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Esparcidora de concreto',
            ],
            [
                'codigo'      => '79',
                'descripcion' => 'Espejo',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Estabilizadora de suelo',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Estaca de madera',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Estaño',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Esteras',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Estopa',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Eucalipto',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Expanded metal',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Faja transportadora',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Fanal',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Farol',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Ferretería de soporte y tensión de fierro galvanizado',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Fibro cemento',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fibra vidrio',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fieltro',
            ],
            [
                'codigo'      => '03',
                'descripcion' => 'Fierro corrugado',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Fierro liso',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Filtro',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Flete acuático',
            ],
            [
                'codigo'      => '33',
                'descripcion' => 'Flete aéreo',
            ],
            [
                'codigo'      => '32',
                'descripcion' => 'Flete terrestre',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Formica',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Frotacho',
            ],
            [
                'codigo'      => '27',
                'descripcion' => 'Fulminante',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Fusible eléctrico',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Gabinete metálico',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Gancho',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Gánguil',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Garlopa',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Garrucha',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Gas',
            ],
            [
                'codigo'      => '34',
                'descripcion' => 'Gasolina',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Gastos generales',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Gelatina',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Gelignita',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Generador',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Grafito',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Granito',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Grasa',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Grass',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Grava',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Gres cerámico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Griferia importada aparatos sanitarios',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Grifería nacional aparatos sanitarios',
            ],
            [
                'codigo'      => '78',
                'descripcion' => 'Grifo contra incendio',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Grúa',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Grupo electrógeno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Guarda cabo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Guarda riel',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Guarda vía',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Guillotina para planchas de acero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Gutapercha',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Hacha',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Herramienta manual',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Hojalata',
            ],
            [
                'codigo'      => '38',
                'descripcion' => 'Hormigón',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Huacapú',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Impermeabilizante',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Imprimante acrílico',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Imprimante asfáltico',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Indice general de precios al consumidor (INE)',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Inodoro  tanque alto',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Inodoro tanque bajo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Instrumento topográfico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Interruptor de bakelita',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Interruptor de cuchilla',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Interruptor no fuse eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Interruptor térmico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Interruptor eléctrico',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Jabón',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Jabonera',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Jalón',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Jamba',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Junta water stop cobre',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Junta water stop neopreno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Junta water stop PVC',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Kerosene',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Laca',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Ladrillo de arcilla',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Ladrillo pastelero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ladrillo refractario',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Ladrillo Sílico Calcáreo',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Laja',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Lampa',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Lámpara',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Lámpara de vapor de mercurio',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Lámpara vapor sodio',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Lancha',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Lanchón',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Lata',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Latón',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Lavadero acero inoxidable',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavadero de cocina',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavadero fierro enlozado',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavadero granito',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavadero ropa',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavatorio losa',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Lavatorio fierro aporcelanado',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Leña',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Lija',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Lima',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Linterna',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Líquido curador',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Llana',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Llanta',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Locomotora',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Loseta',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Loseta cemento',
            ],
            [
                'codigo'      => '16',
                'descripcion' => 'Loseta vinílica',
            ],
            [
                'codigo'      => '01',
                'descripcion' => 'Lubricante',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Luminaria',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Maceta',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Madera en tiras para piso',
            ],
            [
                'codigo'      => '42',
                'descripcion' => 'Madera importada para enconfrado y carpintería',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Madera nacional para encofrado y carpintería',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Madera terciada para carpintería',
            ],
            [
                'codigo'      => '45',
                'descripcion' => 'Madera terciada para encofrado',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Madera tornillo',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Maderba',
            ],
            [
                'codigo'      => '46',
                'descripcion' => 'Malla de acero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Malla de plástico',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Mandril',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Manga',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Mano de obra (incluído leyes sociales)',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Mapresa',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Maquinaria y equipo importado',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Maquinaria y equipo nacional',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Marco Tapa de Concreto Reforzado',
            ],
            [
                'codigo'      => '50',
                'descripcion' => 'Marco y Tapa de Fierro Fundido',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Mármol',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Mármol reconstituído',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Martillo',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Martillo a vapor',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Martillo hincapilote',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Martillo neumático',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Martinete',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Masa aislante',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Masilla',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Master plate',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mayólica importada',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Mayólica nacional',
            ],
            [
                'codigo'      => '27',
                'descripcion' => 'Mecha',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Medidor',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Megómetro',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Mezcladora de concreto',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Migajón',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Mira',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Monocarril',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Montacarga',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Mosaico',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Motobomba',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Motoniveladora',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Motor eléctrico',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Motosierra',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Motosoldadora',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Calentador de Aceite',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Muraleta cerámica',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Muriglas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Neopreno',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Niple bronce',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Niple cromado',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Niple de fierro galvanizado',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Niple de fierro negro',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Niple PVC',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Niquel',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Nitrato de armonio',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Nivel óptico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Nivel topográfico',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Nogal',
            ],
            [
                'codigo'      => '29',
                'descripcion' => 'Ocre',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Oficial',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Operario',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Ovalin',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Pabilo',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Paja',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Pala hidráulica',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Pala mecánica',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Pantalla iluminación',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pantalón y saco impermeable',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Papel',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Papelera losa',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Papelera cromada',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Pararrayo',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Parihuela',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet bálsamo',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet chonta quiro',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet coricaspi',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet diablo fuerte',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet guayacán',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet hualtaco',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet oreja de león',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Parquet quinilla',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Pasamano de aluminio',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Pasamano de madera',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Paso de madera',
            ],
            [
                'codigo'      => '62',
                'descripcion' => 'Pastoral para poste concreto',
            ],
            [
                'codigo'      => '63',
                'descripcion' => 'Pastoral para poste fierro',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Pavimentadora de asfalto sobre neumático',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Pavimentadora de asfalto sobre oruga',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Pavimentadora de concreto',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Pegamento Asfáltico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pegamento para Tubería PVC Eléctrica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pegamento Plástico PVC',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Peón',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Pepelma',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Perfil de acero liviano',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Perfil de acero pesado',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Perfil de aluminio',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Perforadora oruga',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Perno',
            ],
            [
                'codigo'      => '53',
                'descripcion' => 'Petróleo diesel',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Picaporte',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Pico',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Picota',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra chancada',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra grande de río',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra mediana de cantera o de río',
            ],
            [
                'codigo'      => '42',
                'descripcion' => 'Pino oregón',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura anticorrosiva',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura esmalte',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura latex',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura latex acrílico',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura latex vinílico',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura óleo',
            ],
            [
                'codigo'      => '55',
                'descripcion' => 'Pintura temple',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Piso cerámico',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Pisón manual',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Pisón  mecánico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pivot',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Placa aluminio sal eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Placa bakelita sal eléctrico',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Placa salida therma',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Placa salida TV-teléfonica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plancha de acero inoxidable',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Plancha de acero LAC',
            ],
            [
                'codigo'      => '57',
                'descripcion' => 'Plancha de acero LAF',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Plancha de acero mediana LAC',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plancha de aluminio',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Plancha de asbesto-cemento',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plancha de cobre',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Plancha de poliuretano',
            ],
            [
                'codigo'      => '61',
                'descripcion' => 'Plancha galvanizada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plancha magnética de grano orientado',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Plancha tecnopor',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Planta de asfalto en caliente',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Planta de asfalto en frío',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Plataforma de fierro',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Plataforma remolque',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Platina de cobre electrolítico',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Plomada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plomo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Poliestireno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Polipak',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Polivynil',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Poliuretano',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Pólvora',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Porcelana',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Portafusible',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Portalámpara',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Poste Acero',
            ],
            [
                'codigo'      => '62',
                'descripcion' => 'Poste de concreto',
            ],
            [
                'codigo'      => '63',
                'descripcion' => 'Poste de fierro',
            ],
            [
                'codigo'      => '42',
                'descripcion' => 'Poste de madera importada',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Poste de madera nacional',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Probeta de ensayos',
            ],
            [
                'codigo'      => '19',
                'descripcion' => 'Punta muerta',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Punzón',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Ramal y de PVC desagüe',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Rastrillo',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Reactor P/HPL',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Reactor P/V sodio',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Reducción fierro fundido',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Reducción galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Reducción PVC',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Reflector',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Refuerzo y puntual',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Regla',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Relay',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Reloj',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Remolcador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Reostato',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Resina epóxica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Resina para el sellado de caja terminal',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Retro excavadora',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Riel',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Ripio',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Ripper',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Roble',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Roca',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Rodillo',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Rodón',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Rompepavimento',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Sapito',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Seccionador tripolar',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Sellador de pintura',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Sellador para puntas de expansión',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Sello asfáltico',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Serrucho',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Setos vivos',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Sierra circular',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Sierra manual',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Sierra mecánica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Sika',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Silicona',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Sillar',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Sismógrafo',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Soga',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Soldadora eléctrica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Soldadura',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Sombrero de ventilación PVC',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Sombrero de ventilación bronce',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Sonda',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Soplete',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Soporte acero',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Sumidero de bronce',
            ],
            [
                'codigo'      => '42',
                'descripcion' => 'Tabla de madera importada',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Tabla de madera nacional',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Tablero eléctrico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tablestaca metálica',
            ],
            [
                'codigo'      => '42',
                'descripcion' => 'Tanblón madera importada',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Tablón madera nacional',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Tachuela',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Taladro',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Tapa concreto para buzón',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Tapa concreto para caja de desagüe',
            ],
            [
                'codigo'      => '50',
                'descripcion' => 'Tapa de fierro fundido',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tada de fierro galvanizado',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Tapa liviana eléctrica',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Tapa pesada eléctrica',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Tapahonda canal asbesto cemento',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Tapa junta acero',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Tapa junta aluminio',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tapizón',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tapón de fierro galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tapón de PVC',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tapón de fierro fundido',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Tarraja',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Tarugo',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tee de fierro fundido',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tee de fierro galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tee PVC',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Teja arcilla',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Teja asbesto cemento',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Tejalón',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Tenaza',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Teodolito',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Terminal may',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Termostato',
            ],
            [
                'codigo'      => '64',
                'descripcion' => 'Terrazo',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Testigo ensayo',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Tierra de chacra',
            ],
            [
                'codigo'      => '04',
                'descripcion' => 'Tierra vegetal',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Tina',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tirafondo rieles',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Toallera',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Tomacorriente',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Tornillo',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Tornillo de banco',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Torno',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Tractor',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Trailla',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Trampa fierro fundido desagüe',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Trampa plomo',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Trampa PVC desague',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Transformador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Transporte acuático',
            ],
            [
                'codigo'      => '33',
                'descripcion' => 'Transporte aéreo',
            ],
            [
                'codigo'      => '32',
                'descripcion' => 'Transporte terrestre',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Travesaño de madera',
            ],
            [
                'codigo'      => '70',
                'descripcion' => 'Traviesa de concreto',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Traviesa de madera',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Trefilado(acero para pretensado)',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Trefilado(acero de refuerzo)',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Triplay para carpintería',
            ],
            [
                'codigo'      => '45',
                'descripcion' => 'Triplay para enconfrado',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Triturador',
            ],
            [
                'codigo'      => '09',
                'descripcion' => 'Tubería Armco',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubería de acero negro y/o galvanizado',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubería de acero soldada',
            ],
            [
                'codigo'      => '66',
                'descripcion' => 'Tubería de asbesto cemento',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Tubería de cobre',
            ],
            [
                'codigo'      => '70',
                'descripcion' => 'Tubería de concreto reforzado',
            ],
            [
                'codigo'      => '69',
                'descripcion' => 'Tubería de concreto simple',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tubería de fierro fundido',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubería de fierro negro stand',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubería de PVC para agua',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubería de PVC para desagüe',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubería de PVC para eléctricidad',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tubitos de papel',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tubitos de polietileno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tubos para pilotaje',
            ],
            [
                'codigo'      => '26',
                'descripcion' => 'Tuerca',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Tupi',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión PVC agua',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión PVC desagüe',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión PVC eléctrica',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Unión simple fierro galvanizado',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Unión universal galvanizado',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión universal PVC',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Urinario',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Utilidad',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Vagón',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Válvula de bronce importada',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula de bronce nacional',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Válvula de fierro fundido importada',
            ],
            [
                'codigo'      => '78',
                'descripcion' => 'Válvula de fierro fundido nacional',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Válvula flot',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Ventilador',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Vibrador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Vidrio laminado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Vidrio templado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Vidrio importado',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Volquete',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Voltímetro',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Varilla para tierra, copperweld',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Varilla para tierra, de cobre',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Varilla para tierra, de bronce',
            ],
            [
                'codigo'      => '02',
                'descripcion' => 'Varilla para tierra, de acero galvanizado',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'W.C tanque alto',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'W.C tanque bajo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Waipe',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Winche',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Yee fierro fundido desagüe',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Yee PVC desagüe',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Yeso',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Yunque',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Zafiro  No.3241-I',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Zaranda mecánica',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Zócalo aluminio',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Zócalo madera',
            ],
            [
                'codigo'      => '16',
                'descripcion' => 'Zócalo vinílico',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Zócalo veneciano',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra de Zanja',
            ],
            [
                'codigo'      => '05',
                'descripcion' => 'Piedra Clasificada',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Pedestal Para Lavatorio',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Tapa Para Estanque',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Portacepillo',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Mezcladora Para Lavatorio',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Llave Para Lavatorio',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Llave Para Ducha',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Mezcladora Para Ducha',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Transformador Para Llave de Lavatorio Electrónico',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Adaptador Para Válvula Electrónica',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Fluxómetro',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Portajabonera',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Perchero',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Repisa',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Portavaso',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Ducha',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Enchape Sílico Calcáreo',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Adoquines',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Muretes',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Morteros',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Sardinales',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Cemento Portland Tipo I',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Concreto ',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Concreto Preparado ',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Veredas',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Estructuras Especiales',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Fibrablock',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Poliblock',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Plancha Fibrablock',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Porcelanato',
            ],
            [
                'codigo'      => '24',
                'descripcion' => 'Listelos',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Hidrogeles',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Disolvente de Lacas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Curadores',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Protector para Pisos de Hormigón',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Sello Hidráulico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Superboard',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Panel Termoacústico Para Techos y Muros',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Gyplac ',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Parantes Metálicos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Perfiles Metálicos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tornillos para Sistema DryWall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pastas para Sistema DryWall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cinta para Sitema DryWall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fulminante para Sistema DryWall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Clavos para Sistema Drywall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cuchilla DryWall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fragua para Sellar Juntas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pegamentos a Base de Cemento ',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tanque de Polietileno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tapa de Polietileno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Granallas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Marmolina',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Espejo Importado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Esquinero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pegamento para Cerámica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tablero de Madera',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Formipak',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tablepak',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Melapak',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cubierta Postformada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mesa Postformada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Puerta',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Correderas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cerradura ',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tirador',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tope de Puerta',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Láminas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Extintor',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Recarga de Extintor',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Instalación de Alfombra',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Baldosa Importada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Drywall',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Persianas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayos de Productos Bituminosos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo de Puzolonas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayos en Acero',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo de Cemento Portland',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayos en Cemento',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayos en Agregado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayos en Concreto',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Planchas Termoacústicas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo de Mezclas Bituminosas',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo de Suelo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo Especial en Roca y Suelo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Ensayo de Emulsión Asfáltica',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Lavado de Alfombra',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Baldosa Nacional',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Planchas Traslucidas',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Cerco de Concreto',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja para Meditor de Agua',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Caja para Registro de Desague',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Tapa de Fierro Galvanizado',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Base para Caja',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Intermedio para Caja',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Pozo a Tierra',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Elementos para Buzones de Desague',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Listones',
            ],
            [
                'codigo'      => '41',
                'descripcion' => 'Piso Láminado',
            ],
            [
                'codigo'      => '31',
                'descripcion' => 'Ductos para Cableado Eléctrico y Telefónico',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Trupán',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Nordex',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Tanque Neumático',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Riel Metálico Construtek',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Parante Construtek',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Plancha de Yeso',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Lana de Vidrio',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Cinta Construtek',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Tornillo Punta Fina',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Masilla Construtek',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Baldosa Knauf',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Parante para Drywall',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Riel para Drywall',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Angulo Esquinero',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Correa para Drywall',
            ],
            [
                'codigo'      => '51',
                'descripcion' => 'Coberturas',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Filete Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Barra Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Platina Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Angulo Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Tubos de Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Tee Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Cielo Razo',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Parante de Aluminio',
            ],
            [
                'codigo'      => '52',
                'descripcion' => 'Marco de Aluminio',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Imprimante para Muros',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pasta a Base Latex',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Terokal',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Abrillantador ',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Solventes',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pasta para Muros',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Temple Fino Sinolit ',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura Teknocolor',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura Acrílico',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura Marina',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Thinner',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura Teknodur ',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Pintura Trafico',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Disolvente ',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Tecko',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Tecnomate',
            ],
            [
                'codigo'      => '56',
                'descripcion' => 'Barras Cuadradas',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Plancha de Fibrocemento',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Perfil Fibrocemento',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Lámina Termoacústica para Coberturas Cindu',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Asfálto Plástico ',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Teja Romana',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Teja Pantile',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Teja Plana',
            ],
            [
                'codigo'      => '59',
                'descripcion' => 'Teja Cumbrera',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Plancha Etsapol',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Plancha Policarbonato Traslucido Standard ',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Perfil de Policarbonato',
            ],
            [
                'codigo'      => '60',
                'descripcion' => 'Plancha Policarbonato Traslucido Primalite',
            ],
            [
                'codigo'      => '61',
                'descripcion' => 'Calamina Galvanizada',
            ],
            [
                'codigo'      => '62',
                'descripcion' => 'Placas para Cerco',
            ],
            [
                'codigo'      => '62',
                'descripcion' => 'Duragrass',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubo Galvanizado',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Angulo de Fierro',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubo Redondo',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubos Cuadrados',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Tubos Rectangulares',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Canales Plegados',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Cañería de Acero',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Split Set',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Canales en Acero',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Cañería  Schedule',
            ],
            [
                'codigo'      => '69',
                'descripcion' => 'Accesorios para Tuberías',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Cruz de Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tee de Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Reducción de Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Codo de Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Unión Flexible Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Marcos y Tapas Buzón Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Válvula Hierro Ductil',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tubos de Acero',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Tubos de Cobre',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Válvula Check ',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubería PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión Simple PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Adaptador PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión Brida PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubo para Luz',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tubo Sel',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Caja Rectangular',
            ],
            [
                'codigo'      => '07',
                'descripcion' => 'Caja Octagonal',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Accesorios de PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Pegamento Fordut para Tubería PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Conexión a Caja PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión PVC para Fluidos a Presión',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo PVC para Fluidos a Presión',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Curva PVC para Fluido a Presión',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tapones PVC para Desague',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo CPVC ',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Adaptador de CPVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tee CPVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Reducción CPVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tapón CPVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Soldadura Oatey - Pavco',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo Cachimba',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo Embone',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Codo Rosca',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tee Rosca',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión Rosca',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Unión Embone',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Reducción Rosca',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Sombrero PVC',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Duraplástico',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Tee Fierro Fundido',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Cruces Fierro Fundido',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Transiciones Brida',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Codos Fierro Fundido',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Accesorios de Fierro Fundido ',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Esférica',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula de Compuerta',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Globo',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Flotadora',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Llave para Lavadero Esférica / Jardín',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Accesorios para Sanitario',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Tubo de Prolonga con Pestaña',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Tubo Abasto Acero Inoxidable',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Tubo Abasto Aluminio',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Tubo Abasto Cobre',
            ],
            [
                'codigo'      => '47',
                'descripcion' => 'Topógrafo',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Motoperforadora',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Cargador',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'MotoTraillas',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Excavadoras ',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Minicargador',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Zaranda Vibratoria',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Recicladora en Frío',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Fresadora',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Semi Trayler',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Equipo Oxicorte',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Llave Stilson',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Bomba de Presión',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Sanitarios Portátiles',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Baño',
            ],
            [
                'codigo'      => '03',
                'descripcion' => 'Alambrón Corrugado',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Retardador Eléctrico',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Codo de acero negro y/o galvanizado',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Materiales',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Cortina Metálica',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Andamio ',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'terminal',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Mezcla',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Gravilla',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Campamentos',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'estacas de fierro',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Supertcast rearguard',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Z aditivos',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Water Stop',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Bombilla para alumbrado interior',
            ],
            [
                'codigo'      => '21',
                'descripcion' => 'Cemento portland MS',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Chema aditivos',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Zócate',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Señal pra uso informativo en Carreteras',
            ],
            [
                'codigo'      => '37',
                'descripcion' => 'Escaleras',
            ],
            [
                'codigo'      => '43',
                'descripcion' => 'Tranqueras de madera',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Sub Contratos',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Detergente',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Waipe industrial',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Microesferas de vidrio',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Máquina para pintar pavimento',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Placa de aluminio anodizado',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Dado interruptor',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'Dado de conmutacion',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Tapa de plástico',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Caja Cortacircuito',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Tubería Flexible',
            ],
            [
                'codigo'      => '12',
                'descripcion' => 'jack para salida de voz',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Botonera',
            ],
            [
                'codigo'      => '54',
                'descripcion' => 'Aguarras',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Cable de cobre',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Conector barra',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fundente',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'caja de rigistro',
            ],
            [
                'codigo'      => '11',
                'descripcion' => 'Dosis química',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Tubo de cobre',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Codo de cobre',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Tee de cobre',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Adaptador de cobre',
            ],
            [
                'codigo'      => '48',
                'descripcion' => 'Equipo de corte',
            ],
            [
                'codigo'      => '68',
                'descripcion' => 'Reducción de cobre',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Placa para empotrar',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Oxígeno y acetileno',
            ],
            [
                'codigo'      => '06',
                'descripcion' => 'Conector eléctrico',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Caja Octagonal',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Dsico de corte',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Disco de corte',
            ],
            [
                'codigo'      => '49',
                'descripcion' => 'Cortadora de pavimento',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Lubricante vegetal',
            ],
            [
                'codigo'      => '09',
                'descripcion' => 'Terminales',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Espejos de Baño',
            ],
            [
                'codigo'      => '13',
                'descripcion' => 'Emulsiones Asfálticas',
            ],
            [
                'codigo'      => '14',
                'descripcion' => 'Tecnopor o Poliestireno',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Block Grass',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Muros Perimétricos',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Pastelones',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Placas',
            ],
            [
                'codigo'      => '28',
                'descripcion' => 'Emulsiones',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Repisa Postformada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Puerta - Tapa Cajón Posformada',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Formicanto',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Primer Acrílico',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Fragua Kerfix',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Bi-Componente',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Calamina',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Acelerantes',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Aderentes',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Plastificantes y Retardantes',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mortero de Restauración',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Emulsiión Desencofrante',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Laca Desmoldante',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mortero de Fraguado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mortero para Montaje',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Juntas de Construcción',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mortero Concreto Líquido',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Mortero Ultra-Pega',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tanque Cisterna',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tapa para Tanque Cisterna',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Perla de Poliestireno',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Masilla Base Romeral',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Pegamento Romeral',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Check Canastilla de Bronce',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Check Swing de Bronce',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Check Vertical - Horizontal',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Check Vertical de Bronce',
            ],
            [
                'codigo'      => '77',
                'descripcion' => 'Válvula Check Horizontal de Bronce',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Abono',
            ],
            [
                'codigo'      => '72',
                'descripcion' => 'Abrazadera de PVC',
            ],
            [
                'codigo'      => '65',
                'descripcion' => 'Abrazadera de Fierro Galvanizado',
            ],
            [
                'codigo'      => '71',
                'descripcion' => 'Abrazadera',
            ],
            [
                'codigo'      => '39',
                'descripcion' => 'Tiza',
            ],
            [
                'codigo'      => '17',
                'descripcion' => 'Bloque y Ladrillo',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Vidrio nacional',
            ],
            [
                'codigo'      => '10',
                'descripcion' => 'Aparato sanitario con grifería',
            ],
            [
                'codigo'      => '44',
                'descripcion' => 'Madera terciada para encofrado y carpintería',
            ],
            [
                'codigo'      => '66',
                'descripcion' => 'Tubería de PVC para la Red de Agua Potable y Alcantarillado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Aditivo p. concreto',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Cable de acero',
            ],
            [
                'codigo'      => '19',
                'descripcion' => 'Cable N2XY',
            ],
            [
                'codigo'      => '40',
                'descripcion' => 'Losetones',
            ],
            [
                'codigo'      => '80',
                'descripcion' => 'Concreto premezclado',
            ],
            [
                'codigo'      => '30',
                'descripcion' => 'Tiza',
            ],
        ];

        foreach ($data as $item) {
            $connection->table('diccionario')->updateOrInsert(
                ['descripcion' => $item['descripcion']],          // ← clave de búsqueda
                array_merge($item, [
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }
}