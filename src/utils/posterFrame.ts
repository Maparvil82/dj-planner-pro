export const POSTER_CARD_ASPECT = 1.55;
export interface PosterPosition {
    x: number;
    y: number;
}
export function clampPosterPosition(value: number | undefined): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0.5;
}
export function posterCoverGeometry(
    width: number,
    height: number,
    imageWidth: number,
    imageHeight: number,
) {
    if (
        ![width, height, imageWidth, imageHeight].every(
            (v) => v > 0 && Number.isFinite(v),
        )
    )
        return null;
    const scale = Math.max(width / imageWidth, height / imageHeight);
    const renderedWidth = imageWidth * scale;
    const renderedHeight = imageHeight * scale;
    return {
        width: renderedWidth,
        height: renderedHeight,
        overflowX: Math.max(0, renderedWidth - width),
        overflowY: Math.max(0, renderedHeight - height),
    };
}
export function dragPosterPosition(
    start: PosterPosition,
    dx: number,
    dy: number,
    overflowX: number,
    overflowY: number,
): PosterPosition {
    return {
        x:
            overflowX > 0.5
                ? clampPosterPosition(start.x - dx / overflowX)
                : start.x,
        y:
            overflowY > 0.5
                ? clampPosterPosition(start.y - dy / overflowY)
                : start.y,
    };
}
