import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

const OFFSET_BY_TYPE = {
    feature: 176,
    class:   252,
    method:  301,
};

export default function CustomEdge({
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition,
    targetPosition,
    data,
    selected
}) {
    const sourceNodeType = data?.sourceNodeType || 'method';
    const OFFSET = OFFSET_BY_TYPE[sourceNodeType] ?? 0;

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY: sourceY + OFFSET,
        sourcePosition,
        targetX,
        targetY: targetY + OFFSET,
        targetPosition,
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