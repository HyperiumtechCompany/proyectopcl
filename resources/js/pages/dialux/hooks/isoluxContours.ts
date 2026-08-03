export interface ContourPoint {
    x: number;
    y: number;
}

export interface ContourSegment {
    level: number;
    levelIndex: number;
    start: ContourPoint;
    end: ContourPoint;
}

interface BuildContourSegmentsParams {
    rows: number;
    cols: number;
    values: Array<number | null>;
    levels: number[];
    pointAt: (row: number, col: number) => ContourPoint;
}

type EdgeId = 0 | 1 | 2 | 3;

const EPSILON = 1e-6;

function interpolatePoint(
    level: number,
    valueA: number,
    valueB: number,
    pointA: ContourPoint,
    pointB: ContourPoint,
): ContourPoint {
    if (Math.abs(valueB - valueA) < EPSILON) {
        return {
            x: (pointA.x + pointB.x) / 2,
            y: (pointA.y + pointB.y) / 2,
        };
    }

    const t = Math.min(1, Math.max(0, (level - valueA) / (valueB - valueA)));
    return {
        x: pointA.x + (pointB.x - pointA.x) * t,
        y: pointA.y + (pointB.y - pointA.y) * t,
    };
}

function resolveCaseSegments(
    caseIndex: number,
    centerValue: number,
    level: number,
): Array<[EdgeId, EdgeId]> {
    switch (caseIndex) {
    case 0:
    case 15:
        return [];
    case 1:
        return [[3, 2]];
    case 2:
        return [[2, 1]];
    case 3:
        return [[3, 1]];
    case 4:
        return [[0, 1]];
    case 5:
        return centerValue >= level ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
    case 6:
        return [[0, 2]];
    case 7:
        return [[0, 3]];
    case 8:
        return [[0, 3]];
    case 9:
        return [[0, 2]];
    case 10:
        return centerValue >= level ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
    case 11:
        return [[0, 1]];
    case 12:
        return [[3, 1]];
    case 13:
        return [[2, 1]];
    case 14:
        return [[3, 2]];
    default:
        return [];
    }
}

export function buildContourSegments({
    rows,
    cols,
    values,
    levels,
    pointAt,
}: BuildContourSegmentsParams): ContourSegment[] {
    if (rows < 2 || cols < 2 || values.length !== rows * cols) {
        return [];
    }

    const segments: ContourSegment[] = [];

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
        const level = levels[levelIndex];

        for (let row = 0; row < rows - 1; row += 1) {
            for (let col = 0; col < cols - 1; col += 1) {
                const topLeftIndex = row * cols + col;
                const topRightIndex = topLeftIndex + 1;
                const bottomLeftIndex = (row + 1) * cols + col;
                const bottomRightIndex = bottomLeftIndex + 1;

                const topLeftValue = values[topLeftIndex];
                const topRightValue = values[topRightIndex];
                const bottomRightValue = values[bottomRightIndex];
                const bottomLeftValue = values[bottomLeftIndex];

                if (
                    topLeftValue === null ||
                    topRightValue === null ||
                    bottomRightValue === null ||
                    bottomLeftValue === null
                ) {
                    continue;
                }

                const caseIndex =
                    (topLeftValue >= level ? 8 : 0) |
                    (topRightValue >= level ? 4 : 0) |
                    (bottomRightValue >= level ? 2 : 0) |
                    (bottomLeftValue >= level ? 1 : 0);

                if (caseIndex === 0 || caseIndex === 15) {
                    continue;
                }

                const pTopLeft = pointAt(row, col);
                const pTopRight = pointAt(row, col + 1);
                const pBottomLeft = pointAt(row + 1, col);
                const pBottomRight = pointAt(row + 1, col + 1);

                const edgePoints: Record<EdgeId, ContourPoint> = {
                    0: interpolatePoint(
                        level,
                        topLeftValue,
                        topRightValue,
                        pTopLeft,
                        pTopRight,
                    ),
                    1: interpolatePoint(
                        level,
                        topRightValue,
                        bottomRightValue,
                        pTopRight,
                        pBottomRight,
                    ),
                    2: interpolatePoint(
                        level,
                        bottomLeftValue,
                        bottomRightValue,
                        pBottomLeft,
                        pBottomRight,
                    ),
                    3: interpolatePoint(
                        level,
                        topLeftValue,
                        bottomLeftValue,
                        pTopLeft,
                        pBottomLeft,
                    ),
                };

                const centerValue =
                    (topLeftValue +
                        topRightValue +
                        bottomRightValue +
                        bottomLeftValue) /
                    4;
                const linePairs = resolveCaseSegments(
                    caseIndex,
                    centerValue,
                    level,
                );

                linePairs.forEach(([edgeStart, edgeEnd]) => {
                    segments.push({
                        level,
                        levelIndex,
                        start: edgePoints[edgeStart],
                        end: edgePoints[edgeEnd],
                    });
                });
            }
        }
    }

    return segments;
}
