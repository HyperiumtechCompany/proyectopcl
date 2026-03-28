import React, { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import * as toastr from 'toastr';
import 'toastr/build/toastr.min.css';

import WordExportModal from './exportado/exportado';
import templatesData from './componente/descriptivos-templates.json';  // <-- IMPORTACIÓN DEL JSON

declare const Tabulator: any;


// Componentes
import EttpHeader from './components/EttpHeader';
import EttpTable, { EttpTableRef } from './components/EttpTable';
import EttpDetailsPanel from './components/EttpDetailsPanel';
import EttpMetradosPanel from './components/EttpMetradosPanel';
import EttpWordModal from './components/EttpWordModal';
import { useEttpTemplates } from './components/useEttpTemplates';
import type { Section, SelectedSections, EttpPageProps, EttpPartidaData } from './components/types';
import { CAMPOS_EXCLUIDOS_TEMPLATE } from './components/types';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';


// ─────────────────────────────────────────────
// DATOS POR DEFECTO
// ─────────────────────────────────────────────

const DEFAULT_DATA: EttpPartidaData[] = [
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
                    { id: 3, item: '05.01.01', descripcion: 'ACOMETIDA MONO.FÁSICA DE ENERGÍA ELÉCTRICA DE RED SECUNDARIA CON MEDIDOR.', unidad: 'GLB' },
                    { id: 4, item: '05.01.02', descripcion: 'Acondicionamiento de tubo de FG, tubo PVC y baston para acometida.', unidad: 'GLB' },
                ],
            },
        ],
    },
];

// ─────────────────────────────────────────────

// CAMPOS DEL JSON DE TEMPLATES QUE SE EXCLUYEN
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

