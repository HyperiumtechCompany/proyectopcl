import React, { useRef, useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import * as toastr from 'toastr';
import 'toastr/build/toastr.min.css';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import WordExportModal from './exportado/exportado';
import EttpHeader from './components/EttpHeader';
import EttpDetailsPanel from './components/EttpDetailsPanel';
import EttpMetradosPanel from './components/EttpMetradosPanel';
import { useEttpTemplates } from './components/useEttpTemplates';
import type { Section, SelectedSections, EttpPageProps, EttpPartidaData } from './components/types';
import { CAMPOS_EXCLUIDOS_TEMPLATE } from './components/types';

declare const Tabulator: any;

const DEFAULT_DATA: EttpPartidaData[] = [
    {
        id: 1, item: '05', descripcion: 'INSTALACIONES ELECTRICAS', unidad: '', _children: [
            {
                id: 2, item: '05.01', descripcion: 'CONEXION A LA RED EXTERNA DE SUMINISTRO DE ENERGIA ELECTRICA', unidad: '', _children: [
                    { id: 3, item: '05.01.01', descripcion: 'ACOMETIDA MONO.FÁSICA DE ENERGÍA ELÉCTRICA DE RED SECUNDARIA CON MEDIDOR.', unidad: 'GLB' },
                    { id: 4, item: '05.01.02', descripcion: 'Acondicionamiento de tubo de FG, tubo PVC y baston para acometida.', unidad: 'GLB' }
                ]
            }
        ]
    }
];

const EttpIndex = ({ proyecto, partidas }: EttpPageProps) => {
    console.log('partidas recibidas:', partidas);

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const tabulatorRef = useRef<any>(null);
    const [datosBase, setDatosBase] = useState<EttpPartidaData[]>(
        partidas && partidas.length > 0 ? partidas : DEFAULT_DATA
    );
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [currentData, setCurrentData] = useState<any>(null);
    const [currentSections, setCurrentSections] = useState<Section[]>([]);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [showMetradosPanel, setShowMetradosPanel] = useState(false);
    const [showWordModal, setShowWordModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingMetrados, setLoadingMetrados] = useState(false);
    const [isWordModalOpen, setIsWordModalOpen] = useState(false);
    const [selectedSections, setSelectedSections] = useState<SelectedSections>({
        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });

    // Hook de templates (solo para enriquecer descripciones si es necesario)
    const { buscarTemplate, extraerDetalles, buildSections, templatesCount } = useEttpTemplates();

    // ─────────────────────────────────────────────
    // FUNCIONES DE UTILIDAD
    // ─────────────────────────────────────────────
    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        if (toastr) toastr[type](message);
        else Swal.fire({ title: type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Éxito', text: message, icon: type });
    };

    const getCsrfToken = (): string => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    // ─────────────────────────────────────────────
    // FUNCIONES DE TRANSFORMACIÓN DE DATOS
    // ─────────────────────────────────────────────
    const mergeSections = (newData: any[], oldData: any[]): any[] => {
        const oldMap = new Map();
        const buildMap = (items: any[]) => {
            items.forEach(item => {
                oldMap.set(item.id, item);
                if (item._children) buildMap(item._children);
            });
        };
        buildMap(oldData);

        const process = (items: any[]): any[] => {
            return items.map(item => {
                const old = oldMap.get(item.id);
                const merged = old && old.secciones ? { ...item, secciones: old.secciones } : item;
                if (merged._children) {
                    merged._children = process(merged._children);
                }
                return merged;
            });
        };
        return process(newData);
    };

    // ✅ Función para enriquecer con plantillas SOLO desde BD (sin JSON local)
    const enrichWithTemplate = (item: any): any => {
        // Si ya tiene secciones, mantenerlas
        if (item.secciones && item.secciones.length > 0) return item;

        // Buscar plantilla en el hook (que debería obtener datos de BD)
        const template = buscarTemplate(item.item);
        if (template) {
            console.log(`📚 Encontré plantilla para ${item.item}: ${item.descripcion}`);
            const detallesTecnicos = extraerDetalles(template);
            const sections = buildSections(detallesTecnicos);
            return { ...item, secciones: sections };
        }
        return { ...item, secciones: [] };
    };

    const enrichTree = (items: any[]): any[] => {
        return items.map(item => {
            const enriched = enrichWithTemplate(item);
            if (enriched._children) {
                enriched._children = enrichTree(enriched._children);
            }
            return enriched;
        });
    };

    // ─────────────────────────────────────────────
    // MANEJADORES DE EVENTOS
    // ─────────────────────────────────────────────
    const handleRowClick = (row: any) => {
        const data = row.getData();
        setSelectedRow(row);
        setCurrentData(data);

        if (data.secciones && data.secciones.length > 0) {
            setCurrentSections(data.secciones);
            setShowDetailsPanel(true);
            return;
        }

        const template = buscarTemplate(data.item);
        if (template) {
            const detallesTecnicos = extraerDetalles(template);
            const sections = buildSections(detallesTecnicos);
            setCurrentSections(sections);
            setShowDetailsPanel(true);
        } else {
            setCurrentSections(buildSections({}));
            setShowDetailsPanel(true);
        }
    };

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

            const rowData = selectedRow.getData();
            rowData.secciones = currentSections;
            rowData.estado = 'en_progreso';
            selectedRow.update(rowData);

            // Actualizar datosBase
            const newData = [...datosBase];
            const updateItem = (items: any[]): boolean => {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].id === rowData.id) {
                        items[i] = { ...items[i], ...rowData };
                        return true;
                    }
                    if (items[i]._children && updateItem(items[i]._children)) return true;
                }
                return false;
            };
            updateItem(newData);
            setDatosBase(newData);
            console.log('✅ datosBase después de guardar (con secciones):', newData);

            Swal.fire({
                title: '¡Guardado!',
                text: 'Las especificaciones se guardaron correctamente',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
            });
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

    // ✅ FUNCIÓN CORREGIDA - SOLO BASE DE DATOS, SIN JSON LOCAL
    const handleLoadMetrados = async () => {
        const proyectoId = proyecto?.id;
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

        setLoadingMetrados(true);
        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
    
            const response = await axios.post(
                `/costos/${proyectoId}/ettp/importar-metrados`,
                options,
                { headers: { 'X-CSRF-TOKEN': getCsrfToken(), 'Content-Type': 'application/json' } }
            );

            Swal.close();

            if (response.data && response.data.length > 0) {
                setDatosBase(response.data);
                showNotification('success', `✅ Se cargaron ${response.data.length} partidas`);
            } else {
                showNotification('warning', 'No se encontraron datos');
            }
        } catch (error: any) {
            Swal.close();
            console.error('[Metrados] Error:', error);
            showNotification('error', error.response?.data?.error || 'Error al cargar datos');
        } finally {
            setLoadingMetrados(false);
        }
    };
    const handleSave = async () => {
        const idProyecto = proyecto?.id;
        if (!idProyecto) {
            showNotification('error', 'ID de proyecto no encontrado');
            return;
        }
        const datosGenerales = tabulatorRef.current?.getData() || [];
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

    const getTableData = () => {
        if (isWordModalOpen) return datosBase;
        return tabulatorRef.current?.getData() || datosBase;
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: proyecto?.nombre, href: `/costos/${proyecto?.id}` },
        { title: 'ETTP', href: '#' }
    ];

    // ─────────────────────────────────────────────
    // INICIALIZACIÓN DE TABULATOR
    // ─────────────────────────────────────────────

    useEffect(() => {
        if (!tableContainerRef.current) return;
        let isMounted = true;
        let retryCount = 0;
        const MAX_RETRIES = 30;

        const initTabulator = () => {
            const TabulatorClass = (window as any).Tabulator;
            if (!TabulatorClass || !tableContainerRef.current) {
                retryCount++;
                if (retryCount < MAX_RETRIES) { setTimeout(initTabulator, 200); }
                else { console.error('[Tabulator] No se pudo inicializar'); }
                return;
            }
            if (!isMounted) return;

            const container = tableContainerRef.current;
            if (container.clientHeight === 0) {
                setTimeout(initTabulator, 100);
                return;
            }

            try {
                const table = new TabulatorClass(container, {
                    data: datosBase,
                    dataTree: true,
                    dataTreeStartExpanded: false,
                    layout: "fitDataFill",
                    height: container.clientHeight,
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
                            formatter: () => {
                                return '<button class="btn-details" style="background:#3b82f6;color:white;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:14px;">📋</button>';
                            },
                            cellClick: (_e: any, cell: any) => handleRowClick(cell.getRow()),
                        },
                    ],
                });
                tabulatorRef.current = table;
                table.on('tableBuilt', () => console.log('[Tabulator] Tabla construida y lista'));
            } catch (error) {
                console.error('[Tabulator] Error al inicializar:', error);
            }
        };

        setTimeout(initTabulator, 100);

        return () => {
            isMounted = false;
            if (tabulatorRef.current) {
                try { tabulatorRef.current.destroy(); } catch (e) { console.warn('[Tabulator] Error al destruir:', e); }
            }
        };
    }, []);

    // Sincronizar datos externos con Tabulator
    useEffect(() => {
        if (tabulatorRef.current && datosBase) {
            tabulatorRef.current.setData(datosBase);
        }
    }, [datosBase]);

    return (
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
                <EttpHeader
                    onToggleMetrados={() => setShowMetradosPanel(prev => !prev)}
                    onSave={handleSave}
                    onShowWordModal={() => {
                        setShowWordModal(true);
                        setIsWordModalOpen(true);
                    }}
                    saving={saving}
                />

                <EttpMetradosPanel
                    show={showMetradosPanel}
                    selectedSections={selectedSections}
                    onSelectedChange={setSelectedSections}
                    onLoadMetrados={handleLoadMetrados}
                    loading={loadingMetrados}
                />

                <div className="flex flex-1 px-4 py-6 gap-4">
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-2/3' : 'w-full'}`}>
                        <div
                            ref={tableContainerRef}
                            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"
                            style={{ height: 'calc(100vh - 180px)' }}
                        />
                    </div>

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

                <WordExportModal
                    isOpen={showWordModal}
                    onClose={() => {
                        setShowWordModal(false);
                        setIsWordModalOpen(false);
                    }}
                    getData={getTableData}
                    showNotification={showNotification}
                />
            </div>
        </AppLayout>
    );
};

export default EttpIndex;