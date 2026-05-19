import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position } from 'reactflow';

export default function CustomEdge({
                                       id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected
                                   }) {
    // ✨ 사용자가 포트를 정확히 안 찍고 블록 덩어리에 연결했을 때 선이 깨지는 것 방지
    const safeSourcePos = sourcePosition || Position.Bottom;
    const safeTargetPos = targetPosition || Position.Top;

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition: safeSourcePos,
        targetX,
        targetY,
        targetPosition: safeTargetPos,
        borderRadius: 10
    });

    let strokeColor = '#4953BE';
    let strokeDasharray = 'none';
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