import React, { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import toastr from 'toastr';
import 'toastr/build/toastr.min.css';

// Componentes
import EttpHeader from './components/EttpHeader';
import EttpTable, { EttpTableRef } from './components/EttpTable';
import EttpDetailsPanel from './components/EttpDetailsPanel';
import EttpMetradosPanel from './components/EttpMetradosPanel';
import EttpWordModal from './components/EttpWordModal';
import { useEttpTemplates } from './components/useEttpTemplates';
import type { Section, SelectedSections, EttpPageProps, EttpPartidaData } from './components/types';
import { CAMPOS_EXCLUIDOS_TEMPLATE } from './components/types';

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
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

const EttpIndex = ({ proyecto, partidas }: EttpPageProps) => {
    // ── Refs ──────────────────────────────────
    const tableRef = useRef<EttpTableRef>(null);

    // ── Estado ────────────────────────────────
    const [datosBase, setDatosBase] = useState<EttpPartidaData[]>(partidas || DEFAULT_DATA);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [currentData, setCurrentData] = useState<any>(null);
    const [currentSections, setCurrentSections] = useState<Section[]>([]);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [showMetradosPanel, setShowMetradosPanel] = useState(false);
    const [showWordModal, setShowWordModal] = useState(false);
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
    // PANEL DE DETALLES TÉCNICOS
    // ─────────────────────────────────────────

    /** Abre el panel lateral al hacer click en 📋 */
    const handleRowClick = (row: any) => {
        const data = row.getData();
        setSelectedRow(row);
        setCurrentData(data);

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

    const handleLoadMetrados = async () => {
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
    // RENDER
    // ─────────────────────────────────────────

    return (
        <>
            <Head title="Especificaciones Técnicas" />
            <div className="min-h-screen bg-gray-100 flex flex-col">

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

                    {/* Tabla */}
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-2/3' : 'w-full'}`}>
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
        </>
    );
};

export default EttpIndex;