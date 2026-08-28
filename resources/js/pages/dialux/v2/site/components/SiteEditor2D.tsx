import { useSiteEditor } from '../hooks/useSiteEditor';
import { SiteCanvas2D } from './SiteCanvas2D';
import { SitePalette } from './SitePalette';
import { SitePropertiesPanel } from './SitePropertiesPanel';
import { SiteToolbar } from './SiteToolbar';

interface Props {
    projectId: number;
    modules: Array<{ id: number; name: string }>;
}

export function SiteEditor2D({ projectId, modules }: Props) {
    const editor = useSiteEditor(projectId);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SiteToolbar editor={editor} />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <SitePalette editor={editor} />
                <main className="min-h-[420px] min-w-0 flex-1 overflow-auto">
                    <SiteCanvas2D editor={editor} />
                </main>
                <SitePropertiesPanel editor={editor} modules={modules} />
            </div>
        </div>
    );
}
