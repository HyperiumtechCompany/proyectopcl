import React from 'react';
import { Head } from '@inertiajs/react';
import { TabContainer, TabConfig } from './components/layout/TabContainer';
import { SheetHeader } from './components/layout/SheetHeader';
import FichaTecnicaTab from './components/tabs/FichaTecnicaTab';

// Tabs que iremos implementando
const tabs: TabConfig[] = [
    { id: 'ficha-tecnica', label: 'Ficha Técnica', icon: '📄', component: FichaTecnicaTab },
    // { id: 'presupuesto', label: 'Presupuesto', icon: '🌳', component: PresupuestoTab },
    // { id: 'calendario-programado', label: 'Cal. Programado', icon: '📅', component: CalendarioProgramadoTab },
    // { id: 'metrados', label: 'Metrados', icon: '📏', component: MetradosTab },
    // { id: 'calendario-valorizado', label: 'Cal. Valorizado', icon: '📅', component: CalendarioValorizadoTab },
    // { id: 'valoracion-mensual', label: 'Val. Mensual', icon: '⭐', component: ValoracionMensualTab },
    // ... más tabs
];

export default function ValorizacionV2Page() {
    return (
        <div className="h-screen flex flex-col bg-gray-100">
            <Head title="Valorización v2" />
            
            {/* Cabecera general de la página */}
            <div className="p-4 md:p-6 pb-0 flex-shrink-0">
                <SheetHeader 
                    title="VALORIZACIÓN N°02 DEL MES DE JULIO DE 2026" 
                    subtitle="Reporte general de avances, metrados y pagos"
                />
            </div>

            {/* Contenedor de Tabs que toma el resto de la pantalla */}
            <div className="flex-1 overflow-hidden">
                <TabContainer tabs={tabs} defaultTab="ficha-tecnica" />
            </div>
        </div>
    );
}
