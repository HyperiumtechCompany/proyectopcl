import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useRef, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import * as toastr from 'toastr';
import 'toastr/build/toastr.min.css';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import EttpDetailsPanel from './components/EttpDetailsPanel';
import EttpHeader from './components/EttpHeader';
import EttpMetradosPanel from './components/EttpMetradosPanel';
import type { Section, SelectedSections, EttpPageProps, EttpPartidaData } from './components/types';
import { CAMPOS_EXCLUIDOS_TEMPLATE } from './components/types';
import { useEttpTemplates } from './components/useEttpTemplates';
import WordExportModal from './exportado/exportado';

// @ts-ignore
import 'tabulator-tables/dist/css/tabulator.min.css';

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
    const [isTreeExpanded, setIsTreeExpanded] = useState(false);
    const [savedScrollTop, setSavedScrollTop] = useState(0);
    const [savedExpandedIds, setSavedExpandedIds] = useState<Array<number | string>>([]);
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

    /** Mapea secciones del formato frontend (title/content) al formato backend (titulo/contenido) */
    const mapSectionsForBackend = (sections: Section[]): any[] => {
        return sections.map(s => ({
            id: s.id,
            titulo: s.title,
            slug: s.slug,
            contenido: s.content,
            origen: s.origen,
            orden: s.orden,
        }));
    };

    /** Mapea recursivamente el árbol de partidas para el backend */
    const mapTreeForBackend = (nodes: any[]): any[] => {
        return nodes.map(node => {
            const mapped: any = { ...node };
            if (mapped.secciones && Array.isArray(mapped.secciones)) {
                mapped.secciones = mapSectionsForBackend(mapped.secciones);
            }
            if (mapped._children && Array.isArray(mapped._children)) {
                mapped._children = mapTreeForBackend(mapped._children);
            }
            return mapped;
        });
    };


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

    const removeTreeItemById = (items: any[], idToRemove: number | string): any[] => {
        return items.reduce((acc: any[], item) => {
            if (item.id === idToRemove) {
                return acc;
            }

            const updatedItem = { ...item };
            if (updatedItem._children) {
                updatedItem._children = removeTreeItemById(updatedItem._children, idToRemove);
                if (updatedItem._children.length === 0) {
                    delete updatedItem._children;
                }
            }

            acc.push(updatedItem);
            return acc;
        }, []);
    };

    const handleDeleteRow = async (row: any) => {
        const data = row.getData();
        if (!data || !proyecto?.id) return;

        const result = await Swal.fire({
            title: 'Eliminar partida',
            text: `¿Eliminar "${data.item} ${data.descripcion}" y todas sus secciones e imágenes?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });

        if (!result.isConfirmed) return;

        try {
            await axios.delete(`/costos/${proyecto.id}/ettp/partida/${data.id}`, {
                headers: { 'X-CSRF-TOKEN': getCsrfToken() },
            });

            const newData = removeTreeItemById(datosBase, data.id);
            setDatosBase(newData);
            if (tabulatorRef.current) {
                tabulatorRef.current.setData(newData);
            }

            if (selectedRow?.getData()?.id === data.id) {
                setSelectedRow(null);
                setCurrentData(null);
                setCurrentSections([]);
                setShowDetailsPanel(false);
            }

            showNotification('success', 'Partida eliminada correctamente.');
        } catch (error: any) {
            console.error('[Eliminar partida] Error:', error);
            showNotification('error', error.response?.data?.error || 'Error al eliminar la partida');
        }
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
    const handleToggleExpand = () => {
        if (!tabulatorRef.current) return;

        const expandNode = (row: any) => {
            row.treeExpand();
            const children = row.getTreeChildren() || [];
            children.forEach(expandNode);
        };

        const collapseNode = (row: any) => {
            row.treeCollapse();
            const children = row.getTreeChildren() || [];
            children.forEach(collapseNode);
        };

        // Pause redraw for performance
        tabulatorRef.current.blockRedraw();

        const rows = tabulatorRef.current.getRows();
        if (isTreeExpanded) {
            rows.forEach(collapseNode);
        } else {
            rows.forEach(expandNode);
        }

        tabulatorRef.current.restoreRedraw();
        setIsTreeExpanded(!isTreeExpanded);
    };

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
            Swal.fire({
                title: 'Detalles Técnicos',
                text: 'Esta partida no tiene detalles técnicos guardados. ¿Desea llenarlos desde la plantilla o crear secciones en blanco?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Llenar desde Plantilla',
                cancelButtonText: 'En Blanco'
            }).then((result) => {
                if (result.isConfirmed) {
                    const detallesTecnicos = extraerDetalles(template);
                    const sections = buildSections(detallesTecnicos);
                    setCurrentSections(sections);
                } else {
                    setCurrentSections(buildSections({}));
                }
                setShowDetailsPanel(true);
            });
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
            const response = await axios.put(`/costos/${proyecto?.id}/ettp/partida/${currentData.id}/secciones`, {
                secciones: mapSectionsForBackend(currentSections)
            }, { headers: { 'X-CSRF-TOKEN': getCsrfToken() } });

            // Recuperamos las secciones actualizadas con sus nuevos IDs de DB
            const updatedSections = response.data.secciones || currentSections;

            const rowData = selectedRow.getData();
            rowData.secciones = updatedSections;
            rowData.estado = 'en_progreso';
            selectedRow.update(rowData);

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
            setCurrentSections(updatedSections);
            console.log('✅ datosBase después de guardar (con secciones reales referenciadas):', newData);

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
            console.error('[Guardar Secciones] Response:', error?.response?.data);
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
            estructuras: selectedSections.estructura ? 1 : 0,
            arquitectura: selectedSections.arquitectura ? 1 : 0,
            sanitarias: selectedSections.sanitarias ? 1 : 0,
            electricas: selectedSections.electricas ? 1 : 0,
            comunicaciones: selectedSections.comunicaciones ? 1 : 0,
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
                setShowMetradosPanel(false);
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
                { especificaciones_tecnicas: mapTreeForBackend(datosGenerales) },
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

    const captureTableState = () => {
        if (!tabulatorRef.current) return;
        const rows = tabulatorRef.current.getRows() || [];
        const expandedIds: Array<number | string> = [];
        rows.forEach((row: any) => {
            if (typeof row.isTreeExpanded === 'function' && row.isTreeExpanded()) {
                expandedIds.push(row.getData()?.id);
            }
        });
        setSavedExpandedIds(expandedIds);
    };

    const restoreTableState = () => {
        if (!tabulatorRef.current) return;
        const rows = tabulatorRef.current.getRows() || [];
        rows.forEach((row: any) => {
            const rowId = row.getData()?.id;
            if (savedExpandedIds.includes(rowId)) {
                row.treeExpand();
            } else {
                row.treeCollapse();
            }
        });
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = savedScrollTop;
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: proyecto?.nombre ?? 'Proyecto', href: `/costos/${proyecto?.id}` },
        { title: 'ETTP', href: '#' },
    ];

    // ─────────────────────────────────────────────
    // EFECTOS
    // ─────────────────────────────────────────────

    // Inicializar Tabulator
    useEffect(() => {
        let isMounted = true;
        const container = tableContainerRef.current;

        if (!container) return;

        const initTabulator = () => {
            if (!isMounted || !container) return;
            try {
                const table = new Tabulator(container, {
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
                        { title: 'Items', field: 'item', width: 120, minWidth: 100, responsive: 0 },
                        { title: 'Descripción', field: 'descripcion', minWidth: 300, widthGrow: 2, formatter: 'textarea', responsive: 1 },
                    { title: 'Und', field: 'unidad', width: 70, responsive: 2 },
                    {
                        title: '',
                        width: 110,
                        hozAlign: 'center',
                        headerSort: false,
                        responsive: 0,
                        formatter: () => '<button class="btn-delete" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:13px;">🗑️ Eliminar</button>',
                        cellClick: (_e: any, cell: any) => {
                            handleDeleteRow(cell.getRow());
                        },
                    },
                    {
                        title: '', width: 60, responsive: 0,
                        formatter: (_cell: any, _formatterParams: any, onRendered: any) => {
                            const data = _cell.getRow().getData();
                            const unidad = (data.unidad || '').toString().trim();
                            if (!unidad) return '';
                            return '<button class="btn-details" style="background:#3b82f6;color:white;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:14px;">📋</button>';
                        },
                        cellClick: (_e: any, cell: any) => {
                            const data = cell.getRow().getData();
                            const unidad = (data.unidad || '').toString().trim();
                            if (!unidad) return; // No hacer nada si no tiene unidad
                            handleRowClick(cell.getRow());
                        },
                    },
                    ],
                });
                tabulatorRef.current = table;
                table.on('tableBuilt', () => console.log('[Tabulator] Tabla construida y lista'));
            } catch (error) {
                console.error('[Tabulator] Error al inicializar:', error);
            }
        };

        const timeoutId = setTimeout(initTabulator, 100);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (tabulatorRef.current) {
                try {
                    tabulatorRef.current.destroy();
                } catch (e) {
                    console.warn('[Tabulator] Error al destruir:', e);
                }
            }
        };
    }, []); // Dependencia vacía, se inicializa una sola vez

    // Sincronizar datos externos con Tabulator
    useEffect(() => {
        if (tabulatorRef.current && datosBase) {
            tabulatorRef.current.setData(datosBase);
        }
    }, [datosBase]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Especificaciones Técnicas" />

            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                <EttpHeader
                    onToggleMetrados={() => setShowMetradosPanel(prev => !prev)}
                    onSave={handleSave}
                    onShowWordModal={() => {
                        if (tableContainerRef.current) {
                            setSavedScrollTop(tableContainerRef.current.scrollTop);
                        }
                        captureTableState();
                        setShowWordModal(true);
                        setIsWordModalOpen(true);
                    }}
                    onToggleExpand={handleToggleExpand}
                    isExpanded={isTreeExpanded}
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
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-full md:w-1/3 lg:w-2/4' : 'w-full'}`}>
                        <div
                            ref={tableContainerRef}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
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
                        restoreTableState();
                    }}
                    getData={getTableData}
                    showNotification={showNotification}
                    proyecto={proyecto}
                />
            </div>
        </AppLayout>
    );
};

export default EttpIndex;
