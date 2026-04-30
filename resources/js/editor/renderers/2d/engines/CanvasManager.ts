// renderers/2d/engines/CanvasManager.ts
import { Canvas } from 'fabric';
import { useProjectStore } from '../../../core/store/useProjectStore';

/**
 * 2D Canvas Manager
 * Responsible for listening to Zustand State (Nodes) and 
 * propagating those changes to the Fabric.js Canvas elements natively.
 */
export class Editor2DCanvasManager {
    public canvas: Canvas;
    private unsubscribeStore: () => void;

    constructor(canvasEl: HTMLCanvasElement) {
        this.canvas = new Canvas(canvasEl, {
            preserveObjectStacking: true,
            selection: true,
        });

        // Sync with the state engine
        this.unsubscribeStore = useProjectStore.subscribe((state, prevState) => {
             this.syncNodesToCanvas(state);
        });
    }

    private syncNodesToCanvas(state: ReturnType<typeof useProjectStore.getState>) {
        const activeStorey = useProjectStore.getState().getActiveStorey();
        if (!activeStorey) return;

        // Note: For extreme performance, do diffing here.
        // Compare `state` nodes with current canvas elements and update only modified geometries
        // This decouples React's render loop from Canvas 60fps loop.
        
        // Example logic:
        // 1. Find nodes in store but not in canvas -> create Fabric Object
        // 2. Find nodes in canvas but not in store -> remove Fabric Object
        // 3. Find modified nodes -> modify Fabric Object coordinates/properties
        
        this.canvas.requestRenderAll();
    }

    public destroy() {
        this.unsubscribeStore();
        this.canvas.dispose();
    }
}
