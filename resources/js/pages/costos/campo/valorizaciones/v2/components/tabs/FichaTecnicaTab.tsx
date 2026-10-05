import React, { useEffect, useState } from 'react';
import { useValorizacionStore } from '../../stores/useValorizacionStore';
import { FichaTecnica } from '../../types';
import { calcPlazo, calcFechaFin, formatLima } from '../../utils/date-helpers';
import { D, fmtMoney, fmtPct } from '../../utils/decimal-helpers';

export default function FichaTecnicaTab() {
    const { fichaTecnica, setFichaTecnica } = useValorizacionStore();
    
    // Si no hay ficha técnica en el store, cargamos unos datos por defecto
    // para demostración. En producción esto vendría del servidor.
    useEffect(() => {
        if (!fichaTecnica) {
            setFichaTecnica({
                entidad: 'MUNICIPALIDAD DISTRITAL DE PILLCO MARCA',
                obra: '"MEJORAMIENTO Y AMPLIACIÓN DE LOS SERVICIOS DE TRANSITABILIDAD VEHICULAR Y PEATONAL DEL JR LOS PINOS Y JR LOS CEDROS EN CAYHUAYNA Y CAYHUAYNA DEL DISTRITO DE PILLCO MARCA - PROVINCIA DE HUÁNUCO - DEPARTAMENTO DE HUÁNUCO" con CUI N°2536252',
                codigoUnicoInversion: '2536252',
                sector: 'GOBIERNOS LOCALES',
                sistemaContratacion: 'A SUMA ALZADA',
                modalidadEjecucion: 'ADMINISTRACION DIRECTA',
                ubicacion: {
                    region: 'HUÁNUCO',
                    provincia: 'HUÁNUCO',
                    distrito: 'PILLCO MARCA',
                    lugar: 'CAYHUAYNA',
                },
                valorReferencial: D(638827.47),
                montoContrato: D(638827.47),
                porcentajeGG: D(0.075),
                porcentajeUtilidad: D(0.05),
                porcentajeIGV: D(0.18),
                fechaBase: '2026-06-01',
                fechaFirmaContrato: '2026-05-15',
                fechaEntregaTerreno: '2026-05-18',
                fechaInicioPlazo: '2026-06-20',
                plazoEjecucionDias: 90,
                fechaTerminoCalculada: '2026-09-17',
                ejecutor: 'CONSORCIO EJECUTOR LOS PINOS',
                supervisor: 'CONSORCIO SUPERVISOR LOS PINOS',
                residente: 'ING. DENNIS JHAIR ESPINOZA AGUIRRE',
                ingSupervisor: 'ING. CARLOS PEREZ',
            });
        }
    }, [fichaTecnica, setFichaTecnica]);

    if (!fichaTecnica) return <div className="p-8 text-center text-gray-500">Cargando ficha técnica...</div>;

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );

    const Field = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-0">
            <dt className="text-sm font-medium text-gray-600 md:col-span-1">{label}</dt>
            <dd className={`text-sm md:col-span-2 ${highlight ? 'font-semibold text-blue-700' : 'text-gray-900'}`}>
                {value || '-'}
            </dd>
        </div>
    );

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Ficha Técnica del Proyecto</h2>
                <p className="text-gray-500">Datos maestros de la valorización. Cualquier cambio aquí afectará todas las hojas.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Section title="A. Datos Generales">
                        <Field label="Entidad" value={fichaTecnica.entidad} />
                        <Field label="Obra" value={fichaTecnica.obra} highlight />
                        <Field label="CUI" value={fichaTecnica.codigoUnicoInversion} />
                        <Field label="Sector" value={fichaTecnica.sector} />
                        <Field label="Sistema Contratación" value={fichaTecnica.sistemaContratacion} />
                        <Field label="Modalidad Ejecución" value={fichaTecnica.modalidadEjecucion} />
                        <Field label="Ubicación" value={`${fichaTecnica.ubicacion.lugar}, ${fichaTecnica.ubicacion.distrito}, ${fichaTecnica.ubicacion.provincia} - ${fichaTecnica.ubicacion.region}`} />
                    </Section>

                    <Section title="C. Porcentajes Presupuestales">
                        <Field label="Gastos Generales" value={fmtPct(fichaTecnica.porcentajeGG)} />
                        <Field label="Utilidad" value={fmtPct(fichaTecnica.porcentajeUtilidad)} />
                        <Field label="IGV" value={fmtPct(fichaTecnica.porcentajeIGV)} />
                    </Section>
                </div>

                <div className="space-y-6">
                    <Section title="B. Datos Económicos">
                        <Field label="Valor Referencial" value={fmtMoney(fichaTecnica.valorReferencial)} />
                        <Field label="Monto del Contrato" value={`${fmtMoney(fichaTecnica.montoContrato)} (Inc. IGV)`} highlight />
                    </Section>

                    <Section title="D. Plazos y Fechas">
                        <Field label="Fecha Base" value={formatLima(fichaTecnica.fechaBase)} />
                        <Field label="Firma de Contrato" value={formatLima(fichaTecnica.fechaFirmaContrato)} />
                        <Field label="Entrega de Terreno" value={formatLima(fichaTecnica.fechaEntregaTerreno)} />
                        <Field label="Inicio de Plazo" value={formatLima(fichaTecnica.fechaInicioPlazo)} highlight />
                        <Field label="Plazo de Ejecución" value={`${fichaTecnica.plazoEjecucionDias} Días Calendario`} highlight />
                        <Field label="Término (Calculado)" value={formatLima(fichaTecnica.fechaTerminoCalculada)} />
                    </Section>

                    <Section title="E. Equipo de Obra">
                        <Field label="Ejecutor" value={fichaTecnica.ejecutor} />
                        <Field label="Supervisor" value={fichaTecnica.supervisor} />
                        <Field label="Residente de Obra" value={fichaTecnica.residente} />
                        <Field label="Ing. Supervisor" value={fichaTecnica.ingSupervisor} />
                    </Section>
                </div>
            </div>
        </div>
    );
}
