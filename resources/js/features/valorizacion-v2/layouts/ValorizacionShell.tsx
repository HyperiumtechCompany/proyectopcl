import { Suspense, useState } from 'react';
import { ConflictoBanner } from '../components/ConflictoBanner';
import { PendingSheet } from '../components/PendingSheet';
import type { ProyectoRef, ValorizacionRef } from '../components/ProyectoNav';
import { SheetNav } from '../components/SheetNav';
import { ValorizacionHeader } from '../components/ValorizacionHeader';
import { useActiveSheet } from '../hooks/useActiveSheet';

const NAV_KEY = 'valorizacion-v2:nav-collapsed';

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

    return (
        <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 max-w-full flex-col bg-stone-100 dark:bg-stone-950">
            <ValorizacionHeader {...nav} />
            <ConflictoBanner />
            <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
                <SheetNav active={sheet} onSelect={selectSheet} collapsed={navCollapsed} onToggleCollapsed={toggleNav} />
                <main className="@container min-w-0 flex-1 px-3 py-4 sm:px-4 lg:px-5">
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
