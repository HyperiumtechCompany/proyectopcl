import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { EditorLayout } from '@/pages/dialux/components/EditorLayout';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import {useEditorStore, type Project as EditorProject} from '@/pages/dialux/hooks/useEditorStore';
import type { BreadcrumbItem } from '@/types';
import { ModuleSidebar } from './components/ModuleSidebar';
import { GeneralWorkspaceTabs } from './components/GeneralWorkspaceTabs';
import { useDialuxModuleSync } from './hooks/useDialuxModuleSync';
import { useModuleActions } from './hooks/useModuleActions';
import { createBlankModuleProject } from './lib/createBlankModuleProject';
import type {DialuxV2EditorModule,DialuxV2Module,DialuxV2Project} from './types';

interface Props {
    project: Pick<DialuxV2Project, 'id' | 'name'>;
    module: DialuxV2EditorModule;
    modules: DialuxV2Module[];
    initialView?: '2d' | '3d';
}

export default function DialuxV2Module({
    project,
    module,
    modules,
    initialView = '2d',
}: Props) {
    const setProject = useEditorStore((state) => state.setProject);
    const setActiveScene = useEditorStore((state) => state.setActiveScene);
    const setDefaultStandard = useEditorStore(
        (state) => state.setDefaultRoomNormativeStandard,
    );
    const resetHistory = useEditorStore((state) => state.resetHistory);
    const set3DView = useEditorStore((state) => state.set3DView);
    const [ready, setReady] = useState(false);
    const actions = useModuleActions({
        projectId: project.id,
        modules,
        activeModuleId: module.id,
    });

    useEffect(() => {
        const initial: EditorProject = module.data
            ? {
                  ...module.data,
                  id: String(project.id),
                  moduleId: String(module.id),
                  name: module.name,
              }
            : createBlankModuleProject(project.id, module.id, module.name);

        setProject(initial);
        if (initial.scenes[0]) setActiveScene(initial.scenes[0].id);
        setDefaultStandard(
            initial.defaultRoomNormativeStandard ?? 'en_12464_1',
        );
        set3DView(module.kind === 'general' && initialView === '3d');
        resetHistory();
        void ensureStandardDataLoaded('rne_peru');
        void ensureStandardDataLoaded('en_1838');
        let mounted = true;
        queueMicrotask(() => {
            if (mounted) setReady(true);
        });

        return () => {
            mounted = false;
        };
        // El cambio de mÃ³dulo debe reinicializar todo el editor; las acciones del store son estables.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.id, initialView]);

    useDialuxModuleSync(project.id, module.id, ready);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'DIALux v2', href: '/dialux-v2' },
        { title: project.name, href: `/dialux-v2/projects/${project.id}` },
        {
            title: module.name,
            href: `/dialux-v2/projects/${project.id}/modules/${module.id}`,
        },
    ];

    if (!ready) return null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${module.name}” ${project.name}`} />
            <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
                <ModuleSidebar
                    projectId={project.id}
                    modules={modules}
                    activeModuleId={module.id}
                    actions={actions}
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col">
                        {module.kind === 'general' && (
                            <div className="shrink-0 border-b border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#0d0f14]">
                                <GeneralWorkspaceTabs
                                    projectId={project.id}
                                    moduleId={module.id}
                                    active={initialView}
                                />
                            </div>
                        )}
                        <div className="min-h-0 flex-1 overflow-hidden">
                            <EditorLayout />
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
