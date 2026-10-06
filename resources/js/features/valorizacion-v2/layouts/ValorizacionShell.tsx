import { Suspense, useEffect, useState } from 'react';
import { ConflictoBanner } from '../components/ConflictoBanner';
import { EncabezadoImpresion, HojaAcciones } from '../components/HojaAcciones';
import { PendingSheet } from '../components/PendingSheet';
import type { ProyectoRef, ValorizacionRef } from '../components/ProyectoNav';
import { SheetNav } from '../components/SheetNav';
import { ValorizacionHeader } from '../components/ValorizacionHeader';
import { useActiveSheet } from '../hooks/useActiveSheet';

const NAV_KEY = 'valorizacion-v2:nav-collapsed';

/**
 * Impresión: solo se imprime la hoja (sin barra lateral ni cabecera de la app),
 * A4 apaisado, tablas sin scroll y con colores de fondo.
 */
const PRINT_CSS = `@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden; }
  #valorizacion-v2-print, #valorizacion-v2-print * { visibility: visible; }
  #valorizacion-v2-print { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 !important; background: white; color: #1c1917; }
  #valorizacion-v2-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #valorizacion-v2-print .overflow-x-auto, #valorizacion-v2-print .overflow-auto { overflow: visible !important; }
  #valorizacion-v2-print table { min-width: 0 !important; width: 100% !important; font-size: 8.5px; }
  #valorizacion-v2-print th, #valorizacion-v2-print td { padding: 2px 4px !important; position: static !important; }
  #valorizacion-v2-print tr, #valorizacion-v2-print section { break-inside: avoid; }
  #valorizacion-v2-print thead { display: table-header-group; }
}`;

function readNavCollapsed(): boolean {
    try {
        return window.localStorage.getItem(NAV_KEY) === '1';
    } catch {
        return false;
    }
}

/** Marco de la valorización: cabecera con KPIs, navegación de hojas y la hoja activa (carga diferida). */
export function ValorizacionShell(nav: { proyecto: ProyectoRef; proyectos: ProyectoRef[]; valorizacion: ValorizacionRef; valorizaciones: ValorizacionRef[] }) {
    const [sheet, selectSheet] = useActiveSheet();
    const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed);
    const toggleNav = () => {
        setNavCollapsed((value) => {
            try {
                window.localStorage.setItem(NAV_KEY, value ? '0' : '1');
            } catch {
                // Preferencia de vista opcional: sin almacenamiento se usa el valor por defecto.
            }

            return !value;
        });
    };
    const SheetComponent = sheet.component;

    // En modo oscuro la hoja se imprimiría con fondos negros: se imprime siempre en claro.
    useEffect(() => {
        const raiz = document.documentElement;
        let eraOscuro = false;
        const antes = () => {
            eraOscuro = raiz.classList.contains('dark');
            raiz.classList.remove('dark');
        };
        const despues = () => {
            if (eraOscuro) {
                raiz.classList.add('dark');
            }
        };
        window.addEventListener('beforeprint', antes);
        window.addEventListener('afterprint', despues);

        return () => {
            window.removeEventListener('beforeprint', antes);
            window.removeEventListener('afterprint', despues);
        };
    }, []);

    return (
        <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 max-w-full flex-col bg-stone-100 dark:bg-stone-950">
            <style>{PRINT_CSS}</style>
            <div className="print:hidden">
                <ValorizacionHeader {...nav} />
                <ConflictoBanner />
            </div>
            <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
                <SheetNav active={sheet} onSelect={selectSheet} collapsed={navCollapsed} onToggleCollapsed={toggleNav} />
                <main id="valorizacion-v2-print" className="@container min-w-0 flex-1 px-3 py-4 sm:px-4 lg:px-5">
                    <EncabezadoImpresion sheet={sheet} />
                    {SheetComponent && <HojaAcciones sheet={sheet} nombreDocumento={nav.valorizacion.nombre} />}
                    {SheetComponent ? (
                        <Suspense fallback={<p className="py-10 text-center text-sm text-stone-500">Cargando hoja…</p>}>
                            <SheetComponent />
                        </Suspense>
                    ) : (
                        <PendingSheet sheet={sheet} />
                    )}
                </main>
            </div>
        </div>
    );
}
