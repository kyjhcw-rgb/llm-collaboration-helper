import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position } from 'reactflow';

function inferPositions(sourceX, sourceY, targetX, targetY) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx >= 0) return { sourcePos: Position.Right, targetPos: Position.Left };
        else         return { sourcePos: Position.Left,  targetPos: Position.Right };
    } else {
        if (dy >= 0) return { sourcePos: Position.Bottom, targetPos: Position.Top };
        else         return { sourcePos: Position.Top,    targetPos: Position.Bottom };
    }
}

// ← 여기 숫자만 바꾸면 됩니다
const OFFSET_BY_TYPE = {
    feature: 176,  // 기능 블록
    class:   252,   // 클래스 블록 ← 조절 필요
    method:  301,   // 메소드 블록 ← 조절 필요
};

export default function CustomEdge({
    id,
    sourceX, sourceY,
    targetX, targetY,
    data,
    selected
}) {
    // useCanvasStore 대신 data에서 바로 읽음 → 항상 정확함
    const sourceNodeType = data?.sourceNodeType || 'method';
    const OFFSET = OFFSET_BY_TYPE[sourceNodeType] ?? 0;

    const { sourcePos, targetPos } = inferPositions(sourceX, sourceY + OFFSET, targetX, targetY + OFFSET);

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY: sourceY + OFFSET,
        sourcePosition: sourcePos,
        targetX,
        targetY: targetY + OFFSET,
        targetPosition: targetPos,
        borderRadius: 10
    });

    let strokeColor = '#4953BE';
    let strokeDasharray = undefined;
    let markerEnd = 'url(#marker-call)';

    if (data?.type === 'inheritance') {
        strokeColor = '#8E44AD';
        markerEnd = 'url(#marker-inheritance)';
    } else if (data?.type === 'implementation') {
        strokeColor = '#27AE60';
        strokeDasharray = '5 5';
        markerEnd = 'url(#marker-implementation)';
    }

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: strokeColor,
                    strokeWidth: selected ? 4 : 2,
                    strokeDasharray: strokeDasharray,
                    transition: 'stroke-width 0.2s',
                    cursor: 'pointer'
                }}
                markerEnd={markerEnd}
            />
            {data?.badgeCount > 1 && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            background: '#fff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: strokeColor,
                            border: `2px solid ${strokeColor}`,
                            pointerEvents: 'all',
                        }}
                    >
                        {data.badgeCount}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}