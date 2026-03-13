import React from 'react';
<<<<<<< HEAD
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import ModuleSpreadsheet, { ColumnDef } from '@/components/costos/ModuleSpreadsheet';
=======
import type { ColumnDef } from '@/components/costos/ModuleSpreadsheet';
import ModuleSpreadsheet from '@/components/costos/ModuleSpreadsheet';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
>>>>>>> 92a897fc3b1c7617dcab772f96239d84d45eb1a9

interface ModuleViewProps {
    project: {
        id: number;
        nombre: string;
    };
    moduleType: string;
    moduleLabel: string;
    tableName: string;
    columns: ColumnDef[];
    rows: Record<string, any>[];
}

export default function ModuleView({
    project,
    moduleType,
    moduleLabel,
    columns,
    rows,
}: ModuleViewProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: moduleLabel, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="h-[calc(100vh-65px)] w-full overflow-hidden bg-white dark:bg-gray-900">
                <ModuleSpreadsheet
                    projectId={project.id}
                    projectName={project.nombre}
                    moduleType={moduleType}
                    moduleLabel={moduleLabel}
                    columns={columns}
                    rows={rows}
                />
            </div>
        </AppLayout>
    );
}
