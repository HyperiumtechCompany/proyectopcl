export function shouldEnableOverlayPointerEvents(
    activeTool: string,
    isCadCommandActive: boolean,
    interactiveTools: Set<string>,
): boolean {
    if (isCadCommandActive) {
        return false;
    }

    return interactiveTools.has(activeTool);
}

export interface CadCanvasPoint {
    x: number;
    y: number;
}

export function getCanopyDraftStart(
    canvasPoint: CadCanvasPoint,
    canvasToScene: (x: number, y: number) => CadCanvasPoint,
): CadCanvasPoint {
    return canvasToScene(canvasPoint.x, canvasPoint.y);
}
