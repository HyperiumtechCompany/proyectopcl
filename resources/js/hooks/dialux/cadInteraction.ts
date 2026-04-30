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
