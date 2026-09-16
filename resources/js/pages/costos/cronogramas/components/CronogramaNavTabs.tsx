import React, { useEffect, useRef } from 'react';

export type CronogramaTab =
    | 'valorizado'
    | 'ejecutado'
    | 'control'
    | 'progvsejec'
    | 'curvaS'
    | 'controlFisico'
    | 'adelantos'
    | 'rfc'
    | 'resumenVal'
    | 'controlFinanciero'
    | 'pagoMensual'
    | 'pagosAcumulados'
    | 'controlPagos'
    | 'rhEm'
    | 'materiales';

/**
 * Qué tan "llenas" están las 3 fuentes de datos del módulo — lo calcula
 * CronogramaEstadoService en el backend y cada controlador se lo pasa a su
 * página. Sirve para alertar en la barra de navegación, aunque estés
 * parado en OTRA hoja, cuál pestaña necesita que rellenes algo para que
 * las hojas que dependen de ella funcionen.
 */
export interface CronogramaEstado {
    sinProgramado: boolean;
    sinEjecutado: boolean;
    sinMontoContrato: boolean;
}

interface CronogramaNavTabsProps {
    project: string;
    modoCalculo: 'calendario' | '30dias';
    active: CronogramaTab;
    estado?: CronogramaEstado;
    // Si la hoja actual tiene edición local con auto-guardado pendiente
    // (debounce), este callback se espera ANTES de navegar — sin esto, un
    // clic en otra pestaña justo después de teclear puede ganarle al
    // temporizador del debounce y perder lo tecleado.
    onBeforeNavigate?: () => Promise<void> | void;
}

interface TabDef {
    key: CronogramaTab;
    label: string;
    href: (project: string, modo: string) => string;
    colorActive: string;
    // Por qué esta pestaña necesita atención — evalúa contra el estado
    // global. undefined = nunca alerta (ej. Valorizado se autoevalúa, y
    // Materiales es un dato aparte).
    needsAttention?: (estado: CronogramaEstado) => string | null;
}

const TABS: TabDef[] = [
    {
        key: 'valorizado',
        label: 'CALEN. VALO.',
        href: (project, modo) =>
            `/module/crono_valorizado?project=${project}&modo=${modo}`,
        colorActive: 'bg-blue-600 text-white border-blue-600',
        needsAttention: (e) =>
            e.sinProgramado ? 'Falta guardar el Valorizado programado' : null,
    },
    {
        key: 'ejecutado',
        label: 'VAL. MENSUAL',
        href: (project, modo) =>
            `/module/crono_ejecutado?project=${project}&modo=${modo}`,
        colorActive: 'bg-emerald-600 text-white border-emerald-600',
        needsAttention: (e) =>
            e.sinEjecutado ? 'Falta guardar el Avance Real' : null,
    },
    {
        key: 'progvsejec',
        label: 'PROG VS. EJEC',
        href: (project, modo) =>
            `/module/prog_vs_ejec?project=${project}&modo=${modo}`,
        colorActive: 'bg-amber-600 text-white border-amber-600',
        needsAttention: (e) =>
            e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado y Avance Real'
                : null,
    },
    {
        key: 'control',
        label: 'CONTROL GEN. AVAN. OBRA.',
        href: (project, modo) =>
            `/module/control_avance_obra?project=${project}&modo=${modo}`,
        colorActive: 'bg-indigo-600 text-white border-indigo-600',
        needsAttention: (e) =>
            e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado y Avance Real'
                : null,
    },
    {
        key: 'curvaS',
        label: 'CURVA S',
        href: (project, modo) =>
            `/module/curva_s?project=${project}&modo=${modo}`,
        colorActive: 'bg-sky-600 text-white border-sky-600',
        needsAttention: (e) =>
            e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado y Avance Real'
                : null,
    },
    {
        key: 'controlFisico',
        label: 'CONTROL AVAN. FISICO',
        href: (project, modo) =>
            `/module/control_avan_fisico?project=${project}&modo=${modo}`,
        colorActive: 'bg-teal-600 text-white border-teal-600',
        needsAttention: (e) =>
            e.sinMontoContrato || e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado, Avance Real y el Monto de Contrato'
                : null,
    },
    {
        key: 'controlFinanciero',
        label: 'CONTROL FINANCIERO',
        href: (project, modo) =>
            `/module/control_financiero?project=${project}&modo=${modo}`,
        colorActive: 'bg-rose-600 text-white border-rose-600',
        needsAttention: (e) =>
            e.sinMontoContrato || e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado, Avance Real y el Monto de Contrato'
                : null,
    },
    {
        key: 'resumenVal',
        label: 'RESUMEN VAL.',
        href: (project, modo) =>
            `/module/resumen_val?project=${project}&modo=${modo}`,
        colorActive: 'bg-fuchsia-600 text-white border-fuchsia-600',
        needsAttention: (e) =>
            e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado y Avance Real'
                : null,
    },
    {
        key: 'rfc',
        label: 'R.F.C',
        href: (project, modo) => `/module/rfc?project=${project}&modo=${modo}`,
        colorActive: 'bg-violet-600 text-white border-violet-600',
        needsAttention: (e) =>
            e.sinMontoContrato || e.sinProgramado || e.sinEjecutado
                ? 'Depende de Valorizado, Avance Real y el Monto de Contrato'
                : null,
    },
    {
        key: 'pagoMensual',
        label: 'R PAGO MENSUAL',
        href: (project) => `/module/r_pago_mensual?project=${project}`,
        colorActive: 'bg-blue-600 text-white border-blue-600',
        needsAttention: (e) =>
            e.sinEjecutado ? 'Depende de Avance Real' : null,
    },
    {
        key: 'pagosAcumulados',
        label: 'PAGOS ACUMULADOS',
        href: (project) => `/module/pagos_acumulados?project=${project}`,
        colorActive: 'bg-blue-600 text-white border-blue-600',
        needsAttention: (e) =>
            e.sinEjecutado ? 'Depende de Avance Real' : null,
    },
    {
        key: 'controlPagos',
        label: 'CONTROL DE PAGOS',
        href: (project) => `/module/control_pagos?project=${project}`,
        colorActive: 'bg-blue-600 text-white border-blue-600',
        needsAttention: (e) =>
            e.sinEjecutado ? 'Depende de Avance Real' : null,
    },
    {
        key: 'rhEm',
        label: 'RH-EM',
        href: (project) => `/module/rh_em?project=${project}`,
        colorActive: 'bg-slate-600 text-white border-slate-600',
    },
    {
        key: 'adelantos',
        label: 'Adelantos · auxiliar',
        href: (project, modo) =>
            `/module/adelantos?project=${project}&modo=${modo}`,
        colorActive: 'bg-cyan-600 text-white border-cyan-600',
    },
];

