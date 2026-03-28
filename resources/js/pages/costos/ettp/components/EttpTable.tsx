import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { EttpPartidaData } from './types';

export interface EttpTableRef {
    getData: () => any[];
    setData: (data: any[]) => void;
    getInstance: () => any;
}

interface Props {
    data: EttpPartidaData[];
    onRowClick: (row: any) => void;
}

const EttpTable = forwardRef<EttpTableRef, Props>(({ data, onRowClick }, ref) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        getData: () => tabulatorRef.current?.getData() || [],
        setData: (newData: any[]) => {
            if (tabulatorRef.current) {
                try { tabulatorRef.current.setData(newData); }
                catch (e) { console.warn('[Table] setData error:', e); }
            }
        },
        getInstance: () => tabulatorRef.current,
    }));

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
                    data: data,
                    dataTree: true,
                    dataTreeStartExpanded: false,
                    layout: "fitDataFill",
                    height: 'calc(100vh - 140px)',
                    virtualDom: true,
                    dataTreeChildField: '_children',
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapseStartOpen: false,
                    columns: [
                        {
                            title: 'Items',
                            field: 'item',
                            width: 150,
                            responsive: 0,
                            editor: 'input',
                        },
                        {
                            title: 'Descripción',
                            field: 'descripcion',
                            width: 300,
                            responsive: 1,
                            editor: 'input',
                        },
                        {
                            title: 'Und',
                            field: 'unidad',
                            width: 70,
                            responsive: 2,
                            editor: 'input',
                        },
                        {
                            title: '',
                            width: 60,
                            responsive: 0,
                            formatter: (cell: any) => {
                                const rowData = cell.getRow().getData();
                                if (!rowData.unidad) return '';
                                return '<button class="btn-details" style="background:#3b82f6;color:white;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:14px;">📋</button>';
                            },
                            cellClick: (_e: any, cell: any) => {
                                onRowClick(cell.getRow());
                            },
                        },
                    ],
                });

                tabulatorRef.current = table;
                table.on('tableBuilt', () => console.log('[Tabulator] Tabla construida'));

            } catch (error) {
                console.error('[Tabulator] Error al inicializar:', error);
            }
        };

        initTabulator();

        return () => {
            isMounted = false;
            if (tabulatorRef.current) {
                try { 
                    tabulatorRef.current.destroy(); 
                } catch (e) { 
                    console.warn('[Tabulator] Error al destruir:', e); 
                } finally {
                    tabulatorRef.current = null;
                }
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Actualizar datos cuando cambian
    useEffect(() => {
        let isHandling = true;
        if (tabulatorRef.current && data) {
            try { 
                // Verificar que no ha sido destruida (modules existe)
                if (tabulatorRef.current.modules) {
                    tabulatorRef.current.setData(data); 
                }
            }
            catch (e) { console.warn('[Table] No se pudo actualizar:', e); }
        }
        return () => { isHandling = false; };
    }, [data]);


    return (
        <div
            ref={tableRef}
            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"
            style={{ height: 'calc(100vh - 180px)' }}
        />
    );
});

EttpTable.displayName = 'EttpTable';

export default EttpTable;
