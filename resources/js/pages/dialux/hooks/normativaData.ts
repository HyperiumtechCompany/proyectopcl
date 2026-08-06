export interface RawNormativeLeaf {
    title: string;
    label: string;
    iluminancia_lux: number;
    UGR: number | null;
    Uo: number | null;
    Ra: number | null;
    requisitos_especificos: string | null;
    /**
     * Altura del plano útil (m) que DIALux evo usa por defecto para esta
     * actividad. `undefined` = no verificado todavía contra DIALux real —
     * el motor sigue usando el respaldo genérico de `getRoomUsefulPlaneHeight`
     * (`roomLighting.ts`: 0m para espacios tipo pasillo, 0.8m para el resto).
     * Rellenar SOLO con un valor confirmado contra un export real de DIALux
     * evo — no estimar ni copiar de otra actividad "parecida".
     */
    workPlaneHeight?: number;
}

export interface RawNormativeBranch {
    title: string;
    subsections?: Array<RawNormativeBranch | RawNormativeLeaf>;
    subsubsections?: RawNormativeLeaf[];
}

export const en12464Regulations: RawNormativeBranch[] = [
    {
        title: 'Vivienda',
        subsections: [
            {
                title: 'Zona privada',
                subsubsections: [
                    {
                        title: 'Dormitorio',
                        label: 'Dormitorio, sala de estar, comedor, sala de juegos, sala de television y similares',
                        iluminancia_lux: 50,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Baño',
                        label: 'Bano, area de ducha, banera y similares',
                        iluminancia_lux: 100,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Baño espejo',
                        label: 'Bano, area de espejo y similares',
                        iluminancia_lux: 500,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Cocina',
                        label: 'Cocina, area de lavado y similares',
                        iluminancia_lux: 300,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Sala',
                        label: 'Sala de estar, comedor, sala de juegos, sala de television y similares',
                        iluminancia_lux: 100,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Comedor',
                        label: 'Comedor, sala de estar, sala de juegos, sala de television y similares',
                        iluminancia_lux: 100,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Estudio',
                        label: 'Estudios, almacenes, depositos, walking closet, cuartos de trabajo domestico y similares',
                        iluminancia_lux: 100,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Patio',
                        label: 'Patios, terrazas, balcones y similares',
                        iluminancia_lux: 20,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Estacionamiento bajo techo',
                        label: 'Estacionamientos bajo techo y similares',
                        iluminancia_lux: 50,
                        UGR: null,
                        Uo: null,
                        Ra: null,
                        requisitos_especificos: 'Ninguno',
                    },
                ],
            },
            {
                title: 'Zonas comunes',
                subsubsections: [
                    {
                        title: 'Vestibulos de entrada',
                        label: 'Vestibulos de entrada, pasillos, escaleras y similares',
                        iluminancia_lux: 100,
                        UGR: 22,
                        Uo: 0,
                        Ra: 60,
                        requisitos_especificos: 'Debe ser accesible',
                    },
                    {
                        title: 'Salas publicas',
                        label: 'Salas de estar publicas, comedores publicos, salas de juegos publicas y similares',
                        iluminancia_lux: 200,
                        UGR: 22,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Debe ser accesible',
                    },
                    {
                        title: 'Area de circulacion',
                        label: 'Areas de circulacion y pasillos en edificios de vivienda colectiva y similares',
                        iluminancia_lux: 100,
                        UGR: 28,
                        Uo: 0,
                        Ra: 40,
                        requisitos_especificos: 'Debe ser accesible',
                    },
                    {
                        title: 'Escaleras y pasillos',
                        label: 'Escaleras, escaleras mecanicas y transportadores de personas',
                        iluminancia_lux: 150,
                        UGR: 25,
                        Uo: 0.4,
                        Ra: 40,
                        requisitos_especificos: 'Iluminancia a nivel del suelo',
                    },
                    {
                        title: 'Ascensores y montacargas',
                        label: 'Ascensores, montacargas y similares',
                        iluminancia_lux: 100,
                        UGR: 25,
                        Uo: 0.4,
                        Ra: 40,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Rampas y andenes',
                        label: 'Rampas, andenes, patios de carga y similares',
                        iluminancia_lux: 150,
                        UGR: 25,
                        Uo: 0.4,
                        Ra: 40,
                        requisitos_especificos: 'Ninguno',
                    },
                ],
            },
        ],
    },
    {
        title: 'Educacion',
        subsections: [
            {
                title: 'Vestíbulos',
                label: 'Vestíbulo de entrada, recepción y áreas de distribución (EN 12464-1 §44.18 Entrance halls)',
                iluminancia_lux: 200,
                UGR: 25,
                Uo: null,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
                // Verificado contra export real DIALux evo (proyecto "Módulo
                // 22", ambiente CASETA DE CONTROL, 2026-08-05): Altura del
                // plano útil = 0.600 m para esta actividad exacta.
                workPlaneHeight: 0.6,
            },
            {
                title: 'Sala de juegos',
                label: 'Salas de juegos, salas de television y similares',
                iluminancia_lux: 300,
                UGR: 22,
                Uo: 0.4,
                Ra: 80,
                requisitos_especificos:
                    'Debe evitarse altas luminancias en las direcciones de vision desde abajo',
            },
            {
                title: 'Guarderias',
                label: 'Guarderias, salas de juegos, salas de television y similares',
                iluminancia_lux: 300,
                UGR: 22,
                Uo: 0.4,
                Ra: 80,
                requisitos_especificos:
                    'Debe evitarse altas luminancias en las direcciones de vision desde abajo',
            },
            {
                title: 'Sala de manualidades',
                label: 'Salas de manualidades, laboratorios, talleres y similares',
                iluminancia_lux: 300,
                UGR: 22,
                Uo: 0.4,
                Ra: 80,
                requisitos_especificos:
                    'Debe evitarse altas luminancias en las direcciones de vision desde abajo',
            },
            {
                title: 'Aula de profesores',
                label: 'Aulas de profesores, salas de reuniones y similares',
                iluminancia_lux: 300,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'La iluminacion debe ser controlable',
            },
            {
                title: 'Aulas para clases nocturnas',
                label: 'Aulas para clases nocturnas y de educación de adultos',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'La iluminacion debe ser controlable',
            },
            {
                title: 'Sala de lectura',
                label: 'Sala de lectura',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'La iluminacion debe ser controlable',
            },
            {
                title: 'Zona de pizarra',
                label: 'Zona de pizarra',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.7,
                Ra: 80,
                requisitos_especificos:
                    'Deben evitarse las refl exiones especulares El presentador/profesor debe iluminarse con la iluminancia vertical adecuada',
            },
            {
                title: 'Mesa de demortraciones',
                label: 'Mesa de demortraciones',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.7,
                Ra: 80,
                requisitos_especificos: 'En salas de lectura 750 LX',
            },
            {
                title: 'Locales de artes',
                label: 'Locales de artes y oficios',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
            },
            {
                title: 'Locales de artes escuelas',
                label: 'Locales de artes (en escuelas de arte)',
                iluminancia_lux: 750,
                UGR: 19,
                Uo: 0.7,
                Ra: 90,
                requisitos_especificos: '5000k =< TCP < 6500 k',
            },
            {
                title: 'Salas de dibujo',
                label: 'Sala de dibujo técnico',
                iluminancia_lux: 750,
                UGR: 19,
                Uo: 0.7,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
            },
            {
                title: 'Locales de prácticas',
                label: 'Locales de prácticas y laboratorios',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
            },
            {
                title: 'Aulas de manualidades',
                label: 'Aulas de manualidades',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
            },
            {
                title: 'Taller de enseñanza',
                label: 'Taller de enseñanza',
                iluminancia_lux: 500,
                UGR: 19,
                Uo: 0.6,
                Ra: 80,
                requisitos_especificos: 'Ninguno',
            },
        ],
    },
    {
        title: 'Salud',
        subsections: [
            {
                title: 'Zonas de hospitalización',
                subsubsections: [
                    {
                        title: 'Habitación de paciente',
                        label: 'Habitación individual o compartida para paciente',
                        iluminancia_lux: 100,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos:
                            'Iluminación atenuable para descanso',
                    },
                    {
                        title: 'Baño de paciente',
                        label: 'Baño asociado a habitación',
                        iluminancia_lux: 200,
                        UGR: 22,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Sala de estar',
                        label: 'Sala de estar y convivencia en zona de hospitalización',
                        iluminancia_lux: 150,
                        UGR: 22,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Ambiente relajante',
                    },
                    {
                        title: 'Estación de enfermería',
                        label: 'Estación de trabajo de enfermería',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos:
                            'Buena visualización de pantallas',
                    },
                ],
            },
            {
                title: 'Zonas quirúrgicas y críticas',
                subsubsections: [
                    {
                        title: 'Quirófano',
                        label: 'Quirófano general',
                        iluminancia_lux: 40000,
                        UGR: 16,
                        Uo: 0.7,
                        Ra: 90,
                        requisitos_especificos:
                            'Iluminación especializada sin sombras, CRI ≥ 90',
                    },
                    {
                        title: 'Sala de recuperación',
                        label: 'Sala de recuperación post-anestésica',
                        iluminancia_lux: 200,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Iluminación atenuable',
                    },
                    {
                        title: 'UCI adulto',
                        label: 'Unidad de Cuidados Intensivos para adultos',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos:
                            'Controlable por el paciente y personal',
                    },
                    {
                        title: 'UCI pediátrica',
                        label: 'Unidad de Cuidados Intensivos pediátrica',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos:
                            'Iluminación suave y controlable',
                    },
                    {
                        title: 'Sala de procedimientos',
                        label: 'Sala de procedimientos quirúrgicos menores',
                        iluminancia_lux: 1000,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 90,
                        requisitos_especificos: 'Iluminación focalizada',
                    },
                    {
                        title: 'Sala de parto',
                        label: 'Sala de atención de parto',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 90,
                        requisitos_especificos: 'Iluminación cálida y clara',
                    },
                ],
            },
            {
                title: 'Consultorios y diagnóstico',
                subsubsections: [
                    {
                        title: 'Consultorio médico',
                        label: 'Consulta externa general',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos: 'Luz neutra, buena definición',
                    },
                    {
                        title: 'Sala de exploración',
                        label: 'Revisión médica y exploración física',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos: 'Uniforme, sin sombras',
                    },
                    {
                        title: 'Laboratorio clínico',
                        label: 'Análisis de muestras biológicas',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 90,
                        requisitos_especificos:
                            'Precisión en reconocimiento de colores',
                    },
                    {
                        title: 'Radiología diagnóstica',
                        label: 'Sala de rayos X, resonancia, tomografía',
                        iluminancia_lux: 100,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos:
                            'Iluminación indirecta para monitores',
                    },
                    {
                        title: 'Ultrasonido',
                        label: 'Sala de ecografía',
                        iluminancia_lux: 200,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Sala de endoscopía',
                        label: 'Procedimientos endoscópicos',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 90,
                        requisitos_especificos: 'Iluminación focal en campo',
                    },
                ],
            },
            {
                title: 'Servicios de apoyo',
                subsubsections: [
                    {
                        title: 'Farmacia',
                        label: 'Dispensación y almacenamiento de medicamentos',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos:
                            'Buena legibilidad de etiquetas',
                    },
                    {
                        title: 'Central de esterilización',
                        label: 'Área de limpieza y esterilización de instrumental',
                        iluminancia_lux: 500,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 90,
                        requisitos_especificos: 'Inspección visual minuciosa',
                    },
                    {
                        title: 'Almacén médico',
                        label: 'Almacén de suministros y equipos médicos',
                        iluminancia_lux: 200,
                        UGR: 25,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Lavandería',
                        label: 'Área de lavado y procesado de ropa hospitalaria',
                        iluminancia_lux: 300,
                        UGR: 22,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Cocina dietética',
                        label: 'Preparación de alimentos para pacientes',
                        iluminancia_lux: 300,
                        UGR: 22,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Higiene y limpieza',
                    },
                ],
            },
            {
                title: 'Zonas de circulación y espera',
                subsubsections: [
                    {
                        title: 'Pasillos generales',
                        label: 'Pasillos de circulación interna',
                        iluminancia_lux: 150,
                        UGR: 22,
                        Uo: 0,
                        Ra: 60,
                        requisitos_especificos: 'Uniformidad y orientación',
                    },
                    {
                        title: 'Vestíbulos',
                        label: 'Vestíbulo de entrada y recepción',
                        iluminancia_lux: 300,
                        UGR: 22,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Buena impresión visual',
                    },
                    {
                        title: 'Salas de espera',
                        label: 'Zonas de espera para pacientes y acompañantes',
                        iluminancia_lux: 200,
                        UGR: 22,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Ambiente cálido y relajante',
                    },
                    {
                        title: 'Ascensores',
                        label: 'Cabinas de ascensor',
                        iluminancia_lux: 100,
                        UGR: 25,
                        Uo: 0.4,
                        Ra: 60,
                        requisitos_especificos: 'Ninguno',
                    },
                    {
                        title: 'Escaleras',
                        label: 'Escaleras de emergencia y circulación',
                        iluminancia_lux: 150,
                        UGR: 25,
                        Uo: 0.4,
                        Ra: 60,
                        requisitos_especificos: 'Iluminancia a nivel del suelo',
                    },
                    {
                        title: 'Estacionamiento cubierto',
                        label: 'Estacionamiento para pacientes y personal',
                        iluminancia_lux: 50,
                        UGR: 28,
                        Uo: 0,
                        Ra: 60,
                        requisitos_especificos: 'Seguridad y vigilancia',
                    },
                ],
            },
            {
                title: 'Zonas administrativas',
                subsubsections: [
                    {
                        title: 'Oficinas',
                        label: 'Oficinas administrativas y dirección',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos: 'Sin reflejos en pantallas',
                    },
                    {
                        title: 'Sala de juntas',
                        label: 'Sala de reuniones y capacitación',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos: 'Controlable',
                    },
                    {
                        title: 'Archivo',
                        label: 'Almacén de expedientes y documentos',
                        iluminancia_lux: 200,
                        UGR: 25,
                        Uo: 0,
                        Ra: 80,
                        requisitos_especificos: 'Acceso fácil a fichas',
                    },
                ],
            },
            {
                title: 'Áreas de emergencia',
                subsubsections: [
                    {
                        title: 'Urgencias triage',
                        label: 'Área de clasificación de pacientes',
                        iluminancia_lux: 300,
                        UGR: 19,
                        Uo: 0.6,
                        Ra: 80,
                        requisitos_especificos: 'Buena visualización',
                    },
                    {
                        title: 'Sala de trauma',
                        label: 'Sala de reanimación y trauma',
                        iluminancia_lux: 1000,
                        UGR: 19,
                        Uo: 0.7,
                        Ra: 90,
                        requisitos_especificos:
                            'Iluminación intensa y sin sombras',
                    },
                    {
                        title: 'Observación',
                        label: 'Área de observación y corta estancia',
                        iluminancia_lux: 200,
                        UGR: 19,
                        Uo: 0.4,
                        Ra: 80,
                        requisitos_especificos: 'Ninguno',
                    },
                ],
            },
        ],
    },
    {
        title: 'Industria',
        subsections: [
            {
                title: 'Almacén y logística',
                subsubsections: [
                    { title: 'Almacén general', label: 'Áreas de almacenamiento y expedición', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'Iluminancia a nivel de pasillo' },
                    { title: 'Zona de embalaje', label: 'Embalaje y etiquetado de mercancías', iluminancia_lux: 300, UGR: 25, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Control de calidad', label: 'Inspección visual y control de calidad', iluminancia_lux: 750, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'Verificar CRI para tareas de color' },
                ],
            },
            {
                title: 'Montaje y fabricación',
                subsubsections: [
                    { title: 'Montaje general', label: 'Líneas de montaje y ensamblaje general', iluminancia_lux: 300, UGR: 25, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Montaje de precisión', label: 'Montaje de piezas de precisión media', iluminancia_lux: 500, UGR: 22, Uo: 0.7, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Montaje de alta precisión', label: 'Electrónica fina, microensamblaje', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'Iluminación suplementaria recomendada' },
                    { title: 'Inspección final', label: 'Inspección visual de producto terminado', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 90, requisitos_especificos: 'CRI ≥ 90 para discriminación de color' },
                ],
            },
            {
                title: 'Zonas de control y proceso',
                subsubsections: [
                    { title: 'Sala de control', label: 'Salas de control de proceso industrial', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Sin reflejos en pantallas' },
                    { title: 'Trabajos con VDT', label: 'Puestos de trabajo con pantalla', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Luminancias de techo ≤ 200 cd/m²' },
                    { title: 'Taller de mantenimiento', label: 'Talleres de mantenimiento industrial', iluminancia_lux: 300, UGR: 25, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                ],
            },
        ],
    },
    {
        title: 'Comercio',
        subsections: [
            {
                title: 'Ventas',
                subsubsections: [
                    { title: 'Zona de ventas general', label: 'Áreas de ventas al público general', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Supermercado', label: 'Supermercado, hipermercado y grandes superficies', iluminancia_lux: 500, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Uniformidad en lineal de productos' },
                    { title: 'Área de cajas', label: 'Cajas registradoras y puntos de cobro', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Escaparate interior', label: 'Vitrinas y escaparates interiores', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 90, requisitos_especificos: 'CRI ≥ 90 para productos de color' },
                    { title: 'Zona de probadores', label: 'Probadores y vestidores de cliente', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Iluminación vertical en rostro' },
                ],
            },
            {
                title: 'Almacén y logística comercial',
                subsubsections: [
                    { title: 'Almacén de tienda', label: 'Almacén trasero y zona de recepción', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'Ninguno' },
                    { title: 'Zona de preparación', label: 'Preparación de pedidos y reposición', iluminancia_lux: 300, UGR: 25, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                ],
            },
        ],
    },
    {
        title: 'Oficinas',
        subsections: [
            {
                title: 'Puestos de trabajo',
                subsubsections: [
                    { title: 'Archivado y circulación', label: 'Archivado, fotocopias y circulación interna', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Escritura y lectura', label: 'Escritura, lectura y procesado de datos', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Sin reflejos especulares en pantallas' },
                    { title: 'Puesto CAD / técnico', label: 'Dibujo técnico asistido por ordenador', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Luminancias controladas en techo' },
                    { title: 'Sala de datos / call center', label: 'Salas de centros de datos y call center', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                ],
            },
            {
                title: 'Salas comunes',
                subsubsections: [
                    { title: 'Sala de conferencias', label: 'Salas de reuniones y conferencias', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Iluminación controlable, iluminancia vertical en presentaciones' },
                    { title: 'Recepción', label: 'Recepción y vestíbulo de oficina', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Sala de descanso', label: 'Comedor y sala de descanso del personal', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Ninguno' },
                ],
            },
        ],
    },
    {
        title: 'Servicios comunales',
        subsections: [
            {
                title: 'Bibliotecas',
                subsubsections: [
                    { title: 'Sala de lectura', label: 'Zona de lectura individual y colectiva', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Sin reflejos especulares en superficies' },
                    { title: 'Estantes y catálogo', label: 'Estanterías de libros y zona de catálogo', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Iluminancia vertical en estantes' },
                ],
            },
            {
                title: 'Museos y exposiciones',
                subsubsections: [
                    { title: 'Sala de exposición permanente', label: 'Sala de exposición de obras y artefactos', iluminancia_lux: 300, UGR: 19, Uo: 0.4, Ra: 90, requisitos_especificos: 'Control UV para obras sensibles; CRI ≥ 90' },
                    { title: 'Sala de exposición temporal', label: 'Sala de exposición temporal y ferial', iluminancia_lux: 500, UGR: 19, Uo: 0.4, Ra: 90, requisitos_especificos: 'CRI ≥ 90' },
                ],
            },
            {
                title: 'Culto y comunidad',
                subsubsections: [
                    { title: 'Iglesia/templo', label: 'Nave principal de iglesia y lugares de culto', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Iluminación controlable y ambiental' },
                    { title: 'Sala multiuso', label: 'Salón comunal, sala polivalente', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Iluminación regulable para múltiples usos' },
                ],
            },
        ],
    },
    {
        title: 'Deportes',
        subsections: [
            {
                title: 'Instalaciones deportivas',
                subsubsections: [
                    { title: 'Gimnasio de entrenamiento', label: 'Pesas, cardio y zona de entrenamiento libre', iluminancia_lux: 300, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Pista polideportiva', label: 'Baloncesto, voleibol, balonmano indoor', iluminancia_lux: 500, UGR: 22, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Piscina cubierta', label: 'Natación y actividades acuáticas cubiertas', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Iluminación resistente a humedad' },
                    { title: 'Squash y tenis de mesa', label: 'Canchas de squash y mesas de ping-pong', iluminancia_lux: 500, UGR: 22, Uo: 0.7, Ra: 80, requisitos_especificos: 'Sin deslumbramiento en dirección de juego' },
                    { title: 'Pista de atletismo indoor', label: 'Atletismo interior y saltos', iluminancia_lux: 750, UGR: 22, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                ],
            },
            {
                title: 'Vestuarios y servicios',
                subsubsections: [
                    { title: 'Vestuarios y duchas', label: 'Vestuarios, duchas y servicios de instalación deportiva', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 80, requisitos_especificos: 'Grado de protección IP65 en duchas' },
                ],
            },
        ],
    },
    {
        title: 'Transporte',
        subsections: [
            {
                title: 'Estaciones',
                subsubsections: [
                    { title: 'Hall principal', label: 'Hall de entrada y distribución de estaciones', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Buena orientación espacial' },
                    { title: 'Andén', label: 'Andenes de tren, metro y autobús', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'Iluminancia a nivel del suelo' },
                    { title: 'Taquillas', label: 'Ventanillas y taquillas de venta', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Ninguno' },
                    { title: 'Sala de espera', label: 'Sala de espera de viajeros', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'Ambiente confortable' },
                ],
            },
        ],
    },
    {
        title: 'Estacionamientos',
        subsections: [
            {
                title: 'Aparcamiento cubierto',
                subsubsections: [
                    { title: 'Zona general de aparcamiento', label: 'Plazas y pasillos de circulación de vehículos', iluminancia_lux: 75, UGR: 28, Uo: 0.25, Ra: 40, requisitos_especificos: 'Mínimo 25 lux en áreas remotas' },
                    { title: 'Zona de entrada y salida', label: 'Acceso, barreras y cabinas de control', iluminancia_lux: 300, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'Adaptación visual al exterior' },
                    { title: 'Rampa de acceso', label: 'Rampas de subida y bajada al aparcamiento', iluminancia_lux: 150, UGR: 28, Uo: 0.25, Ra: 40, requisitos_especificos: 'Transición gradual de iluminancia' },
                    { title: 'Zona peatonal y escaleras', label: 'Pasillos peatonales y escaleras del aparcamiento', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'Iluminación de seguridad permanente' },
                ],
            },
        ],
    },
];

export const iesnaRegulations: RawNormativeBranch[] = [
    {
        title: 'Residential',
        subsections: [
            {
                title: 'General',
                subsubsections: [
                    { title: 'Living Room', label: 'Living room, general lighting', iluminancia_lux: 150, UGR: 19, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. C (IES HB-10)' },
                    { title: 'Dining Room', label: 'Dining room, general lighting', iluminancia_lux: 150, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. C' },
                    { title: 'Kitchen', label: 'Kitchen, general and task lighting', iluminancia_lux: 300, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. D; task: 500 lx' },
                    { title: 'Bedroom', label: 'Bedroom, general lighting', iluminancia_lux: 100, UGR: 19, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. B' },
                    { title: 'Bathroom', label: 'Bathroom, general and vanity lighting', iluminancia_lux: 300, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. D; vertical illuminance at mirror' },
                    { title: 'Home Office', label: 'Home office / study room', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; minimize screen glare' },
                    { title: 'Stairways and Hallways', label: 'Interior stairways, corridors and hallways', iluminancia_lux: 100, UGR: 22, Uo: 0.4, Ra: 60, requisitos_especificos: 'IESNA cat. B' },
                ],
            },
        ],
    },
    {
        title: 'Commercial',
        subsections: [
            {
                title: 'Office',
                subsubsections: [
                    { title: 'Open Office', label: 'Open plan office, intensive VDT use', iluminancia_lux: 400, UGR: 16, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; LEED EQ credit' },
                    { title: 'Private Office', label: 'Private office, reading and writing tasks', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. D' },
                    { title: 'Conference Room', label: 'Conference and meeting rooms', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. D; dimmable system' },
                    { title: 'Reception', label: 'Reception and lobby areas', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. D' },
                    { title: 'Break Room', label: 'Break room and staff lounge', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. D' },
                ],
            },
            {
                title: 'Retail',
                subsubsections: [
                    { title: 'General Sales Area', label: 'General merchandise sales floor', iluminancia_lux: 1000, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. F; accent up to 3000 lx' },
                    { title: 'Grocery Store', label: 'Supermarket and grocery store aisles', iluminancia_lux: 750, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. F' },
                    { title: 'Fitting Rooms', label: 'Dressing rooms and fitting areas', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 90, requisitos_especificos: 'CRI ≥ 90; vertical face illuminance' },
                    { title: 'Checkout', label: 'Point of sale and checkout counters', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E' },
                ],
            },
            {
                title: 'Hospitality',
                subsubsections: [
                    { title: 'Hotel Lobby', label: 'Hotel lobby, atrium and reception', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. D; accent and ambient layers' },
                    { title: 'Hotel Guestroom', label: 'Hotel guestroom, general and task lighting', iluminancia_lux: 150, UGR: 19, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. C; multilevel controls' },
                    { title: 'Restaurant', label: 'Restaurant dining area', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. D; dimmable for ambiance' },
                ],
            },
        ],
    },
    {
        title: 'Educational',
        subsections: [
            {
                title: 'K-12 Schools',
                subsubsections: [
                    { title: 'Classroom', label: 'General classroom, reading and writing tasks', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; dimmable, daylight control' },
                    { title: 'Chalkboard / Whiteboard', label: 'Board area at front of classroom', iluminancia_lux: 500, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'Vertical illuminance; no specular reflections' },
                    { title: 'Art / Craft Room', label: 'Art studio and craft rooms', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 90, requisitos_especificos: 'CRI ≥ 90 for color discrimination' },
                    { title: 'Gymnasium', label: 'School gymnasium and multi-purpose hall', iluminancia_lux: 300, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'IESNA cat. D; glare control upward' },
                    { title: 'Corridors', label: 'School corridors and circulation areas', iluminancia_lux: 150, UGR: 22, Uo: 0.4, Ra: 60, requisitos_especificos: 'IESNA cat. C' },
                ],
            },
            {
                title: 'Higher Education',
                subsubsections: [
                    { title: 'Lecture Hall', label: 'University lecture hall and auditorium', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'Dimmable; vertical illuminance for presentations' },
                    { title: 'Laboratory', label: 'Science and research laboratory', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; task lighting on benches' },
                    { title: 'Library Reading', label: 'Library reading room and study areas', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; glare-free' },
                ],
            },
        ],
    },
    {
        title: 'Healthcare',
        subsections: [
            {
                title: 'Patient Areas',
                subsubsections: [
                    { title: 'Patient Room', label: 'General patient room, ambient lighting', iluminancia_lux: 150, UGR: 19, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. C; dimmable night mode' },
                    { title: 'Examination Room', label: 'Medical examination and procedure room', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; shadow-free' },
                    { title: 'Nurse Station', label: 'Nursing station and charting area', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E' },
                    { title: 'Waiting Room', label: 'Patient and visitor waiting room', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'IESNA cat. D; comfortable atmosphere' },
                ],
            },
            {
                title: 'Surgical and Critical',
                subsubsections: [
                    { title: 'Operating Room', label: 'General operating room ambient lighting', iluminancia_lux: 1000, UGR: 16, Uo: 0.7, Ra: 90, requisitos_especificos: 'IESNA cat. F; surgical field: 2000–5000 lx; shadowless' },
                    { title: 'ICU', label: 'Intensive Care Unit, adult and pediatric', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. D; dimmable' },
                    { title: 'Emergency Room', label: 'Emergency and trauma treatment area', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; high CRI for skin assessment' },
                ],
            },
            {
                title: 'Ancillary',
                subsubsections: [
                    { title: 'Pharmacy', label: 'Pharmacy dispensing and storage', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E; good label legibility' },
                    { title: 'Clinical Laboratory', label: 'Clinical lab, specimen analysis', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 90, requisitos_especificos: 'CRI ≥ 90; color accuracy critical' },
                ],
            },
        ],
    },
    {
        title: 'Industrial',
        subsections: [
            {
                title: 'Warehouse and Storage',
                subsubsections: [
                    { title: 'Warehouse Aisles', label: 'Warehouse aisle and circulation areas', iluminancia_lux: 100, UGR: 28, Uo: 0.3, Ra: 60, requisitos_especificos: 'IESNA cat. B; vertical on shelves' },
                    { title: 'Warehouse Shelves', label: 'Rack storage, picking and shelving', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'IESNA cat. D' },
                    { title: 'Loading Dock', label: 'Loading dock and receiving areas', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'IESNA cat. D' },
                ],
            },
            {
                title: 'Manufacturing',
                subsubsections: [
                    { title: 'Assembly – Rough', label: 'Rough assembly, coarse work', iluminancia_lux: 300, UGR: 25, Uo: 0.5, Ra: 60, requisitos_especificos: 'IESNA cat. D' },
                    { title: 'Assembly – Medium', label: 'Medium assembly, moderate precision', iluminancia_lux: 500, UGR: 22, Uo: 0.6, Ra: 80, requisitos_especificos: 'IESNA cat. E' },
                    { title: 'Assembly – Fine', label: 'Fine assembly, high precision work', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'IESNA cat. F; supplementary task lighting' },
                    { title: 'Inspection', label: 'Visual inspection of finished product', iluminancia_lux: 1500, UGR: 19, Uo: 0.7, Ra: 90, requisitos_especificos: 'IESNA cat. G; CRI ≥ 90' },
                ],
            },
        ],
    },
];

/** Normativa peruana — RNE EM.010 / Código Nacional de Electricidad (CNE) Utilización */
export const rnePeruRegulations: RawNormativeBranch[] = [
    {
        title: 'Vivienda',
        subsections: [
            {
                title: 'Ambientes privados',
                subsubsections: [
                    { title: 'Sala de estar', label: 'Sala de estar y living general', iluminancia_lux: 150, UGR: null, Uo: null, Ra: 80, requisitos_especificos: 'RNE EM.010 / CNE Utilización Tabla 800-D' },
                    { title: 'Comedor', label: 'Comedor y zona de alimentación', iluminancia_lux: 150, UGR: null, Uo: null, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Dormitorio', label: 'Dormitorio y cuarto de descanso', iluminancia_lux: 100, UGR: null, Uo: null, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Cocina', label: 'Cocina y zona de preparación de alimentos', iluminancia_lux: 300, UGR: null, Uo: null, Ra: 80, requisitos_especificos: 'RNE EM.010; tarea: 500 lx sobre mesada' },
                    { title: 'Baño', label: 'Baño, ducha y servicios sanitarios', iluminancia_lux: 150, UGR: null, Uo: null, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Pasillo y escalera interior', label: 'Pasillo, hall y escalera interior de vivienda', iluminancia_lux: 100, UGR: null, Uo: null, Ra: 60, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Garaje privado', label: 'Garaje y estacionamiento privado techado', iluminancia_lux: 50, UGR: null, Uo: null, Ra: 40, requisitos_especificos: 'RNE EM.010' },
                ],
            },
            {
                title: 'Zonas comunes de edificio',
                subsubsections: [
                    { title: 'Vestíbulo de ingreso', label: 'Hall y vestíbulo de edificio multifamiliar', iluminancia_lux: 100, UGR: 22, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010; obligatorio iluminación de emergencia' },
                    { title: 'Pasillo común', label: 'Pasillo y circulación común de edificio', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Escalera común', label: 'Escalera de uso común y evacuación', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'RNE EM.010; iluminación emergencia obligatoria en ruta de evacuación' },
                ],
            },
        ],
    },
    {
        title: 'Educación',
        subsections: [
            {
                title: 'Educación básica y técnica',
                subsubsections: [
                    { title: 'Aula de enseñanza', label: 'Aula general de enseñanza y lectura', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; iluminación regulable recomendada' },
                    { title: 'Tablero/pizarra', label: 'Superficie de pizarra y tablero del aula', iluminancia_lux: 500, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'RNE EM.010; evitar reflexiones especulares' },
                    { title: 'Sala de lectura / biblioteca', label: 'Sala de lectura y biblioteca escolar', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Laboratorio de ciencias', label: 'Laboratorio escolar de ciencias y química', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Taller de enseñanza', label: 'Taller técnico y de artes manuales', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Sala de dibujo técnico', label: 'Sala de dibujo técnico y arquitectura', iluminancia_lux: 750, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Sala de informática / cómputo', label: 'Sala de cómputo y laboratorio de sistemas', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; sin reflejos en pantallas' },
                    { title: 'Auditorio / salón de actos', label: 'Auditorio y sala de usos múltiples educativa', iluminancia_lux: 300, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'RNE EM.010; iluminación regulable' },
                    { title: 'Pasillo y circulación', label: 'Pasillos y zonas de circulación del centro educativo', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Entrada institucional techada', label: 'Ingreso principal de institución educativa con techo, alero o marquesina', iluminancia_lux: 150, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010; zona de transición exterior-interior bajo cubierta' },
                    { title: 'Patio educativo', label: 'Patio de formación, recreación y circulación exterior de institución educativa', iluminancia_lux: 50, UGR: null, Uo: 0.25, Ra: 40, requisitos_especificos: 'RNE EM.010; controlar deslumbramiento y contaminación lumínica' },
                    { title: 'Patio con columnas y tejado', label: 'Patio techado con columnas, galería, pórtico o corredor cubierto', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010; verificar sombras proyectadas por columnas y estructura de cubierta' },
                ],
            },
        ],
    },
    {
        title: 'Salud',
        subsections: [
            {
                title: 'Hospitalización',
                subsubsections: [
                    { title: 'Habitación de paciente (general)', label: 'Iluminación ambiental general de habitación', iluminancia_lux: 100, UGR: 19, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010; regulable para descanso (mín. 1 lx)' },
                    { title: 'Habitación de paciente (lectura/examen)', label: 'Iluminación de tarea en cabecera de cama', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                ],
            },
            {
                title: 'Zonas quirúrgicas y críticas',
                subsubsections: [
                    { title: 'Sala de operaciones (general)', label: 'Iluminación ambiental de quirófano', iluminancia_lux: 500, UGR: 16, Uo: 0.7, Ra: 90, requisitos_especificos: 'RNE EM.010; campo quirúrgico: 10 000–40 000 lx con lámpara cialítica' },
                    { title: 'UCI', label: 'Unidad de Cuidados Intensivos', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; controlable por personal y paciente' },
                    { title: 'Urgencias / emergencias', label: 'Área de urgencias y triage', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                ],
            },
            {
                title: 'Consulta y diagnóstico',
                subsubsections: [
                    { title: 'Consultorio médico', label: 'Consultorio de atención ambulatoria', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; luz neutra 4000 K recomendada' },
                    { title: 'Laboratorio clínico', label: 'Análisis de muestras biológicas', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 90, requisitos_especificos: 'RNE EM.010; CRI ≥ 90 para reconocimiento de color' },
                    { title: 'Farmacia', label: 'Dispensación y almacenamiento de medicamentos', iluminancia_lux: 300, UGR: 19, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010; buena legibilidad de etiquetas' },
                ],
            },
            {
                title: 'Circulación y espera',
                subsubsections: [
                    { title: 'Pasillo de hospital', label: 'Corredores de circulación interna', iluminancia_lux: 100, UGR: 22, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010; iluminación nocturna reducida' },
                    { title: 'Sala de espera', label: 'Sala de espera de pacientes y acompañantes', iluminancia_lux: 200, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010; ambiente cálido y confortable' },
                ],
            },
        ],
    },
    {
        title: 'Oficinas',
        subsections: [
            {
                title: 'Puestos de trabajo',
                subsubsections: [
                    { title: 'Escritura y lectura', label: 'Escritura, lectura y mecanografía', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010 / CNE Utilización; sin deslumbramiento en pantallas' },
                    { title: 'Procesamiento de datos', label: 'Puesto de trabajo con computador (VDT)', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; luminancias en techo ≤ 200 cd/m²' },
                    { title: 'Sala de cómputo', label: 'Sala de servidores, data center y sala de sistemas', iluminancia_lux: 300, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Archivo', label: 'Archivo y almacén de documentos', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                ],
            },
            {
                title: 'Salas comunes',
                subsubsections: [
                    { title: 'Sala de conferencias', label: 'Sala de reuniones y conferencias', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010; regulable para presentaciones' },
                    { title: 'Recepción / vestíbulo', label: 'Recepción y zona de atención al público', iluminancia_lux: 300, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Pasillo de oficina', label: 'Pasillos de circulación interna de oficina', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'RNE EM.010' },
                ],
            },
        ],
    },
    {
        title: 'Comercio',
        subsections: [
            {
                title: 'Zonas de venta',
                subsubsections: [
                    { title: 'Tienda general (zona de ventas)', label: 'Zona de ventas de tienda al por menor', iluminancia_lux: 500, UGR: 22, Uo: 0.4, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Supermercado / hipermercado', label: 'Grandes superficies de alimentación y bazar', iluminancia_lux: 750, UGR: 22, Uo: 0.5, Ra: 80, requisitos_especificos: 'RNE EM.010; uniformidad en lineal' },
                    { title: 'Área de cajas', label: 'Cajas y puntos de cobro', iluminancia_lux: 500, UGR: 19, Uo: 0.6, Ra: 80, requisitos_especificos: 'RNE EM.010' },
                    { title: 'Escaparate interior', label: 'Vitrinas y exhibición de productos', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 90, requisitos_especificos: 'RNE EM.010; CRI ≥ 90' },
                    { title: 'Almacén comercial', label: 'Almacén y depósito de tienda comercial', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010' },
                ],
            },
        ],
    },
    {
        title: 'Industria',
        subsections: [
            {
                title: 'Por tipo de tarea visual',
                subsubsections: [
                    { title: 'Almacén general', label: 'Almacenes, depósitos y zonas de expedición', iluminancia_lux: 100, UGR: 28, Uo: 0.25, Ra: 40, requisitos_especificos: 'CNE Utilización Tabla 800-D – Clase E' },
                    { title: 'Trabajo tosco (sin detalle)', label: 'Trabajo industrial sin requisito de detalle visual', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'CNE Utilización – Clase D' },
                    { title: 'Trabajo de detalle grueso', label: 'Trabajo industrial con detalle grueso', iluminancia_lux: 300, UGR: 25, Uo: 0.5, Ra: 60, requisitos_especificos: 'CNE Utilización – Clase C' },
                    { title: 'Trabajo de detalle normal', label: 'Trabajo industrial normal (ensamblaje, control)', iluminancia_lux: 500, UGR: 22, Uo: 0.6, Ra: 80, requisitos_especificos: 'CNE Utilización – Clase B' },
                    { title: 'Trabajo de precisión', label: 'Trabajo de precisión (mecánica fina, electrónica)', iluminancia_lux: 750, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'CNE Utilización – Clase A; iluminación suplementaria' },
                    { title: 'Trabajo de alta precisión', label: 'Micromecánica, joyería, circuitos impresos', iluminancia_lux: 1000, UGR: 19, Uo: 0.7, Ra: 80, requisitos_especificos: 'CNE Utilización – Clase A especial; lupa o iluminación puntual' },
                ],
            },
        ],
    },
    {
        title: 'Estacionamientos',
        subsections: [
            {
                title: 'Estacionamiento cubierto',
                subsubsections: [
                    { title: 'Zona general de vehículos', label: 'Plazas y pasillos de circulación vehicular bajo techo', iluminancia_lux: 75, UGR: 28, Uo: 0.25, Ra: 40, requisitos_especificos: 'RNE EM.010 / CNE; iluminación de emergencia obligatoria' },
                    { title: 'Zona de ingreso/egreso', label: 'Acceso, rampa de entrada y caseta de control', iluminancia_lux: 200, UGR: 25, Uo: 0.4, Ra: 60, requisitos_especificos: 'RNE EM.010; adaptación visual al exterior' },
                    { title: 'Zona peatonal y escaleras', label: 'Pasillos peatonales, escaleras y ascensores', iluminancia_lux: 100, UGR: 25, Uo: 0.4, Ra: 40, requisitos_especificos: 'RNE EM.010; señalización luminosa de evacuación' },
                ],
            },
            {
                title: 'Estacionamiento abierto',
                subsubsections: [
                    { title: 'Estacionamiento exterior', label: 'Playa de estacionamiento al aire libre', iluminancia_lux: 30, UGR: null, Uo: 0.25, Ra: 40, requisitos_especificos: 'RNE EM.010 / DS-015-2017-EM eficiencia; control de contaminación lumínica' },
                ],
            },
        ],
    },
];

// ─── EN 1838:2013 — Alumbrado de emergencia ─────────────────────────────────
// Dataset estático de respaldo (fallback offline); la fuente única de verdad
// es la BD (dialux_normative_requirements, standard='en_1838'), cargada en
// runtime vía ensureStandardDataLoaded('en_1838') — ver normativeRemoteData.ts.
// Fase 14 (plan maestro §11): edición corregida de "2019" (inexistente) a
// "2013" — ver EN_1838_DISCLAIMER en normativeEngine.ts para el detalle.
// Esta norma NO tiene adopción legal en Perú — ver a130Regulations abajo
// para la fuente obligatoria peruana.
export const en1838Regulations: RawNormativeBranch[] = [
    {
        title: 'Rutas de evacuación',
        subsections: [
            {
                title: 'Eje central de la ruta de evacuación (ancho ≤ 2 m)',
                label: 'Eje central de la ruta de evacuación',
                iluminancia_lux: 1,
                UGR: null,
                Uo: null,
                Ra: 40,
                requisitos_especificos: 'Uniformidad Emax:Emin ≤ 40:1; 50% del nivel en 5 s y 100% en 60 s; autonomía mínima 1 hora',
            },
            {
                title: 'Escaleras en ruta de evacuación (ancho completo)',
                label: 'Escaleras en ruta de evacuación',
                iluminancia_lux: 1,
                UGR: null,
                Uo: null,
                Ra: 40,
                requisitos_especificos: 'Iluminancia mínima en todo el ancho del tramo, no solo en el eje; uniformidad Emax:Emin ≤ 40:1',
            },
            {
                title: 'Puntos de seguridad (alarmas, extintores, primeros auxilios)',
                label: 'Puntos de seguridad',
                iluminancia_lux: 5,
                UGR: null,
                Uo: null,
                Ra: 40,
                requisitos_especificos: 'Iluminancia mínima dentro de un radio de 2 m del equipo, a nivel del suelo',
            },
        ],
    },
    {
        title: 'Áreas antipánico (zonas abiertas ≥ 60 m²)',
        subsections: [
            {
                title: 'Núcleo del área (excluyendo banda perimetral de 0.5 m)',
                label: 'Núcleo del área antipánico',
                iluminancia_lux: 0.5,
                UGR: null,
                Uo: null,
                Ra: 40,
                requisitos_especificos: 'Uniformidad Emax:Emin ≤ 40:1; 50% del nivel en 5 s y 100% en 60 s; autonomía mínima 1 hora',
            },
        ],
    },
    {
        title: 'Zonas de tareas de alto riesgo',
        subsections: [
            {
                title: 'Zona de tarea de alto riesgo — nivel general',
                label: 'Zona de tarea de alto riesgo',
                iluminancia_lux: 15,
                UGR: null,
                Uo: 0.1,
                Ra: 40,
                requisitos_especificos: 'El mayor entre 10% del nivel normal de la tarea o 15 lx; sin demora — disponible de forma instantánea',
            },
        ],
    },
];

// ─── RNE A.130 (D.S. N°017-2012-VIVIENDA), Arts. 39-41 — Alumbrado de
// emergencia en Perú ─────────────────────────────────────────────────────────
// Fase 14 (plan maestro §11): fuente OBLIGATORIA real para alumbrado de
// emergencia en proyectos peruanos — verificada contra el texto completo del
// documento oficial (no un resumen de buscador). RNE EM.010 (rnePeruRegulations,
// arriba en este archivo) NO contiene ningún artículo de emergencia — no
// citarla para este dominio. A.130 no define áreas antipánico ni relación de
// uniformidad; esos conceptos solo existen en EN 1838 (en1838Regulations,
// arriba), ofrecido como referencia complementaria, nunca fusionado con estos
// valores. Dataset estático de respaldo (fallback offline); la fuente única de
// verdad es la BD (dialux_normative_requirements, standard='rne_a130'),
// cargada en runtime vía ensureStandardDataLoaded('rne_a130').
export const a130Regulations: RawNormativeBranch[] = [
    {
        title: 'Medios de evacuación (Art. 40)',
        subsections: [
            {
                title: 'Iluminación de emergencia de los medios de evacuación',
                label: 'Medios de evacuación',
                iluminancia_lux: 10,
                UGR: null,
                Uo: null,
                Ra: null,
                requisitos_especificos: 'Medida a nivel del suelo; autonomía mínima 1½ hora ante corte de fluido eléctrico; transferencia automática de energía en máximo 10 s; el sistema debe diseñarse para que la falla de una sola lámpara no deje áreas en completa oscuridad; conexión según CNE Tomo V (Utilización) Art. 7.1.2.1 (artículo específico no verificado en este sistema); alimentado por un circuito que sirve normalmente el área, conectado antes que cualquier interruptor local.',
            },
        ],
    },
    {
        title: 'Señalización de evacuación (Art. 39)',
        subsections: [
            {
                title: 'Nivel de iluminación de las señales de salida',
                label: 'Señalización de salida',
                iluminancia_lux: 50,
                UGR: null,
                Uo: null,
                Ra: null,
                requisitos_especificos: 'Iluminancia sobre el propio letrero de señalización (natural o artificial), no sobre la ruta de circulación — no confundir con el requisito de 10 lx a nivel de piso del Art. 40. Señalización según NTP 399.010-1; señal "NO USAR EN CASOS DE EMERGENCIA" en ascensores (Art. 39); señales luminosas sobre el dintel de las salidas en establecimientos con concurrencia de público (Art. 41).',
            },
        ],
    },
];