/**
 * Barra de navegación compartida entre las hojas del cronograma valorizado
 * — se puede saltar de cualquiera a cualquiera, sin pasar siempre por
 * Valorizado. El modo de cálculo (calendario/30 días) viaja con cada link
 * para que la hoja destino abra en el mismo modo que la actual. Si se pasa
 * `estado`, cada pestaña muestra un punto de alerta cuando a ella (o a lo
 * que depende de ella) le falta un dato por llenar.
 */
export default function CronogramaNavTabs({
    project,
    modoCalculo,
    active,
    estado,
    onBeforeNavigate,
}: CronogramaNavTabsProps) {
    const tabsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = tabsRef.current;
        const selected = container?.querySelector<HTMLElement>(
            '[aria-current="page"]',
        );
        if (!container || !selected) return;

        const containerRect = container.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        container.scrollLeft +=
            selectedRect.left -
            containerRect.left -
            (containerRect.width - selectedRect.width) / 2;
    }, [active]);

    const handleClick = (
        e: React.MouseEvent<HTMLAnchorElement>,
        href: string,
    ) => {
        if (!onBeforeNavigate) return;
        e.preventDefault();
        Promise.resolve(onBeforeNavigate()).finally(() => {
            window.location.href = href;
        });
    };

    return (
        <nav
            aria-label="Hojas de valorización"
            className="mb-4 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
        >
            <div
                ref={tabsRef}
                className="flex w-full flex-nowrap gap-1.5 overflow-x-auto pb-1"
            >
                {TABS.map((tab) => {
                    const isActive = tab.key === active;
                    const motivo = estado
                        ? (tab.needsAttention?.(estado) ?? null)
                        : null;
                    const href = tab.href(project, modoCalculo);

                    return (
                        <a
                            key={tab.key}
                            href={href}
                            onClick={(e) => handleClick(e, href)}
                            aria-current={isActive ? 'page' : undefined}
                            title={motivo ?? undefined}
                            className={`relative flex shrink-0 items-center justify-center rounded-lg border px-2 py-2 text-xs font-black whitespace-nowrap transition-all lg:grow ${
                                isActive
                                    ? tab.colorActive
                                    : 'border-transparent text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {tab.label}
                            {motivo && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />
                                </span>
                            )}
                        </a>
                    );
                })}
            </div>
        </nav>
    );
}