const EttpIndex = ({ proyecto, partidas }: EttpPageProps) => {
    // ── Refs ──────────────────────────────────

    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorRef = useRef<any>(null);
    const templatesRef = useRef<any[]>([]);

    const tableRef = useRef<EttpTableRef>(null);


    // ── Estado ────────────────────────────────
    const [datosBase, setDatosBase] = useState<EttpPartidaData[]>(partidas || DEFAULT_DATA);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [currentData, setCurrentData] = useState<any>(null);
    const [currentSections, setCurrentSections] = useState<Section[]>([]);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [showMetradosPanel, setShowMetradosPanel] = useState(false);
    const [showWordModal, setShowWordModal] = useState(false);

    const [selectedSectionsMetrados, setSelectedSectionsMetrados] = useState({
    const [saving, setSaving] = useState(false);
    const [loadingMetrados, setLoadingMetrados] = useState(false);
    const [selectedSections, setSelectedSections] = useState<SelectedSections>({

        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });

    // ── Hook de templates ─────────────────────
    const { buscarTemplate, extraerDetalles, buildSections, templatesCount } = useEttpTemplates();

    // ─────────────────────────────────────────
    // UTILIDADES
    // ─────────────────────────────────────────

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

    const getCsrfToken = (): string =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    // ─────────────────────────────────────────

    // BÚSQUEDA DE TEMPLATES
    // ─────────────────────────────────────────

    const buscarTemplateRecursivo = (templates: any[], codigoABuscar: string): any => {
        if (!templates?.length) return null;

        const codigoNorm = codigoABuscar.toString().trim().toLowerCase();

        const buscarEnNivel = (items: any[]): any => {
            if (!items?.length) return null;

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

    const buildSections = (detallesTecnicos: Record<string, any>): Section[] => {
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

        for (const { jsonKey, title } of fieldMapping) {
            if (detallesTecnicos[jsonKey]) {
                sections.push({ title, content: detallesTecnicos[jsonKey] });
            }
        }

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

    const showDescription = (row: any) => {

    // PANEL DE DETALLES TÉCNICOS
    // ─────────────────────────────────────────

    /** Abre el panel lateral al hacer click en 📋 */
    const handleRowClick = (row: any) => {

        const data = row.getData();
        setSelectedRow(row);
        setCurrentData(data);


        console.log(`[Detalles] Item seleccionado: ${data.item}`);
        console.log(`[Detalles] Templates disponibles: ${templatesRef.current.length}`);

        if (!templatesRef.current.length) {
            console.warn('[Detalles] No hay templates cargados aún');
            setCurrentSections(buildSections(data.detallesTecnicos || {}));

        // Caso 1: Ya tiene secciones grabadas en la base de datos
        if (data.secciones && data.secciones.length > 0) {
            setCurrentSections(data.secciones);

            setShowDetailsPanel(true);
            return;
        }

        // Caso 2: No tiene secciones (partida nueva o recién importada sin contenido)
        if (!templatesCount()) {
            console.warn('[Detalles] No hay templates cargados aún');
            setCurrentSections(buildSections({}));
            setShowDetailsPanel(true);
            return;
        }

        const template = buscarTemplate(data.item);

        if (template) {
            Swal.fire({
                title: '¡Plantilla encontrada!',
                text: `Se encontró una plantilla para "${data.item}". ¿Desea cargar los detalles predefinidos?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Sí, cargar',
                cancelButtonText: 'No, dejar vacío',
            }).then(result => {
                if (result.isConfirmed) {

                    const detallesTecnicos: Record<string, any> = {};
                    Object.keys(template).forEach(campo => {
                        if (!CAMPOS_EXCLUIDOS_TEMPLATE.includes(campo)) {
                            detallesTecnicos[campo] = template[campo];
                        }
                    });
                    data.detallesTecnicos = detallesTecnicos;
                    row.update(data);

                    const detallesTecnicos = extraerDetalles(template);
                    const sections = buildSections(detallesTecnicos);
                    setCurrentSections(sections);
                } else {
                    setCurrentSections(buildSections({}));

                }
                setShowDetailsPanel(true);
            });
        } else {

            setCurrentSections(buildSections(data.detallesTecnicos || {}));

            setCurrentSections(buildSections({}));

            setShowDetailsPanel(true);
        }
    };


    const saveDescription = () => {
        if (!selectedRow) {
            showNotification('error', 'No hay una fila seleccionada');

    /** Guarda las secciones editadas en el servidor y sincroniza la tabla */
    const handleSaveDescription = async () => {
        if (!selectedRow || !currentData) {
            showNotification('error', 'No hay una partida seleccionada');

            return;
        }

        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            await axios.put(`/costos/${proyecto?.id}/ettp/partida/${currentData.id}/secciones`, {
                secciones: currentSections
            }, { headers: { 'X-CSRF-TOKEN': getCsrfToken() } });

            // Actualizar la fila en Tabulator para reflejar que tiene datos (y por si cambió algo)
            const rowData = selectedRow.getData();
            rowData.secciones = currentSections;
            rowData.estado = 'en_progreso';
            selectedRow.update(rowData);

            Swal.fire({
                title: '¡Guardado!',
                text: 'Las especificaciones se guardaron correctamente',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
            });


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

            setShowDetailsPanel(false);
        } catch (error: any) {
            console.error('[Guardar Secciones] Error:', error);
            Swal.fire({
                title: 'Error',
                text: error.response?.data?.error || 'No se pudieron guardar las secciones',
                icon: 'error'
            });
        }

    };

    // ─────────────────────────────────────────
    // CARGA DE METRADOS
    // ─────────────────────────────────────────


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

    const handleLoadMetrados = async () => {
        if (!tabulatorRef.current) {
            console.warn('[Metrados] Tabla no inicializada, esperando...');
            setTimeout(handleLoadMetrados, 500);
            return;
        }


    const handleLoadMetrados = async () => {

        const proyectoId = (document.getElementById('proyecto_id') as HTMLInputElement)?.value
            || proyecto?.id;

        if (!proyectoId) {
            showNotification('error', 'Debe seleccionar un proyecto');
            return;
        }

        const options = {
            estructura: selectedSectionsMetrados.estructura ? 1 : 0,
            arquitectura: selectedSectionsMetrados.arquitectura ? 1 : 0,
            sanitarias: selectedSectionsMetrados.sanitarias ? 1 : 0,
            electricas: selectedSectionsMetrados.electricas ? 1 : 0,
            comunicacion: selectedSectionsMetrados.comunicaciones ? 1 : 0,
            gas: selectedSectionsMetrados.gas ? 1 : 0,
        };

        if (!Object.values(options).some(v => v === 1)) {
            showNotification('error', 'Seleccione al menos una categoría');
            return;
        }

        setLoadingMetrados(true);
        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const response = await axios.post(
                `/costos/${proyectoId}/ettp/importar-metrados`,
                { ...options },
                { headers: { 'X-CSRF-TOKEN': getCsrfToken(), 'Content-Type': 'application/json' } }
            );



            Swal.close();
            const rawData = response.data;


            if (!rawData?.length) {
                showNotification('warning', 'No se encontraron datos para las especialidades seleccionadas');
                return;
            }

            setDatosBase(rawData);
            showNotification('success', `✅ Se cargaron ${rawData.length} registros`);
        } catch (error) {
            Swal.close();
            console.error('[Metrados] Error:', error);
            showNotification('error', 'Error al cargar los datos');
        } finally {
            setLoadingMetrados(false);
        }
    };

    // ─────────────────────────────────────────
    // GUARDAR EN SERVIDOR
    // ─────────────────────────────────────────


    const handleSaveData = async () => {
        const idProyecto = especificacionesId || proyecto?.id;

    const handleSave = async () => {
        const idProyecto = proyecto?.id;


        if (!idProyecto) {
            showNotification('error', 'ID de proyecto no encontrado');
            return;
        }

        const datosGenerales = tableRef.current?.getData() || [];

        setSaving(true);
        try {
            await axios.post(
                `/costos/${idProyecto}/ettp/guardar-general`,
                { especificaciones_tecnicas: datosGenerales },
                { headers: { 'X-CSRF-TOKEN': getCsrfToken() } }
            );
            Swal.fire({ title: 'Éxito', text: 'Datos guardados correctamente', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            console.error('[Guardar] Error:', error.response?.data);
            Swal.fire({ title: 'Error', text: error.response?.data?.error || 'No se pudieron guardar los datos', icon: 'error' });
        } finally {
            setSaving(false);
        }
    };


    // ─────────────────────────────────────────
    // CARGAR DATOS DEL SERVIDOR
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
    // FUNCIÓN PARA OBTENER DATOS PARA EXPORTACIÓN
    // ─────────────────────────────────────────

    const getTableData = () => {
        return tabulatorRef.current?.getData() || datosBase;
    };

    // ─────────────────────────────────────────
    // EFECTOS
    // ─────────────────────────────────────────

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
                        { title: 'Items', field: 'item', width: 150, responsive: 0, editor: 'input' },
                        { title: 'Descripción', field: 'descripcion', width: 300, responsive: 1, editor: 'input' },
                        { title: 'Und', field: 'unidad', width: 70, responsive: 2, editor: 'input' },
                        {
                            title: '', width: 60, responsive: 0,
                            formatter: (cell: any) => {
                                const data = cell.getRow().getData();
                                if (!data.unidad) return '';
                                return '<button class="btn-details" style="background:#3b82f6;color:white;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:14px;">📋</button>';
                            },
                            cellClick: (_e: any, cell: any) => { showDescription(cell.getRow()); },
                        },
                    ],
                });

                tabulatorRef.current = table;
                table.on('tableBuilt', () => { console.log('[Tabulator] Tabla construida y lista'); });

            } catch (error) {
                console.error('[Tabulator] Error al inicializar:', error);
            }
        };

        initTabulator();

        // Cargar templates desde el JSON importado (en lugar de fetch)
        console.log(`[Templates] Cargados: ${templatesData.length} registros`);
        templatesRef.current = templatesData;

        return () => {
            isMounted = false;
            if (tabulatorRef.current) {
                try { tabulatorRef.current.destroy(); } catch (e) { console.warn('[Tabulator] Error al destruir:', e); }
            }
        };
    }, []);

    useEffect(() => {
        if (tabulatorRef.current && datosBase) {
            try { tabulatorRef.current.setData(datosBase); } catch (error) { console.warn('[Tabulator] No se pudo actualizar datos:', error); }
        }
    }, [datosBase]);

    useEffect(() => {
        if (especificacionesId) loadDataFromServer();
    }, [especificacionesId]);

      const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos',             href: '/costos' },
        { title: proyecto?.nombre,       href: `/costos/${proyecto?.id}` },
        { title: 'ETTP', href: '#' },
      ];


    // ─────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────

    return (
        <>
        <AppLayout breadcrumbs={breadcrumbs}>
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
                @media (max-width: 768px) {
                    .tabulator .tabulator-cell {padding:6px 4px !important;font-size:11px !important}
                    .tabulator .tabulator-col-title {font-size:10px !important}
                    .tabulator .tabulator-cell .btn-details {padding:4px 6px !important;font-size:12px !important}
                    .w-1\\/3,.w-2\\/3 {width:100% !important}
                }
                @media (min-width:769px) and (max-width:1024px) {
                    .tabulator .tabulator-cell {padding:8px 6px !important}
                    .tabulator .tabulator-col-title {font-size:11px !important}
                }
            `}</style>
            <div className="min-h-screen bg-gray-50">
                <div className="bg-gray-800 shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                        <h1 className="text-white font-bold text-lg">ESPECIFICACIONES TÉCNICAS</h1>
                        <div className="flex gap-3">
                            <button onClick={() => setShowMetradosPanel(p => !p)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition">📊 Cargar Metrados</button>
                            <button onClick={handleSaveData} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium transition">💾 Guardar</button>
                            <button onClick={() => setShowWordModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition">📄 Generar Word</button>
                        </div>
                    </div>
                </div>

                {showMetradosPanel && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
                        <div className="max-w-7xl mx-auto px-6 py-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-bold text-blue-800 uppercase tracking-wide">📋 ESPECIALIDADES</span>
                                <div className="flex-1 h-px bg-blue-200" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {[
                                    { key: 'estructura', label: '🏗️ Estructuras', desc: 'Metrados de concreto y acero' },
                                    { key: 'arquitectura', label: '🏛️ Arquitectura', desc: 'Acabados y elementos arquitectónicos' },
                                    { key: 'sanitarias', label: '🚰 Inst. Sanitarias', desc: 'Agua y desagüe' },
                                    { key: 'electricas', label: '⚡ Inst. Eléctricas', desc: 'Iluminación y fuerza' },
                                    { key: 'comunicaciones', label: '📡 Comunicaciones', desc: 'Datos y telefonía' },
                                    { key: 'gas', label: '🔥 Inst. de Gas', desc: 'Redes de gas natural' },
                                ].map(({ key, label, desc }) => (
                                    <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedSectionsMetrados[key as keyof typeof selectedSectionsMetrados]} 
                                            onChange={e => setSelectedSectionsMetrados(prev => ({ ...prev, [key]: e.target.checked }))} 
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
                                <button onClick={handleLoadMetrados} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-2">📥 Cargar Datos Seleccionados</button>
                            </div>
                        </div>
                    </div>
                )}


            <div className="h-full bg-gray-100 flex flex-col">

                {/* Header */}
                <EttpHeader
                    onToggleMetrados={() => setShowMetradosPanel(prev => !prev)}
                    onSave={handleSave}
                    onShowWordModal={() => setShowWordModal(true)}
                    saving={saving}
                />

                {/* Panel de selección de metrados */}
                <EttpMetradosPanel
                    show={showMetradosPanel}
                    selectedSections={selectedSections}
                    onSelectedChange={setSelectedSections}
                    onLoadMetrados={handleLoadMetrados}
                    loading={loadingMetrados}
                />

                {/* Layout: Tabla + Panel lateral */}

                <div className="flex flex-1 px-4 py-6 gap-4">
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-2/3' : 'w-full'}`}>

                        <div ref={tableRef} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200" style={{ height: 'calc(100vh - 180px)' }} />
                    </div>

                    {showDetailsPanel && currentData && (
                        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-xs uppercase tracking-wide opacity-80">Detalles Técnicos</p>
                                        <h3 className="text-sm font-bold mt-1 truncate">{currentData.item} — {currentData.descripcion}</h3>
                                    </div>
                                    <button onClick={() => setShowDetailsPanel(false)} className="text-white hover:text-gray-200 text-2xl leading-none ml-2">&times;</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                {currentSections.map((section, idx) => (
                                    <div key={idx} className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden shadow-sm">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                            <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wide">{section.title}</h4>
                                            <div className="flex gap-2">
                                                <button onClick={() => insertImage(idx)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">🖼️ Imagen</button>
                                                <button onClick={() => { if (currentSections.length > 1) { setCurrentSections(prev => prev.filter((_, i) => i !== idx)); } else { showNotification('warning', 'Debe mantener al menos una sección'); } }} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                                            </div>
                                        </div>
                                        <div 
                                            contentEditable 
                                            suppressContentEditableWarning 
                                            onBlur={(e) => { const updated = [...currentSections]; updated[idx] = { ...updated[idx], content: e.currentTarget.innerHTML }; setCurrentSections(updated); }} 
                                            className="w-full p-4 text-sm focus:outline-none min-h-[150px]" 
                                            dangerouslySetInnerHTML={{ __html: section.content }} 
                                        />
                                    </div>
                                ))}
                                <div className="mt-4 flex gap-2">
                                    <input 
                                        type="text" 
                                        id="newSectionPanel" 
                                        placeholder="Nombre de nueva sección" 
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" 
                                        onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setCurrentSections(prev => [...prev, { title: e.currentTarget.value.trim(), content: '' }]); e.currentTarget.value = ''; } }} 
                                    />
                                    <button 
                                        onClick={() => { const input = document.getElementById('newSectionPanel') as HTMLInputElement; if (input?.value.trim()) { setCurrentSections(prev => [...prev, { title: input.value.trim(), content: '' }]); input.value = ''; } }} 
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>
                            <div className="border-t p-3 bg-white flex justify-end gap-2">
                                <button onClick={() => setShowDetailsPanel(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                                <button onClick={saveDescription} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Guardar Cambios</button>
                            </div>
                        </div>
                    )}
                </div>

                <WordExportModal
                    isOpen={showWordModal}
                    onClose={() => setShowWordModal(false)}
                    getData={getTableData}

                        <EttpTable
                            ref={tableRef}
                            data={datosBase}
                            onRowClick={handleRowClick}
                        />
                    </div>

                    {/* Panel lateral de detalles técnicos */}
                    <EttpDetailsPanel
                        show={showDetailsPanel}
                        currentData={currentData}
                        sections={currentSections}
                        onSectionsChange={setCurrentSections}
                        onClose={() => setShowDetailsPanel(false)}
                        onSave={handleSaveDescription}
                        showNotification={showNotification}
                        proyectoId={proyecto?.id}
                    />
                </div>

                {/* Modal Word */}
                <EttpWordModal
                    show={showWordModal}
                    selectedSections={selectedSections}
                    onSelectedChange={setSelectedSections}
                    onClose={() => setShowWordModal(false)}
                    getData={() => tableRef.current?.getData() || datosBase}

                    showNotification={showNotification}
                />
            </div>
        </AppLayout>
        </>
    );
};

export default EttpIndex;