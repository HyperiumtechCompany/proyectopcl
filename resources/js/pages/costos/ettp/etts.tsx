import React, { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Tabulator from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Swal from 'sweetalert2';
import toastr from 'toastr';
import 'toastr/build/toastr.min.css';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    especificacionesId?: number;
    initialData?: any;
}

interface DetallesTecnicos {
    [key: string]: any;
}

interface EttpItem {
    id: number;
    item: string;
    descripcion: string;
    unidad: string;
    metrado?: string;
    detallesTecnicos?: DetallesTecnicos;
    parent_id?: number;
    nivel?: number;
    _children?: EttpItem[];
    [key: string]: any;
}

interface TemplateItem {
    codigo?: string;
    codigo_completo?: string;
    descripcion?: string;
    subpartidas?: TemplateItem[];
    [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_DATA: EttpItem[] = [
    {
        "id": 1,
        "item": "05",
        "descripcion": "INSTALACIONES ELECTRICAS",
        "unidad": "",
        "_children": [
            {
                "id": 2,
                "item": "05.01",
                "descripcion": "CONEXION A LA RED EXTERNA DE SUMINISTRO DE ENERGIA ELECTRICA",
                "unidad": "",
                "_children": [
                    {
                        "id": 3,
                        "item": "05.01.01",
                        "descripcion": "ACOMETIDA MONO.FÁSICA DE ENERGÍA ELÉCTRICA DE RED SECUNDARIA CON MEDIDOR.",
                        "unidad": "GLB",
                    },
                    {
                        "id": 4,
                        "item": "05.01.02",
                        "descripcion": "Acondicionamiento de tubo de FG, tubo PVC y baston para acometida.",
                        "unidad": "GLB",
                    }
                ]
            }
        ]
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const EttpIndex = ({ especificacionesId, initialData }: Props) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorRef = useRef<any>(null);
    const isUpdatingRef = useRef(false);
    
    // Estado
    const [datosBase, setDatosBase] = useState<EttpItem[]>(initialData || DEFAULT_DATA);
    const [descriptivosTemplates, setDescriptivosTemplates] = useState<TemplateItem[]>([]);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [currentData, setCurrentData] = useState<any>(null);
    
    // Estado para checkboxes de secciones
    const [selectedSections, setSelectedSections] = useState({
        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });
    
    // Estado para el modal de Word
    const [showWordModal, setShowWordModal] = useState(false);
    const [generatingWord, setGeneratingWord] = useState(false);

    // ─────────────────────────────────────────────────────────────────────
    // HELPERS Y UTILIDADES
    // ─────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────
    // BÚSQUEDA DE TEMPLATES
    // ─────────────────────────────────────────────────────────────────────

    const buscarTemplateRecursivo = (templates: TemplateItem[], codigoABuscar: string): TemplateItem | null => {
        if (!templates || !Array.isArray(templates) || templates.length === 0) {
            return null;
        }

        const codigoNormalizado = codigoABuscar.toString().trim().toLowerCase();

        const buscarEnNivel = (items: TemplateItem[]): TemplateItem | null => {
            if (!items || !Array.isArray(items)) return null;

            // Búsqueda exacta
            for (const item of items) {
                if (item.codigo_completo && 
                    item.codigo_completo.toString().trim().toLowerCase() === codigoNormalizado) {
                    return item;
                }
                if (item.codigo && 
                    item.codigo.toString().trim().toLowerCase() === codigoNormalizado) {
                    return item;
                }
                if (item.subpartidas && item.subpartidas.length > 0) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            // Búsqueda parcial
            for (const item of items) {
                if (item.codigo_completo && 
                    item.codigo_completo.toString().trim().toLowerCase().includes(codigoNormalizado)) {
                    return item;
                }
                if (item.codigo && 
                    item.codigo.toString().trim().toLowerCase().includes(codigoNormalizado)) {
                    return item;
                }
                if (item.subpartidas && item.subpartidas.length > 0) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            return null;
        };

        return buscarEnNivel(templates);
    };

    // ─────────────────────────────────────────────────────────────────────
    // ORGANIZACIÓN DE DATOS JERÁRQUICOS
    // ─────────────────────────────────────────────────────────────────────

    const organizeAndSortData = (data: any[]): EttpItem[] => {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        let organizedData = [...data];

        try {
            organizedData.sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));

            const idMap = new Map();
            organizedData.forEach(item => idMap.set(item.id, item));

            const processedIds = new Set();

            organizedData.forEach(item => {
                if (item.parent_id && idMap.has(item.parent_id)) {
                    const parent = idMap.get(item.parent_id);

                    if (!parent._children) parent._children = [];

                    if (!parent._children.some((child: any) => child.id === item.id)) {
                        parent._children.push(item);
                    }

                    if (processedIds.has(item.id)) {
                        console.warn(`Posible referencia circular detectada en ID: ${item.id}`);
                    } else {
                        processedIds.add(item.id);
                    }
                }
            });

            return organizedData.filter(item => !item.parent_id || !idMap.has(item.parent_id));
        } catch (error) {
            console.error("Error organizando datos:", error);
            return data;
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // CARGA DE DATOS DEL SERVIDOR
    // ─────────────────────────────────────────────────────────────────────

    const loadDataFromServer = async () => {
        if (!especificacionesId) {
            console.warn("No se encontró ID de especificaciones técnicas");
            setDatosBase(DEFAULT_DATA);
            return;
        }

        try {
            const response = await axios.post('/obtener-especificaciones-tecnicas', 
                { id: especificacionesId },
                {
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    }
                }
            );

            if (response.data?.data) {
                const parsedData = typeof response.data.data === 'string' 
                    ? JSON.parse(response.data.data) 
                    : response.data.data;
                setDatosBase(Array.isArray(parsedData) ? parsedData : DEFAULT_DATA);
            } else {
                setDatosBase(DEFAULT_DATA);
            }
        } catch (error) {
            console.error("Error cargando datos del servidor:", error);
            setDatosBase(DEFAULT_DATA);
        }
    };

    const fetchMetradosData = async (proyectoId: string, selectedOptions: Record<string, number>) => {
        try {
            const response = await axios.post('/obtener-metrados-ettp', {
                proyecto_id: proyectoId,
                ...selectedOptions
            }, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                }
            });

            if (response.data.error) {
                showNotification('error', response.data.error);
                return [];
            }

            if (response.data.warning) {
                showNotification('warning', response.data.warning);
                return [];
            }

            if (response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }

            if (Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error: any) {
            if (error.response?.data?.error) {
                showNotification('error', error.response.data.error);
            } else {
                showNotification('error', 'Error al cargar los datos. Por favor, inténtelo de nuevo.');
            }
            return [];
        }
    };

    const handleLoadMetrados = async (event: React.MouseEvent) => {
        event.preventDefault();

        if (!tabulatorRef.current) return;

        const proyectoId = (document.getElementById('proyecto_id') as HTMLInputElement)?.value;

        if (!proyectoId) {
            showNotification('error', 'Debe seleccionar un proyecto');
            return;
        }

        const selectedOptions = {
            estructura: selectedSections.estructura ? 1 : 0,
            arquitectura: selectedSections.arquitectura ? 1 : 0,
            sanitarias: selectedSections.sanitarias ? 1 : 0,
            electricas: selectedSections.electricas ? 1 : 0,
            comunicacion: selectedSections.comunicaciones ? 1 : 0,
            gas: selectedSections.gas ? 1 : 0
        };

        const hasSelection = Object.values(selectedOptions).some(value => value === 1);

        if (!hasSelection) {
            showNotification('error', 'Debe seleccionar al menos una categoría');
            return;
        }

        try {
            const rawData = await fetchMetradosData(proyectoId, selectedOptions);
            const processedData = organizeAndSortData(rawData);

            if (processedData.length > 0) {
                tabulatorRef.current.setData(processedData);
                setDatosBase(processedData);
                showNotification('success', 'Datos cargados correctamente');
            } else {
                showNotification('warning', 'No se encontraron datos para mostrar');
                tabulatorRef.current.setData(DEFAULT_DATA);
                setDatosBase(DEFAULT_DATA);
            }
        } catch (error) {
            console.error("Error en handleLoadMetrados:", error);
            showNotification('error', 'Error al procesar los datos');
            tabulatorRef.current.setData(DEFAULT_DATA);
            setDatosBase(DEFAULT_DATA);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // DESCRIPCIÓN Y DETALLES TÉCNICOS
    // ─────────────────────────────────────────────────────────────────────

    const mostrarTemplateEncontrado = (template: TemplateItem, data: any) => {
        Swal.fire({
            title: '¡Plantilla encontrada!',
            text: `Se encontró una plantilla para el item ${data.item}. ¿Desea cargar los detalles?`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Sí, cargar',
            cancelButtonText: 'No, mantener actual'
        }).then((result) => {
            if (result.isConfirmed) {
                const camposExcluidos = [
                    'codigo',
                    'codigo_completo',
                    'nivel',
                    'subpartidas',
                    'titulo',
                    'unidad_medida',
                    'codigo_original',
                ];

                data.detallesTecnicos = {};
                Object.keys(template).forEach(campo => {
                    if (!camposExcluidos.includes(campo)) {
                        data.detallesTecnicos[campo] = template[campo];
                    }
                });

                if (selectedRow) {
                    selectedRow.update(data);
                }
            }

            mostrarFormularioDetalles(data);
        });
    };

    const mostrarFormularioDetalles = (data: any) => {
        setCurrentData(data);
        setShowDescriptionModal(true);
    };

    const createSectionHTML = (title: string, content: string = '') => {
        return {
            title,
            content: content || 'Agregar contenido...'
        };
    };

    const getDefaultSections = (detallesTecnicos: DetallesTecnicos) => {
        return [
            createSectionHTML('Descripción', detallesTecnicos.descripcion),
            createSectionHTML('Método de Ejecución', detallesTecnicos.metodo_de_ejecucion),
            createSectionHTML('Método de Medición', detallesTecnicos.metodo_de_medicion),
            createSectionHTML('Condiciones de Pago', detallesTecnicos.condiciones_de_pago),
        ];
    };

    const saveDescription = (sections: { title: string; content: string }[]) => {
        if (!selectedRow) {
            showNotification('error', 'No hay una fila seleccionada');
            return;
        }

        const detallesTecnicos: DetallesTecnicos = {};
        sections.forEach(section => {
            const key = section.title.toLowerCase().replace(/ /g, '_');
            detallesTecnicos[key] = section.content;
        });

        const currentDataRow = selectedRow.getData();
        currentDataRow.detallesTecnicos = detallesTecnicos;
        selectedRow.update(currentDataRow);

        Swal.fire({
            title: '¡Guardado exitoso!',
            text: 'Los detalles técnicos se han actualizado correctamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        
        setShowDescriptionModal(false);
    };

    const showDescription = (row: any) => {
        const data = row.getData();
        setSelectedRow(row);

        if (!descriptivosTemplates || descriptivosTemplates.length === 0) {
            mostrarFormularioDetalles(data);
            return;
        }

        const template = buscarTemplateRecursivo(descriptivosTemplates, data.item);

        if (template) {
            mostrarTemplateEncontrado(template, data);
        } else {
            if (data.item && data.item.includes(" ")) {
                const codigoNumerico = data.item.split(" ")[0];
                const templatePorCodigo = buscarTemplateRecursivo(descriptivosTemplates, codigoNumerico);

                if (templatePorCodigo) {
                    mostrarTemplateEncontrado(templatePorCodigo, data);
                    return;
                }
            }
            mostrarFormularioDetalles(data);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // GUARDAR DATOS
    // ─────────────────────────────────────────────────────────────────────

    const handleSaveData = async () => {
        if (!especificacionesId) {
            showNotification('error', 'ID de ETTP no encontrado');
            return;
        }

        if (!tabulatorRef.current) return;

        const datosGenerales = tabulatorRef.current.getData();

        try {
            await axios.post(`/guardar-especificaciones-tecnicas/${especificacionesId}`, 
                { especificaciones_tecnicas: datosGenerales },
                {
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        'Content-Type': 'application/json',
                    }
                }
            );

            Swal.fire({
                title: "Éxito",
                text: "Datos guardados correctamente",
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al guardar:", error);
            Swal.fire({
                title: "Error",
                text: "No se pudieron guardar los datos",
                icon: "error"
            });
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // GENERACIÓN DE WORD
    // ─────────────────────────────────────────────────────────────────────

    const filterTreeData = (data: EttpItem[], seccion: string): EttpItem[] => {
        const findRootSectionAndDescendants = (items: EttpItem[], sectionName: string): EttpItem[] => {
            if (!items || items.length === 0) {
                return [];
            }

            for (const item of items) {
                if (item.descripcion && item.descripcion.toLowerCase().includes(sectionName.toLowerCase())) {
                    return [JSON.parse(JSON.stringify(item))];
                }

                if (item._children && item._children.length > 0) {
                    const foundInChildren = findRootSectionAndDescendants(item._children, sectionName);
                    if (foundInChildren.length > 0) {
                        return foundInChildren;
                    }
                }
            }

            return [];
        };

        try {
            return findRootSectionAndDescendants(data, seccion);
        } catch (error) {
            console.error('Error al filtrar datos:', error);
            return [];
        }
    };

    const crearParrafoDetalle = (titulo: string, descripcion: string) => {
        return {
            titulo,
            descripcion
        };
    };

    const sinBordes = () => ({
        top: { style: 'none' },
        bottom: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' },
    });

    const generateCoverPage = async (sectionName: string, principalFile: File | null, signatureFile: File | null) => {
        const sections: any[] = [];

        const principalDataUrl = principalFile ? await readFileAsDataURL(principalFile) : null;
        const signatureDataUrl = signatureFile ? await readFileAsDataURL(signatureFile) : null;

        // Esta función retorna los datos para la portada
        // En la implementación real, esto se usaría con docx.js
        return {
            sections,
            principalDataUrl,
            signatureDataUrl
        };
    };

    const generateTableOfContents = () => {
        return [
            { type: 'title', text: 'TABLA DE CONTENIDO' }
        ];
    };

    const addTechnicalDetails = (detallesTecnicos: DetallesTecnicos, sections: any[]) => {
        if (!detallesTecnicos || typeof detallesTecnicos !== 'object') return;

        // Descripción
        if (detallesTecnicos.descripcion) {
            sections.push({ type: 'subtitle', text: 'DESCRIPCIÓN:' });
            sections.push({ type: 'content', text: detallesTecnicos.descripcion });
        }

        // Materiales
        const materialesKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('material') ||
            key.toLowerCase().includes('herramienta')
        );

        if (materialesKey) {
            sections.push({ type: 'subtitle', text: 'MATERIALES:' });
            const materiales = detallesTecnicos[materialesKey];
            if (Array.isArray(materiales)) {
                materiales.forEach(material => {
                    sections.push({ type: 'bullet', text: material });
                });
            } else if (typeof materiales === 'string') {
                sections.push({ type: 'content', text: materiales });
            }
        }

        // Método de ejecución
        const metodoEjecucionKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('ejecucion') ||
            key.toLowerCase().includes('ejecución') ||
            key.toLowerCase().includes('método_de_ejecucion')
        );

        if (metodoEjecucionKey) {
            sections.push({ type: 'subtitle', text: 'MÉTODO DE EJECUCIÓN:' });
            sections.push({ type: 'content', text: detallesTecnicos[metodoEjecucionKey] });
        }

        // Método de medición
        const metodoMedicionKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('medicion') ||
            key.toLowerCase().includes('medición') ||
            key.toLowerCase().includes('método_de_medicion')
        );

        if (metodoMedicionKey) {
            sections.push({ type: 'subtitle', text: 'MÉTODO DE MEDICIÓN:' });
            sections.push({ type: 'content', text: detallesTecnicos[metodoMedicionKey] });
        }

        // Condiciones de pago
        const condicionesPagoKey = Object.keys(detallesTecnicos).find(key =>
            key.toLowerCase().includes('pago') ||
            key.toLowerCase().includes('condiciones_de_pago')
        );

        if (condicionesPagoKey) {
            sections.push({ type: 'subtitle', text: 'CONDICIONES DE PAGO:' });
            sections.push({ type: 'content', text: detallesTecnicos[condicionesPagoKey] });
        }
    };

    const processHierarchicalItems = (items: EttpItem[], sections: any[], level: number) => {
        if (!items || !Array.isArray(items) || items.length === 0) return;

        items.forEach(item => {
            if (!item) return;

            // Agregar el ítem actual
            sections.push({
                type: 'heading',
                level,
                text: `${item.item || ''} ${item.descripcion || ''}`.trim()
            });

            // Agregar unidad de medida
            if (item.unidad) {
                sections.push({
                    type: 'content',
                    text: `(Unidad de medida: ${item.unidad})`
                });
            }

            if (item.metrado) {
                sections.push({
                    type: 'content',
                    text: `Metrado: ${item.metrado}`
                });
            }

            // Agregar detalles técnicos
            if (item.detallesTecnicos) {
                addTechnicalDetails(item.detallesTecnicos, sections);
            }

            // Procesar hijos recursivamente
            if (item._children && item._children.length > 0) {
                processHierarchicalItems(item._children, sections, level + 1);
            }
        });
    };

    const generateSectionsForSection = (data: EttpItem[], sectionName: string): any[] => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return [{ type: 'content', text: "No se encontraron datos para esta sección." }];
        }

        const sections: any[] = [];

        // Título de la sección
        sections.push({
            type: 'mainTitle',
            text: sectionName.toUpperCase()
        });

        // Procesar todos los items
        processHierarchicalItems(data, sections, 1);

        return sections;
    };

    const generarWordParaSeccion = async (datosFiltrados: EttpItem[], nombreArchivoBase: string) => {
        setGeneratingWord(true);

        try {
            const logoFile = (document.getElementById('logoFile') as HTMLInputElement)?.files?.[0] || null;
            const escudoFile = (document.getElementById('escudoFile') as HTMLInputElement)?.files?.[0] || null;
            const principalFile = (document.getElementById('logoPrinFile') as HTMLInputElement)?.files?.[0] || null;
            const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)?.files?.[0] || null;

            // Generar portada
            const coverData = await generateCoverPage(nombreArchivoBase, principalFile, firmaFile);
            
            // Generar tabla de contenido
            const tocData = generateTableOfContents();
            
            // Generar contenido principal
            const contentSections = generateSectionsForSection(datosFiltrados, nombreArchivoBase);

            console.log('Documento generado:', {
                cover: coverData,
                toc: tocData,
                content: contentSections,
                nombreArchivo: `especificaciones_tecnicas_${nombreArchivoBase.replace(/ /g, '_')}.docx`
            });

            showNotification('success', `Documento para ${nombreArchivoBase} generado con éxito`);
        } catch (error) {
            console.error("Error al generar el documento:", error);
            showNotification('error', "Error al generar el documento Word: " + (error as Error).message);
        } finally {
            setGeneratingWord(false);
            setShowWordModal(false);
        }
    };

    const handleGenerateWord = () => {
        const selectedSecciones = Object.entries(selectedSections)
            .filter(([_, value]) => value)
            .map(([key]) => {
                const labels: Record<string, string> = {
                    estructura: 'ESTRUCTURAS',
                    arquitectura: 'ARQUITECTURA',
                    sanitarias: 'INSTALACIONES SANITARIAS',
                    electricas: 'INSTALACIONES ELECTRICAS',
                    comunicaciones: 'INSTALACIONES DE COMUNICACIONES',
                    gas: 'INSTALACIONES DE GAS'
                };
                return labels[key] || key;
            });

        if (selectedSecciones.length === 0) {
            showNotification('error', 'Debe seleccionar al menos una sección');
            return;
        }

        const data = tabulatorRef.current?.getData() || datosBase;

        selectedSecciones.forEach(seccion => {
            const datosFiltrados = filterTreeData(data, seccion);
            if (datosFiltrados.length > 0) {
                generarWordParaSeccion(datosFiltrados, seccion);
            } else {
                showNotification('warning', `No se encontraron datos para la sección ${seccion}`);
            }
        });
        
        setShowWordModal(false);
    };

    // ─────────────────────────────────────────────────────────────────────
    // INICIALIZAR TABULATOR
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!tableRef.current) return;

        // Cargar templates
        fetch('/assets/data/descriptivos-templates.json')
            .then(response => response.json())
            .then(data => {
                setDescriptivosTemplates(data);
            })
            .catch(error => {
                console.error('Error cargando templates:', error);
            });

        // Inicializar Tabulator
        const table = new Tabulator(tableRef.current, {
            data: datosBase,
            dataTree: true,
            dataTreeStartExpanded: false,
            layout: "fitDataStretch",
            maxHeight: "100%",
            virtualDom: true,
            renderVerticalBuffer: 500,
            ajaxContentType: "json",
            dataTreeChildField: "_children",
            progressiveLoad: "scroll",
            progressiveLoadDelay: 200,
            progressiveLoadScrollMargin: 300,
            paginationMode: "remote",
            paginationSize: 100,
            height: "500px",
            dataLoaded: () => {
                // Actualizar totales si es necesario
            },
            rowUpdated: () => {
                // Actualizar totales si es necesario
            },
            columns: [
                {
                    title: "Items",
                    field: "item",
                    width: 250,
                    editor: "input",
                    editable: (cell) => !cell.getRow().getData().isStatic,
                },
                {
                    title: "Descripcion",
                    field: "descripcion",
                    width: 400,
                    editable: (cell) => !cell.getRow().getData().isStatic,
                },
                {
                    title: "Und",
                    field: "unidad",
                    width: 80,
                    editor: "input",
                    editable: (cell) => !cell.getRow().getData().isStatic,
                },
                {
                    title: "",
                    width: 50,
                    formatter: (cell: any) => {
                        const data = cell.getRow().getData();
                        if (data.unidad) {
                            return `<button class="btn-show-description" title="Ver/Editar Descripción">📋</button>`;
                        }
                        return "";
                    },
                    cellClick: (e: any, cell: any) => {
                        const row = cell.getRow();
                        if (e.target.classList.contains('btn-show-description')) {
                            e.stopPropagation();
                            showDescription(row);
                        }
                    }
                }
            ],
        });

        tabulatorRef.current = table;

        return () => {
            if (tabulatorRef.current) {
                tabulatorRef.current.destroy();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cargar datos iniciales
    useEffect(() => {
        if (especificacionesId) {
            loadDataFromServer();
        }
    }, [especificacionesId]);

    // ─────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-white">
            <Head title="Especificaciones Técnicas" />

            {/* ── TOOLBAR ─────────────────────────────────────────────── */}
            <div className="bg-[#1e293b] px-4 py-2.5 flex items-center justify-between z-20 flex-shrink-0">
                <h1 className="text-white font-bold text-xs uppercase tracking-wider">
                    ESPECIFICACIONES TÉCNICAS
                </h1>

                <div className="flex gap-2 items-center">
                    {/* Botón Guardar */}
                    <button
                        onClick={handleSaveData}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Guardar
                    </button>

                    {/* Botón Generar Word */}
                    <button
                        onClick={() => setShowWordModal(true)}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Generar Word
                    </button>
                </div>
            </div>

            {/* ── TABLA ────────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden p-4">
                <div ref={tableRef} className="w-full h-full" />
            </div>

            {/* ══════════════════════════════════════════════════════════
                MODAL: WORD (Selección de Secciones)
            ══════════════════════════════════════════════════════════ */}
            {showWordModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowWordModal(false); }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">

                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                Generar Documento Word
                            </h2>
                            <button
                                onClick={() => setShowWordModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                            <p className="text-sm text-gray-600 mb-4">
                                Seleccione las secciones que desea incluir en el documento:
                            </p>

                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.estructura}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, estructura: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Estructuras</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.arquitectura}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, arquitectura: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Arquitectura</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.sanitarias}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, sanitarias: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Instalaciones Sanitarias</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.electricas}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, electricas: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Instalaciones Eléctricas</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.comunicaciones}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, comunicaciones: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Instalaciones de Comunicaciones</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.gas}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, gas: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Instalaciones de Gas</span>
                                </label>
                            </div>

                            {/* Campos ocultos para imágenes (pueden estar en el layout principal) */}
                            <div className="hidden">
                                <input type="file" id="logoFile" accept="image/*" />
                                <input type="file" id="escudoFile" accept="image/*" />
                                <input type="file" id="logoPrinFile" accept="image/*" />
                                <input type="file" id="firmaFile" accept="image/*" />
                            </div>
                        </div>

                        <div className="bg-gray-50 px-5 py-4 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setShowWordModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors"
                                disabled={generatingWord}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerateWord}
                                disabled={generatingWord}
                                className={`px-6 py-2 rounded-md text-xs font-black uppercase shadow-md transition-colors ${
                                    generatingWord
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                {generatingWord ? 'Generando...' : 'Generar Documento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL: DESCRIPCIÓN / DETALLES TÉCNICOS
            ══════════════════════════════════════════════════════════ */}
            {showDescriptionModal && currentData && (
                <div
                    className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowDescriptionModal(false); }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                {currentData.item} - {currentData.descripcion}
                            </h2>
                            <button
                                onClick={() => setShowDescriptionModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <DescriptionEditor
                                detallesTecnicos={currentData.detallesTecnicos || {}}
                                onSave={saveDescription}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: DescriptionEditor
// ─────────────────────────────────────────────────────────────────────────────
interface DescriptionEditorProps {
    detallesTecnicos: DetallesTecnicos;
    onSave: (sections: { title: string; content: string }[]) => void;
}

const DescriptionEditor = ({ detallesTecnicos, onSave }: DescriptionEditorProps) => {
    const [sections, setSections] = useState<{ title: string; content: string }[]>([]);
    const [newSectionTitle, setNewSectionTitle] = useState('');

    useEffect(() => {
        const defaultSections = [
            { title: 'Descripción', content: detallesTecnicos.descripcion || '' },
            { title: 'Método de Ejecución', content: detallesTecnicos.metodo_de_ejecucion || '' },
            { title: 'Método de Medición', content: detallesTecnicos.metodo_de_medicion || '' },
            { title: 'Condiciones de Pago', content: detallesTecnicos.condiciones_de_pago || '' },
        ];

        // Agregar secciones adicionales que puedan existir
        const additionalSections = Object.entries(detallesTecnicos)
            .filter(([key]) => !['descripcion', 'metodo_de_ejecucion', 'metodo_de_medicion', 'condiciones_de_pago'].includes(key))
            .map(([key, value]) => ({
                title: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                content: value || ''
            }));

        setSections([...defaultSections, ...additionalSections]);
    }, [detallesTecnicos]);

    const updateSection = (index: number, content: string) => {
        const newSections = [...sections];
        newSections[index].content = content;
        setSections(newSections);
    };

    const addSection = () => {
        if (newSectionTitle.trim()) {
            setSections([...sections, { title: newSectionTitle.trim(), content: '' }]);
            setNewSectionTitle('');
        }
    };

    const deleteSection = (index: number) => {
        if (sections.length > 1) {
            const newSections = sections.filter((_, i) => i !== index);
            setSections(newSections);
        } else {
            toastr?.warning('Debe mantener al menos una sección');
        }
    };

    const handleSave = () => {
        onSave(sections);
    };

    return (
        <div className="space-y-4">
            {sections.map((section, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-blue-600">{section.title}</h4>
                        <button
                            onClick={() => deleteSection(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                        >
                            🗑️ Eliminar
                        </button>
                    </div>
                    <textarea
                        value={section.content}
                        onChange={(e) => updateSection(index, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        rows={4}
                        placeholder="Agregar contenido..."
                    />
                </div>
            ))}

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="Título de nueva sección"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                    onClick={addSection}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                >
                    Agregar Sección
                </button>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                >
                    Guardar
                </button>
            </div>
        </div>
    );
};

export default EttpIndex;