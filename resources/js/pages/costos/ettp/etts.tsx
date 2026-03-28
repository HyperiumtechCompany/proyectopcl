import React, { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import toastr from 'toastr';
import 'toastr/build/toastr.min.css';
import {
    Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, PageNumber,
    BorderStyle, SectionType, Table, TableRow, TableCell, WidthType, ImageRun, UnderlineType, VerticalAlign
} from 'docx';
import { saveAs } from 'file-saver';
declare const Tabulator: any;

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface Props {
    especificacionesId?: number;
    initialData?: any;
    proyecto?: any;
}

interface Section {
    title: string;
    content: string;
}

// ─────────────────────────────────────────────
// DATOS POR DEFECTO (cuando no hay datos del servidor)
// ─────────────────────────────────────────────

const DEFAULT_DATA = [
    {
        id: 1,
        item: '05',
        descripcion: 'INSTALACIONES ELECTRICAS',
        unidad: '',
        _children: [
            {
                id: 2,
                item: '05.01',
                descripcion: 'CONEXION A LA RED EXTERNA DE SUMINISTRO DE ENERGIA ELECTRICA',
                unidad: '',
                _children: [
                    {
                        id: 3,
                        item: '05.01.01',
                        descripcion: 'ACOMETIDA MONO.FÁSICA DE ENERGÍA ELÉCTRICA DE RED SECUNDARIA CON MEDIDOR.',
                        unidad: 'GLB',
                    },
                    {
                        id: 4,
                        item: '05.01.02',
                        descripcion: 'Acondicionamiento de tubo de FG, tubo PVC y baston para acometida.',
                        unidad: 'GLB',
                    },
                ],
            },
        ],
    },
];

// ─────────────────────────────────────────────
// CAMPOS DEL JSON DE TEMPLATES QUE SE EXCLUYEN
// al copiar al detallesTecnicos (son metadatos, no contenido técnico)
// ─────────────────────────────────────────────

const CAMPOS_EXCLUIDOS_TEMPLATE = [
    'codigo',
    'codigo_completo',
    'nivel',
    'subpartidas',
    'titulo',
    'unidad_medida',
    'codigo_original',
];

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

const EttpIndex = ({ especificacionesId, initialData, proyecto }: Props) => {

    // ── Refs ──────────────────────────────────
    const tableRef = useRef<HTMLDivElement>(null);   // contenedor DOM de Tabulator
    const tabulatorRef = useRef<any>(null);              // instancia de Tabulator
    /**
     * templatesRef: soluciona el "closure stale".
     * El cellClick de Tabulator se crea UNA VEZ al montar la tabla.
     * Si usáramos solo useState, el click siempre vería el array vacío inicial.
     * Con useRef, siempre lee el valor actualizado.
     */
    const templatesRef = useRef<any[]>([]);
    // ── Estado ────────────────────────────────
    const [datosBase, setDatosBase] = useState(initialData || DEFAULT_DATA);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [currentData, setCurrentData] = useState<any>(null);
    const [currentSections, setCurrentSections] = useState<Section[]>([]);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [showMetradosPanel, setShowMetradosPanel] = useState(false);
    const [showWordModal, setShowWordModal] = useState(false);
    const [generatingWord, setGeneratingWord] = useState(false); // 👈 ESTA ES LA LÍNEA QUE FALTA
    const [selectedSections, setSelectedSections] = useState({
        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });

    // ─────────────────────────────────────────
    // UTILIDADES
    // ─────────────────────────────────────────

    /** Notificación con toastr o SweetAlert como fallback */
    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        if (toastr) {
            toastr[type](message);
        } else {
            Swal.fire({
                title: type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Éxito',
                text: message,
                icon: type,
            });
        }
    };

    /** Token CSRF para peticiones POST */
    const getCsrfToken = (): string =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    // ─────────────────────────────────────────
    // BÚSQUEDA DE TEMPLATES
    // ─────────────────────────────────────────

    /**
     * Búsqueda recursiva en el árbol de templates.
     * Estrategia:
     *   1. Búsqueda EXACTA por `codigo` (normalizado a minúsculas)
     *   2. Si no encuentra, búsqueda PARCIAL como fallback
     * Esto resuelve el problema de comparación que tenía el código original.
     */
    const buscarTemplateRecursivo = (templates: any[], codigoABuscar: string): any => {
        if (!templates?.length) return null;

        const codigoNorm = codigoABuscar.toString().trim().toLowerCase();

        const buscarEnNivel = (items: any[]): any => {
            if (!items?.length) return null;

            // 1. Búsqueda exacta
            for (const item of items) {
                const codigoItem = item.codigo?.toString().trim().toLowerCase();
                const codigoCompleto = item.codigo_completo?.toString().trim().toLowerCase();

                if (codigoItem === codigoNorm || codigoCompleto === codigoNorm) {
                    return item;
                }

                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            // 2. Búsqueda parcial como fallback
            for (const item of items) {
                const codigoItem = item.codigo?.toString().trim().toLowerCase();
                const codigoCompleto = item.codigo_completo?.toString().trim().toLowerCase();

                if (codigoItem?.includes(codigoNorm) || codigoCompleto?.includes(codigoNorm)) {
                    return item;
                }

                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            return null;
        };

        let resultado = buscarEnNivel(templates);

        // 3. Si el código tiene espacios, intentar solo la parte numérica
        if (!resultado && codigoABuscar.includes(' ')) {
            const codigoNumerico = codigoABuscar.split(' ')[0];
            resultado = buscarEnNivel(templates);
            console.log(`[Templates] Búsqueda secundaria con código numérico: ${codigoNumerico}`);
        }

        return resultado;
    };

    // ─────────────────────────────────────────
    // PANEL DE DETALLES TÉCNICOS
    // ─────────────────────────────────────────

    /**
     * Convierte los detallesTecnicos de una fila en el array de secciones
     * que muestra el panel lateral. Si no hay detalles, genera secciones vacías por defecto.
     */
    const buildSections = (detallesTecnicos: Record<string, any>): Section[] => {
        // Si no hay detalles, devolver secciones vacías por defecto
        if (!detallesTecnicos || Object.keys(detallesTecnicos).length === 0) {
            return [
                { title: 'Descripción', content: '' },
                { title: 'Materiales y Herramientas', content: '' },
                { title: 'Método de Ejecución', content: '' },
                { title: 'Método de Medición', content: '' },
                { title: 'Condiciones de Pago', content: '' },
            ];
        }

        const sections: Section[] = [];

        // Mapear campos específicos de tu JSON a títulos legibles
        const fieldMapping = [
            { jsonKey: 'descripción', title: 'Descripción' },
            { jsonKey: 'descripcion', title: 'Descripción' },
            { jsonKey: 'materiales,_herramientas_y/o_equipos', title: 'Materiales y Herramientas' },
            { jsonKey: 'materiales', title: 'Materiales' },
            { jsonKey: 'método_de_ejecución', title: 'Método de Ejecución' },
            { jsonKey: 'metodo_de_ejecucion', title: 'Método de Ejecución' },
            { jsonKey: 'método_de_medición', title: 'Método de Medición' },
            { jsonKey: 'metodo_de_medicion', title: 'Método de Medición' },
            { jsonKey: 'condiciones_de_pago', title: 'Condiciones de Pago' },
        ];

        // Primero agregar los campos mapeados
        for (const { jsonKey, title } of fieldMapping) {
            if (detallesTecnicos[jsonKey]) {
                sections.push({ title, content: detallesTecnicos[jsonKey] });
            }
        }

        // Luego agregar cualquier otro campo que no esté en el mapeo
        Object.entries(detallesTecnicos).forEach(([key, value]) => {
            const isMapped = fieldMapping.some(m => m.jsonKey === key);
            if (!isMapped && value && typeof value === 'string') {
                sections.push({
                    title: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    content: value,
                });
            }
        });

        return sections;
    };

    /**
     * Abre el panel lateral de detalles para una fila.
     * Lee templatesRef (no state) para evitar el closure stale.
     */
    const showDescription = (row: any) => {
        const data = row.getData();
        setSelectedRow(row);
        setCurrentData(data);

        console.log(`[Detalles] Item seleccionado: ${data.item}`);
        console.log(`[Detalles] Templates disponibles: ${templatesRef.current.length}`);

        // Si no hay templates cargados, abrir formulario vacío/con datos existentes
        if (!templatesRef.current.length) {
            console.warn('[Detalles] No hay templates cargados aún');
            setCurrentSections(buildSections(data.detallesTecnicos || {}));
            setShowDetailsPanel(true);
            return;
        }

        const template = buscarTemplateRecursivo(templatesRef.current, data.item);
        console.log(`[Detalles] Template encontrado: ${template ? 'SÍ' : 'NO'}`);

        if (template) {
            // Preguntar si cargar la plantilla encontrada
            Swal.fire({
                title: '¡Plantilla encontrada!',
                text: `Se encontró una plantilla para "${data.item}". ¿Desea cargar los detalles?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Sí, cargar',
                cancelButtonText: 'No',
            }).then(result => {
                if (result.isConfirmed) {
                    // Copiar todos los campos del template excepto los metadatos
                    const detallesTecnicos: Record<string, any> = {};
                    Object.keys(template).forEach(campo => {
                        if (!CAMPOS_EXCLUIDOS_TEMPLATE.includes(campo)) {
                            detallesTecnicos[campo] = template[campo];
                        }
                    });
                    data.detallesTecnicos = detallesTecnicos;
                    row.update(data);
                }
                setCurrentSections(buildSections(data.detallesTecnicos || {}));
                setShowDetailsPanel(true);
            });
        } else {
            // Sin plantilla: abrir con datos existentes o vacío
            setCurrentSections(buildSections(data.detallesTecnicos || {}));
            setShowDetailsPanel(true);
        }
    };

    /**
     * Guarda las secciones editadas del panel de vuelta en la fila de Tabulator.
     */
    const saveDescription = () => {
        if (!selectedRow) {
            showNotification('error', 'No hay una fila seleccionada');
            return;
        }

        const detallesTecnicos: Record<string, string> = {};
        currentSections.forEach(section => {
            const key = section.title.toLowerCase().replace(/ /g, '_');
            detallesTecnicos[key] = section.content;
        });

        const rowData = selectedRow.getData();
        rowData.detallesTecnicos = detallesTecnicos;
        selectedRow.update(rowData);

        Swal.fire({
            title: '¡Guardado!',
            text: 'Los detalles técnicos se actualizaron correctamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
        });

        setShowDetailsPanel(false);
    };

    //insertar imagen
    const insertImage = (sectionIdx: number) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgHtml = `<img src="${event.target?.result}" style="max-width:100%; margin:10px 0; border-radius:8px;" />`;
                    const newSections = [...currentSections];
                    newSections[sectionIdx].content += imgHtml;
                    setCurrentSections(newSections);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    // ─────────────────────────────────────────
    // CARGA DE METRADOS
    // ─────────────────────────────────────────

    /**
     * Llama al endpoint para obtener datos de metrados según las especialidades seleccionadas.
     */
    const fetchMetradosData = async (proyectoId: string, options: Record<string, number>) => {
        try {
            const response = await axios.post(
                '/obtener-metrados-ettp',
                { proyecto_id: proyectoId, ...options },
                { headers: { 'X-CSRF-TOKEN': getCsrfToken(), 'Content-Type': 'application/json' } }
            );
            return response.data;
        } catch (error) {
            console.error('[Metrados] Error en el endpoint:', error);
            return [];
        }
    };

    /**
     * Handler del botón "Cargar Datos Seleccionados".
     * Valida que la tabla esté lista y que haya al menos una especialidad seleccionada.
     */
    const handleLoadMetrados = async () => {
        // Verificar que la tabla esté inicializada
        if (!tabulatorRef.current) {
            console.warn('[Metrados] Tabla no inicializada, esperando...');
            setTimeout(handleLoadMetrados, 500);
            return;
        }

        const proyectoId = (document.getElementById('proyecto_id') as HTMLInputElement)?.value
            || proyecto?.id;

        if (!proyectoId) {
            showNotification('error', 'Debe seleccionar un proyecto');
            return;
        }

        const options = {
            estructura: selectedSections.estructura ? 1 : 0,
            arquitectura: selectedSections.arquitectura ? 1 : 0,
            sanitarias: selectedSections.sanitarias ? 1 : 0,
            electricas: selectedSections.electricas ? 1 : 0,
            comunicacion: selectedSections.comunicaciones ? 1 : 0,
            gas: selectedSections.gas ? 1 : 0,
        };

        if (!Object.values(options).some(v => v === 1)) {
            showNotification('error', 'Seleccione al menos una categoría');
            return;
        }

        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const rawData = await fetchMetradosData(proyectoId, options);
            Swal.close();


            if (!rawData?.length) {
                showNotification('warning', 'No se encontraron datos para las especialidades seleccionadas');
                return;
            }

            // 👇 IMPORTANTE: Solo actualizamos el estado, NO llamamos a replaceData directamente
            setDatosBase(rawData);
            showNotification('success', `✅ Se cargaron ${rawData.length} registros`);

        } catch (error) {
            Swal.close();
            console.error('[Metrados] Error:', error);
            showNotification('error', 'Error al cargar los datos');
        }
    };

    // ─────────────────────────────────────────
    // GUARDAR EN SERVIDOR
    // ─────────────────────────────────────────

    /**
     * Envía todos los datos actuales de la tabla al servidor.
     */
    const handleSaveData = async () => {
        const idProyecto = especificacionesId || proyecto?.id;

        if (!idProyecto) {
            showNotification('error', 'ID de proyecto no encontrado');
            return;
        }

        if (!tabulatorRef.current) return;

        const datosGenerales = tabulatorRef.current.getData();

        try {
            await axios.post(
                `/guardar-especificaciones-tecnicas/${idProyecto}`,
                { especificaciones_tecnicas: datosGenerales },
                { headers: { 'X-CSRF-TOKEN': getCsrfToken() } }
            );
            Swal.fire({ title: 'Éxito', text: 'Datos guardados correctamente', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            console.error('[Guardar] Error:', error.response?.data);
            Swal.fire({ title: 'Error', text: error.response?.data?.error || 'No se pudieron guardar los datos', icon: 'error' });
        }
    };

    // ─────────────────────────────────────────
    // CARGAR DATOS DEL SERVIDOR AL MONTAR
    // ─────────────────────────────────────────

    const loadDataFromServer = async () => {
        if (!especificacionesId) return;

        try {
            const response = await axios.post(
                '/obtener-especificaciones-tecnicas',
                { id: especificacionesId },
                { headers: { 'X-CSRF-TOKEN': getCsrfToken() } }
            );

            if (response.data?.data) {
                const parsed = typeof response.data.data === 'string'
                    ? JSON.parse(response.data.data)
                    : response.data.data;

                const dataToSet = Array.isArray(parsed) ? parsed : DEFAULT_DATA;
                setDatosBase(dataToSet);
                if (tabulatorRef.current) tabulatorRef.current.setData(dataToSet);
            }
        } catch (error) {
            console.error('[Servidor] Error cargando datos:', error);
        }
    };

    // ─────────────────────────────────────────
    // GENERAR WORD
    // ─────────────────────────────────────────

    // Función para filtrar datos jerárquicos por sección
    const filterTreeData = (data: any[], sectionName: string): any[] => {
        if (!data || !Array.isArray(data)) return [];

        // Mapeo de nombres de sección a palabras clave para filtrar
        const sectionKeywords: Record<string, string[]> = {
            'ESTRUCTURAS': ['estructura', 'concreto', 'acero', 'cimentación', 'columna', 'viga'],
            'ARQUITECTURA': ['arquitectura', 'acabado', 'piso', 'cielorraso', 'tabique', 'revoque'],
            'INSTALACIONES SANITARIAS': ['sanitaria', 'agua', 'desagüe', 'tubería', 'cisterna', 'tanque'],
            'INSTALACIONES ELECTRICAS': ['eléctrica', 'eléctrico', 'electricas', 'alumbrado', 'tomacorriente', 'tablero'],
            'INSTALACIONES DE COMUNICACIONES': ['comunicacion', 'comunicaciones', 'datos', 'teléfono', 'red'],
            'INSTALACIONES DE GAS': ['gas', 'gasfitería', 'tubería de gas']
        };

        const keywords = sectionKeywords[sectionName] || [];

        const filterItems = (items: any[]): any[] => {
            if (!items) return [];

            return items.reduce((acc: any[], item: any) => {
                // Verificar si el item coincide con la sección
                const descripcion = (item.descripcion || '').toLowerCase();
                const itemCode = (item.item || '').toLowerCase();

                const matches = keywords.some(keyword =>
                    descripcion.includes(keyword.toLowerCase()) ||
                    itemCode.includes(keyword.toLowerCase())
                );

                if (matches) {
                    // Si el item actual coincide, lo agregamos completo
                    acc.push({ ...item });
                } else if (item._children && item._children.length > 0) {
                    // Si no coincide pero tiene hijos, filtramos los hijos
                    const filteredChildren = filterItems(item._children);
                    if (filteredChildren.length > 0) {
                        acc.push({
                            ...item,
                            _children: filteredChildren
                        });
                    }
                }

                return acc;
            }, []);
        };

        return filterItems(data);
    };

  const handleGenerateWord = () => {
    // Verificar que la tabla esté lista
    if (!tabulatorRef.current) {
        showNotification('error', 'La tabla aún no está lista. Por favor, espera un momento.');
        return;
    }

    const sectionLabels: Record<string, string> = {
        estructura: 'ESTRUCTURAS',
        arquitectura: 'ARQUITECTURA',
        sanitarias: 'INSTALACIONES SANITARIAS',
        electricas: 'INSTALACIONES ELECTRICAS',
        comunicaciones: 'INSTALACIONES DE COMUNICACIONES',
        gas: 'INSTALACIONES DE GAS'
    };

    const selectedSecciones = Object.entries(selectedSections)
        .filter(([_, value]) => value)
        .map(([key]) => sectionLabels[key]);

    if (selectedSecciones.length === 0) {
        showNotification('error', 'Debe seleccionar al menos una sección');
        return;
    }

    const data = tabulatorRef.current?.getData() || datosBase;

    if (!data || data.length === 0) {
        showNotification('warning', 'No hay datos para generar el documento');
        return;
    }

    setGeneratingWord(true);
    setShowWordModal(false);

    Promise.all(selectedSecciones.map(async seccion => {
        const datosFiltrados = filterTreeData(data, seccion);
        if (datosFiltrados.length > 0) {
            await generarWordParaSeccion(datosFiltrados, seccion);
        } else {
            showNotification('warning', `No se encontraron datos para la sección ${seccion}`);
        }
    })).finally(() => {
        setGeneratingWord(false);
    });
};

    //funciones para el word
    const crearParrafoDetalle = (titulo: string, descripcion: string) => {
        const docx = (window as any).docx;
        return new docx.Paragraph({
            children: [
                new docx.TextRun({ text: `${titulo} `, bold: true, font: "Arial", color: "#000000" }),
                new docx.TextRun({ text: descripcion, font: "Arial", color: "#000000" }),
            ],
            spacing: { after: 100, line: 750, lineRule: docx.LineRuleType.AUTO },
        });
    };

    const sinBordes = () => {
        const docx = (window as any).docx;
        return {
            top: { style: docx.BorderStyle.NONE },
            bottom: { style: docx.BorderStyle.NONE },
            left: { style: docx.BorderStyle.NONE },
            right: { style: docx.BorderStyle.NONE },
        };
    };

    const addTechnicalDetailsToWord = (detallesTecnicos: any, sections: any[]) => {
        const docx = (window as any).docx;
        if (!detallesTecnicos || typeof detallesTecnicos !== 'object') return;

        // Función para procesar contenido HTML con imágenes
        const procesarContenido = (contenido: string) => {
            if (!contenido) return [];

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = contenido;

            const elementos: any[] = [];

            // Procesar nodos hijos
            tempDiv.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    // Texto plano
                    if (node.textContent?.trim()) {
                        elementos.push(new docx.Paragraph({
                            children: [new docx.TextRun({ text: node.textContent, font: "Arial Narrow", size: 24, color: "#000000" })],
                            spacing: { after: 200, line: 480 },
                            indent: { left: 720, firstLine: 0 },
                        }));
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;
                    if (element.tagName === 'IMG') {
                        // Imagen en base64
                        const src = element.getAttribute('src');
                        if (src && src.startsWith('data:image')) {
                            const base64Data = src.split(',')[1];
                            const format = src.split(';')[0].split('/')[1];
                            elementos.push(new docx.Paragraph({
                                alignment: docx.AlignmentType.CENTER,
                                children: [new docx.ImageRun({
                                    data: base64Data,
                                    transformation: { width: 400, height: 300 },
                                })],
                                spacing: { after: 200 },
                            }));
                        }
                    } else if (element.tagName === 'P' || element.tagName === 'DIV') {
                        const texto = element.innerText;
                        if (texto.trim()) {
                            elementos.push(new docx.Paragraph({
                                children: [new docx.TextRun({ text: texto, font: "Arial Narrow", size: 24, color: "#000000" })],
                                spacing: { after: 200, line: 480 },
                                indent: { left: 720, firstLine: 0 },
                            }));
                        }
                    }
                }
            });

            return elementos;
        };

        // Descripción
        if (detallesTecnicos.descripcion) {
            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "DESCRIPCIÓN:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
            sections.push(...procesarContenido(detallesTecnicos.descripcion));
        }

        // Materiales
        const materialesKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('material') || key.toLowerCase().includes('herramienta')
        );
        if (materialesKey) {
            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "MATERIALES:", bold: true, size: 24, font: "Arial Narrow", color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));

            const materiales = detallesTecnicos[materialesKey];
            if (typeof materiales === 'string') {
                sections.push(...procesarContenido(materiales));
            } else if (Array.isArray(materiales)) {
                materiales.forEach(material => {
                    sections.push(new docx.Paragraph({
                        children: [new docx.TextRun({ text: "- " + material, font: "Arial Narrow", size: 24, color: "#000000" })],
                        spacing: { after: 200, line: 480 },
                        indent: { left: 720, firstLine: 0 },
                    }));
                });
            }
            sections.push(new docx.Paragraph({ text: "", spacing: { after: 100 } }));
        }

        // Método de ejecución
        const metodoEjecucionKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('ejecucion') || key.toLowerCase().includes('ejecución') || key.toLowerCase().includes('método_de_ejecucion')
        );
        if (metodoEjecucionKey) {
            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "MÉTODO DE EJECUCIÓN:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
            sections.push(...procesarContenido(detallesTecnicos[metodoEjecucionKey]));
        }

        // Método de medición
        const metodoMedicionKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('medicion') || key.toLowerCase().includes('medición') || key.toLowerCase().includes('método_de_medicion')
        );
        if (metodoMedicionKey) {
            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "MÉTODO DE MEDICIÓN:", bold: true, size: 24, font: "Arial Narrow", color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
            sections.push(...procesarContenido(detallesTecnicos[metodoMedicionKey]));
        }

        // Condiciones de pago
        const condicionesPagoKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('pago') || key.toLowerCase().includes('condiciones_de_pago')
        );
        if (condicionesPagoKey) {
            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "CONDICIONES DE PAGO:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
            sections.push(...procesarContenido(detallesTecnicos[condicionesPagoKey]));
        }
    };

    //FUNCION PRINCIPAL DEL WORD
    const generarWordParaSeccion = async (datosFiltrados: any[], nombreArchivoBase: string) => {
        const docx = (window as any).docx;
        const saveAs = (window as any).saveAs;

        if (!docx) {
            showNotification('error', 'La biblioteca docx no se ha cargado correctamente');
            return;
        }

        const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel,
            PageNumber, BorderStyle, SectionType, Table, TableRow, TableCell, WidthType,
            ImageRun, UnderlineType, VerticalAlign } = docx;

        const logoFile = (document.getElementById('logoFile') as HTMLInputElement)?.files?.[0] || null;
        const escudoFile = (document.getElementById('escudoFile') as HTMLInputElement)?.files?.[0] || null;
        const principalFile = (document.getElementById('logoPrinFile') as HTMLInputElement)?.files?.[0] || null;
        const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)?.files?.[0] || null;

        const readFileAsDataURL = (file: File): Promise<string | null> => {
            return new Promise((resolve, reject) => {
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target?.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        };

        let logoDataUrl = null;
        let escudoDataUrl = null;
        let principalDataUrl = null;
        let firmaDataUrl = null;

        try {
            if (logoFile) logoDataUrl = await readFileAsDataURL(logoFile);
            if (escudoFile) escudoDataUrl = await readFileAsDataURL(escudoFile);
            if (principalFile) principalDataUrl = await readFileAsDataURL(principalFile);
            if (firmaFile) firmaDataUrl = await readFileAsDataURL(firmaFile);
        } catch (error) {
            console.error("Error al procesar las imágenes:", error);
        }

        const logoImageRun = logoDataUrl ? new ImageRun({
            data: logoDataUrl,
            transformation: { width: 70, height: 70 },
        }) : null;

        const escudoImageRun = escudoDataUrl ? new ImageRun({
            data: escudoDataUrl,
            transformation: { width: 70, height: 70 },
        }) : null;

        const principalImageRun = principalDataUrl ? new ImageRun({
            data: principalDataUrl,
            transformation: { width: 300, height: 400 },
        }) : null;

        const firmaImageRun = firmaDataUrl ? new ImageRun({
            data: firmaDataUrl,
            transformation: { width: 70, height: 70 },
        }) : null;

        const header = new Header({
            children: [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 15, type: WidthType.PERCENTAGE },
                                    borders: sinBordes(),
                                    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: logoImageRun ? [logoImageRun] : [] })],
                                }),
                                new TableCell({
                                    width: { size: 70, type: WidthType.PERCENTAGE },
                                    borders: sinBordes(),
                                    children: [
                                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N° 358 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA- PROVINCIA DE UCAYALI – DEPARTAMENTO DE LORETO", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CUI: 2484411; CÓDIGO MODULAR: 0651216; CÓDIGO LOCAL: 390867", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I.E.I:358; UNIDAD EJECUTORA: MUNICIPALIDAD PROVINCIAL DE UCAYALI", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                    ],
                                }),
                                new TableCell({
                                    width: { size: 15, type: WidthType.PERCENTAGE },
                                    borders: sinBordes(),
                                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: escudoImageRun ? [escudoImageRun] : [] })],
                                }),
                            ],
                        }),
                    ],
                }),
                new Paragraph({ border: { bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 } }, children: [new TextRun("")] }),
            ],
        });

        const footer = new Footer({
            children: [
                new Paragraph({ alignment: AlignmentType.LEFT, children: firmaImageRun ? [firmaImageRun] : [] }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({ text: "Página ", bold: true, color: "#000000", font: "Arial" }),
                        new TextRun({ children: [PageNumber.CURRENT], bold: true, color: "#000000", font: "Arial" }),
                        new TextRun({ text: " | ", bold: true, color: "#000000", font: "Arial" }),
                        new TextRun({ children: [PageNumber.TOTAL_PAGES], bold: true, color: "#000000", font: "Arial" }),
                    ],
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MUNICIPALIDAD PROVINCIAL DE UCAYALI", bold: true, color: "#000000", font: "Arial" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CENTRO POBLADO DE CONTAMANA", color: "#000000", font: "Arial" })] }),
            ],
        });

        // Portada
        const coverPage = [
            new Paragraph({
                children: [new TextRun({ text: `ESPECIFICACIONES TECNICAS-${nombreArchivoBase.toUpperCase()}`, bold: true, size: 44, font: "Arial", color: "#000000", underline: { type: UnderlineType.SINGLE } })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }),
            new Paragraph({ text: "", border: { bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 } }, spacing: { after: 400 } }),
            new Paragraph({
                children: [
                    new TextRun({ text: "PROYECTO:", bold: true, font: "Arial", size: 28, color: "#000000" }),
                    new TextRun({ text: "\t", font: "Arial", size: 28 }),
                    new TextRun({ text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N°558 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA-PROVINCIA DE UCAYALI - DEPARTAMENTO DE LORETO", font: "Arial", size: 28, color: "#000000" }),
                ],
                spacing: { after: 400, line: 360 },
                alignment: AlignmentType.JUSTIFIED,
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: sinBordes(),
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 60, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                children: [
                                    crearParrafoDetalle("CÓDIGO UNIFICADO:", "2484411"),
                                    crearParrafoDetalle("CÓDIGO MODULAR:", "0561216"),
                                    crearParrafoDetalle("I.E.I. N°:", "558"),
                                    crearParrafoDetalle("CÓDIGO LOCAL:", "390867"),
                                    crearParrafoDetalle("DEPARTAMENTO:", "LORETO"),
                                    crearParrafoDetalle("PROVINCIA:", "UCAYALI"),
                                    crearParrafoDetalle("DISTRITO:", "CONTAMANA"),
                                    crearParrafoDetalle("C.P.:", "CONTAMANA"),
                                ],
                                borders: sinBordes(),
                            }),
                            new TableCell({
                                width: { size: 40, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                children: principalImageRun ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [principalImageRun] })] : [new Paragraph("")],
                                borders: sinBordes(),
                            }),
                        ],
                    }),
                ],
            }),
        ];

        const tableOfContents = [
            new Paragraph({
                children: [new TextRun({ text: "TABLA DE CONTENIDO", bold: true, font: "Arial", size: 24, color: "#000000" })],
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            }),
            new docx.TableOfContents("Tabla de Contenido", { hyperlink: true, headingStyleRange: "1-5", size: 24, color: "#000000" }),
        ];

        const contentSections = generateSectionsForWord(datosFiltrados, nombreArchivoBase);

        const documentSections = [
            { properties: { type: SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: coverPage },
            { properties: { type: SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: tableOfContents },
            { properties: { type: SectionType.CONTINUOUS }, headers: { default: header }, footers: { default: footer }, children: contentSections },
        ];

        const doc = new Document({
            styles: {
                default: { document: { run: { font: "Arial", color: "#000000", size: 24 } }, paragraph: { spacing: { line: 276 } } },
                paragraphStyles: [
                    { id: "Heading1", name: "Heading 1", run: { font: "Arial", size: 36, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                    { id: "Heading2", name: "Heading 2", run: { font: "Arial", size: 30, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                    { id: "Heading3", name: "Heading 3", run: { font: "Arial", size: 26, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                ],
            },
            sections: documentSections,
        });

        try {
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `especificaciones_tecnicas_${nombreArchivoBase.replace(/ /g, '_')}.docx`);
            showNotification('success', `Documento para ${nombreArchivoBase} generado con éxito`);
        } catch (error) {
            console.error("Error al generar el documento:", error);
            showNotification('error', "Error al generar el documento Word");
        }
    };

    const processHierarchicalItemsToWord = (items: any[], sections: any[], level: number) => {
        const docx = (window as any).docx;
        if (!items || !Array.isArray(items) || items.length === 0) return;

        items.forEach(item => {
            if (!item) return;

            let headingLevel;
            switch (level) {
                case 1: headingLevel = docx.HeadingLevel.HEADING_1; break;
                case 2: headingLevel = docx.HeadingLevel.HEADING_2; break;
                default: headingLevel = docx.HeadingLevel.HEADING_3; break;
            }

            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({
                    text: `${item.item || ''} ${item.descripcion || ''}`.trim(),
                    bold: true,
                    font: "Arial Narrow",
                    color: "#000000",
                    size: 24,
                })],
                heading: headingLevel,
                spacing: { before: 300, after: 100, line: 480 },
            }));

            if (item.unidad) {
                sections.push(new docx.Paragraph({
                    children: [new docx.TextRun({ text: `(Unidad de medida: ${item.unidad})`, font: "Arial Narrow", size: 22, color: "#000000" })],
                    spacing: { line: 480 },
                }));
            }

            if (item.metrado) {
                sections.push(new docx.Paragraph({
                    children: [new docx.TextRun({ text: `Metrado: ${item.metrado}`, font: "Arial Narrow", size: 24, color: "#000000" })],
                    spacing: { after: 200, line: 480 },
                    indent: { left: 720, firstLine: 0 },
                }));
            }

            if (item.detallesTecnicos) {
                addTechnicalDetailsToWord(item.detallesTecnicos, sections);
            }

            if (item._children && item._children.length > 0) {
                processHierarchicalItemsToWord(item._children, sections, level + 1);
            }
        });
    };

    const generateSectionsForWord = (data: any[], sectionName: string): any[] => {
        const docx = (window as any).docx;
        if (!data || !Array.isArray(data) || data.length === 0) {
            return [new docx.Paragraph({ text: "No se encontraron datos para esta sección." })];
        }

        const sections: any[] = [];

        sections.push(new docx.Paragraph({
            text: sectionName.toUpperCase(),
            heading: docx.HeadingLevel.HEADING_1,
            alignment: docx.AlignmentType.CENTER,
            bold: true,
            spacing: { before: 400, after: 200 },
        }));

        processHierarchicalItemsToWord(data, sections, 1);

        return sections;
    };

    // ─────────────────────────────────────────
    // EFECTOS
    // ─────────────────────────────────────────

    /**
     * Inicializa Tabulator y carga el JSON de templates.
     * La tabla se inicializa con polling cada 100ms hasta que Tabulator esté disponible en window.
     *
     * IMPORTANTE: showDescription usa templatesRef (no state) para evitar closure stale.
     */
    // ─────────────────────────────────────────
    // EFECTOS
    // ─────────────────────────────────────────

    /**
     * Inicializa Tabulator y carga el JSON de templates.
     */
    useEffect(() => {
        if (!tableRef.current) return;

        let isMounted = true;
        let retryCount = 0;
        const MAX_RETRIES = 30;

        const initTabulator = () => {
            const TabulatorClass = (window as any).Tabulator;

            if (!TabulatorClass || !tableRef.current) {
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    setTimeout(initTabulator, 200);
                } else {
                    console.error('[Tabulator] No se pudo inicializar después de múltiples intentos');
                }
                return;
            }

            if (!isMounted) return;

            try {
                const table = new TabulatorClass(tableRef.current, {
                    data: datosBase,
                    dataTree: true,
                    dataTreeStartExpanded: false,
                    layout: "fitDataFill",
                    height: 'calc(100vh - 140px)',
                    virtualDom: true,
                    dataTreeChildField: '_children',
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapseStartOpen: false,
                    columns: [
                        {
                            title: 'Items',
                            field: 'item',
                            width: 150,
                            responsive: 0,
                            editor: 'input'
                        },
                        {
                            title: 'Descripción',
                            field: 'descripcion',
                            width: 300,
                            responsive: 1,
                            editor: 'input'
                        },
                        {
                            title: 'Und',
                            field: 'unidad',
                            width: 70,
                            responsive: 2,
                            editor: 'input'
                        },
                        {
                            title: '',
                            width: 60,
                            responsive: 0,
                            formatter: (cell: any) => {
                                const data = cell.getRow().getData();
                                if (!data.unidad) return '';
                                return '<button class="btn-details" style="background:#3b82f6;color:white;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:14px;">📋</button>';
                            },
                            cellClick: (_e: any, cell: any) => {
                                showDescription(cell.getRow());
                            },
                        },
                    ],
                });

                tabulatorRef.current = table;

                table.on('tableBuilt', () => {
                    console.log('[Tabulator] Tabla construida y lista');
                });

            } catch (error) {
                console.error('[Tabulator] Error al inicializar:', error);
            }
        };

        initTabulator();

        // Carga del JSON de templates
        fetch('/assets/data/descriptivos-templates.json')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log(`[Templates] Cargados: ${data.length} registros`);
                templatesRef.current = data;
            })
            .catch(err => console.error('[Templates] Error cargando:', err));

        return () => {
            isMounted = false;
            if (tabulatorRef.current) {
                try {
                    tabulatorRef.current.destroy();
                } catch (e) {
                    console.warn('[Tabulator] Error al destruir:', e);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 👇 AGREGAR ESTE NUEVO useEffect AQUÍ, DEBAJO DEL ANTERIOR
    /**
     * Actualizar la tabla cuando datosBase cambie desde fuera (como después de cargar metrados)
     */
    useEffect(() => {
        if (tabulatorRef.current && datosBase) {
            // Verificar que la tabla esté lista antes de actualizar
            try {
                tabulatorRef.current.setData(datosBase);
            } catch (error) {
                console.warn('[Tabulator] No se pudo actualizar datos:', error);
            }
        }
    }, [datosBase]);

    /** Carga datos del servidor cuando cambia el ID de especificaciones */
    useEffect(() => {
        if (especificacionesId) loadDataFromServer();
    }, [especificacionesId]);

    /** Carga datos del servidor cuando cambia el ID de especificaciones */
    useEffect(() => {
        if (especificacionesId) loadDataFromServer();
    }, [especificacionesId]);

    // ─────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────

    return (
        <>
            <Head title="Especificaciones Técnicas" />

            <style>{`
.tabulator{font-size:13px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.tabulator .tabulator-header{background-color:#f3f4f6;border-bottom:1px solid #e5e7eb}
.tabulator .tabulator-header .tabulator-col{background-color:#f3f4f6;font-weight:600;color:#1f2937;border-right:none}
.tabulator .tabulator-row{border-bottom:1px solid #f3f4f6}
.tabulator .tabulator-row:hover{background-color:#f9fafb}
.tabulator .tabulator-cell{padding:10px 8px;border-right:none;color:#1f2937}
.tabulator .tabulator-cell .btn-details:hover{background:#2563eb!important}
.tabulator .tabulator-editing{border:2px solid #3b82f6!important}
textarea{color:#1f2937!important;background-color:#fff!important}
.bg-gray-50 textarea,.bg-gray-50 p,.bg-gray-50 div{color:#1f2937!important}

/* Responsividad */
@media (max-width: 768px) {
    .tabulator .tabulator-cell {padding:6px 4px !important;font-size:11px !important}
    .tabulator .tabulator-col-title {font-size:10px !important}
    .tabulator .tabulator-cell .btn-details {padding:4px 6px !important;font-size:12px !important}
    .w-1\/3,.w-2\/3 {width:100% !important}
}
@media (min-width:769px) and (max-width:1024px) {
    .tabulator .tabulator-cell {padding:8px 6px !important}
    .tabulator .tabulator-col-title {font-size:11px !important}
}
`}</style>

            <div className="min-h-screen bg-gray-50">

                {/* ── HEADER ── */}
                <div className="bg-gray-800 shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                        <h1 className="text-white font-bold text-lg">ESPECIFICACIONES TÉCNICAS</h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMetradosPanel(p => !p)}
                                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                📊 Cargar Metrados
                            </button>
                            <button
                                onClick={handleSaveData}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                💾 Guardar
                            </button>
                            <button
                                onClick={() => setShowWordModal(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                📄 Generar Word
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── PANEL METRADOS ── */}
                {showMetradosPanel && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
                        <div className="max-w-7xl mx-auto px-6 py-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-bold text-blue-800 uppercase tracking-wide">📋 ESPECIALIDADES</span>
                                <div className="flex-1 h-px bg-blue-200" />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {(
                                    [
                                        { key: 'estructura', label: '🏗️ Estructuras', desc: 'Metrados de concreto y acero' },
                                        { key: 'arquitectura', label: '🏛️ Arquitectura', desc: 'Acabados y elementos arquitectónicos' },
                                        { key: 'sanitarias', label: '🚰 Inst. Sanitarias', desc: 'Agua y desagüe' },
                                        { key: 'electricas', label: '⚡ Inst. Eléctricas', desc: 'Iluminación y fuerza' },
                                        { key: 'comunicaciones', label: '📡 Comunicaciones', desc: 'Datos y telefonía' },
                                        { key: 'gas', label: '🔥 Inst. de Gas', desc: 'Redes de gas natural' },
                                    ] as { key: keyof typeof selectedSections; label: string; desc: string }[]
                                ).map(({ key, label, desc }) => (
                                    <label
                                        key={key}
                                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSections[key]}
                                            onChange={e => setSelectedSections(prev => ({ ...prev, [key]: e.target.checked }))}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">{label}</span>
                                            <span className="text-xs text-gray-500">{desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <div className="flex justify-end mt-5 pt-3 border-t border-blue-200">
                                <button
                                    onClick={handleLoadMetrados}
                                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                >
                                    <span>📥</span> Cargar Datos Seleccionados
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── LAYOUT TABLA + PANEL LATERAL ── */}
                <div className="flex flex-1 px-4 py-6 gap-4">

                    {/* Tabla */}
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-2/3' : 'w-full'}`}>
                        <div
                            ref={tableRef}
                            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"
                            style={{ height: 'calc(100vh - 180px)' }}
                        />
                    </div>

                    {/* Panel lateral de detalles técnicos */}
                    {showDetailsPanel && currentData && (
                        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">

                            {/* Header del panel */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-xs uppercase tracking-wide opacity-80">Detalles Técnicos</p>
                                        <h3 className="text-sm font-bold mt-1 truncate">
                                            {currentData.item} — {currentData.descripcion}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailsPanel(false)}
                                        className="text-white hover:text-gray-200 text-2xl leading-none ml-2"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>

                            {/* Secciones editables */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                {currentSections.map((section, idx) => (
                                    <div key={idx} className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden shadow-sm">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                            <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wide">
                                                {section.title}
                                            </h4>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => insertImage(idx)}
                                                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                                                    title="Insertar imagen"
                                                >
                                                    🖼️ Imagen
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (currentSections.length > 1) {
                                                            setCurrentSections(prev => prev.filter((_, i) => i !== idx));
                                                        } else {
                                                            showNotification('warning', 'Debe mantener al menos una sección');
                                                        }
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                        <div
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                                const updated = [...currentSections];
                                                updated[idx] = { ...updated[idx], content: e.currentTarget.innerHTML };
                                                setCurrentSections(updated);
                                            }}
                                            className="w-full p-4 text-sm focus:outline-none min-h-[150px]"
                                            dangerouslySetInnerHTML={{ __html: section.content }}
                                        />
                                    </div>
                                ))}

                                {/* Agregar nueva sección */}
                                <div className="mt-4 flex gap-2">
                                    <input
                                        type="text"
                                        id="newSectionPanel"
                                        placeholder="Nombre de nueva sección"
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                setCurrentSections(prev => [...prev, { title: e.currentTarget.value.trim(), content: '' }]);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('newSectionPanel') as HTMLInputElement;
                                            if (input?.value.trim()) {
                                                setCurrentSections(prev => [...prev, { title: input.value.trim(), content: '' }]);
                                                input.value = '';
                                            }
                                        }}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Footer del panel */}
                            <div className="border-t p-3 bg-white flex justify-end gap-2">
                                <button
                                    onClick={() => setShowDetailsPanel(false)}
                                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveDescription}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── MODAL WORD ── */}
                {showWordModal && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        onClick={() => setShowWordModal(false)}
                    >
                        <div
                            className="bg-white rounded-lg w-full max-w-md mx-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-gray-100 px-6 py-4 rounded-t-lg border-b">
                                <h2 className="text-lg font-bold text-gray-800">Generar Documento Word</h2>
                            </div>
                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Seleccione las secciones a incluir:</p>
                                    <div className="space-y-2">
                                        {Object.entries(selectedSections).map(([key, value]) => (
                                            <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={value}
                                                    onChange={e => setSelectedSections(prev => ({ ...prev, [key]: e.target.checked }))}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                <span className="text-sm text-gray-700 capitalize">{key}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Imágenes para Word */}
                                <div className="border-t border-gray-200 pt-3">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Imágenes para el documento:</p>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Logo izquierdo (header)</label>
                                            <input type="file" id="logoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Logo derecho / Escudo (header)</label>
                                            <input type="file" id="escudoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Imagen principal (portada)</label>
                                            <input type="file" id="logoPrinFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Firma (footer)</label>
                                            <input type="file" id="firmaFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                                <button onClick={() => setShowWordModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleGenerateWord}
                                    disabled={generatingWord}
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${generatingWord
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {generatingWord ? 'Generando...' : 'Generar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

export default EttpIndex;