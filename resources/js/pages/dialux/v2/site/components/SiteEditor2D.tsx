import { useSiteEditor } from '../hooks/useSiteEditor';
import { SiteCanvas2D } from './SiteCanvas2D';
import { SiteContourImportDialog } from './SiteContourImportDialog';
import { SitePalette } from './SitePalette';
import { SitePlanImportDialog } from './SitePlanImportDialog';
import { SitePropertiesPanel } from './SitePropertiesPanel';
import { SiteSurveyImportDialog } from './SiteSurveyImportDialog';
import { SiteToolbar } from './SiteToolbar';

interface Props {
    projectId: number;
    generalModuleId: number;
    modules: Array<{ id: number; name: string }>;
    /**
     * `false` cuando la pestaña 3D está al frente. El editor 2D NO se
     * desmonta (así el motor CAD no reparsea el plano al volver) — solo se
     * oculta con `display:none`. El canvas usa esto para reencuadrar y
     * resincronizar la cámara al volver a estar visible.
     */
    isActive?: boolean;
}

export function SiteEditor2D({
    projectId,
    generalModuleId,
    modules,
    isActive = true,
}: Props) {
    const editor = useSiteEditor(projectId, generalModuleId);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SiteToolbar editor={editor} />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <SitePalette editor={editor} />
                <main className="min-h-105 min-w-0 flex-1 overflow-auto">
                    <SiteCanvas2D editor={editor} isActive={isActive} />
                </main>
                <SitePropertiesPanel editor={editor} modules={modules} />
            </div>
            {editor.planImportOpen && (
                <SitePlanImportDialog
                    projectId={projectId}
                    generalModuleId={generalModuleId}
                    onImported={editor.handlePlanImported}
                    onClose={editor.closePlanImport}
                />
            )}
            {editor.contourImportOpen && (
                <SiteContourImportDialog
                    onImport={editor.importCadContours}
                    onClose={editor.closeContourImport}
                />
            )}
            {editor.surveyImportOpen && (
                <SiteSurveyImportDialog
                    siteCentroid={(() => {
                        const els = editor.siteData?.elements ?? [];
                        const verts = els.flatMap((e) => e.vertices);
                        if (verts.length === 0) return null;
                        return {
                            x:
                                verts.reduce((s, v) => s + v.x, 0) /
                                verts.length,
                            y:
                                verts.reduce((s, v) => s + v.y, 0) /
                                verts.length,
                        };
                    })()}
                    onImport={editor.importSurveyPoints}
                    onClose={editor.closeSurveyImport}
                />
            )}
        </div>
    );
}
