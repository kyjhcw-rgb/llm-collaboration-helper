import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';
import { useCanvasStore } from '../../store/useCanvasStore';

export default function CustomEdge({
    id,
    source,
    target,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition,
    targetPosition,
    data,
    selected
}) {
    const [hovered, setHovered] = useState(false);
    const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);

    const hasFocus = selectedNodeId !== null;
    const isConnected = hasFocus && (source === selectedNodeId || target === selectedNodeId);

    // 우선순위: hover/selected > 연결된 focus > 비연결 focus > 기본
    let opacity, strokeWidthValue;
    if (hovered || selected) {
        opacity = 1;
        strokeWidthValue = 4;
    } else if (hasFocus) {
        opacity = isConnected ? 1 : 0.1;
        strokeWidthValue = isConnected ? 3 : 2;
    } else {
        opacity = 0.35;
        strokeWidthValue = 2;
    }

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
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
            <g
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* 넓은 투명 path로 얇은 선의 hover 판정 영역 확보 */}
                <path
                    d={edgePath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ cursor: 'pointer' }}
                />
                <BaseEdge
                    id={id}
                    path={edgePath}
                    style={{
                        stroke: strokeColor,
                        strokeWidth: strokeWidthValue,
                        strokeDasharray,
                        opacity,
                        transition: 'opacity 0.15s ease, stroke-width 0.15s ease',
                        cursor: 'pointer',
                    }}
                    markerEnd={markerEnd}
                />
            </g>
            {data?.badgeCount > 1 && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            opacity,
                            transition: 'opacity 0.15s ease',
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
