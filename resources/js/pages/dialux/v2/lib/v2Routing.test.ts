import { describe, expect, it } from 'vitest';
import {
    show as moduleShow,
    update as moduleUpdate,
} from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import {
    index as projectIndex,
    show as projectShow,
} from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import { createBlankModuleProject } from './createBlankModuleProject';

describe('DIALux v2 editor contracts', () => {
    it('builds isolated Wayfinder paths for projects and modules', () => {
        expect(projectIndex.url()).toBe('/dialux-v2');
        expect(projectShow.url(12)).toBe('/dialux-v2/projects/12');
        expect(moduleShow.url([12, 34])).toBe(
            '/dialux-v2/projects/12/modules/34',
        );
        expect(moduleUpdate([12, 34]).method).toBe('patch');
    });

    it('seeds a blank editor document with both project and module identity', () => {
        const project = createBlankModuleProject(12, 34, 'Torre norte');

        expect(project.id).toBe('12');
        expect(project.moduleId).toBe('34');
        expect(project.name).toBe('Torre norte');
        expect(project.scenes).toHaveLength(1);
        expect(project.scenes[0]?.name).toBe('Planta Baja');
    });
});
