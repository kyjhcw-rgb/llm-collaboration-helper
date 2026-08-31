import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

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

    // 파일 단위로 필요한 블록만 꺼내서 보는 방식으로 바뀌면서, 보이는 블록 간의 연결선은
    // 클릭 여부와 상관없이 항상 표시하고 hover/selected 시에만 강조한다.
    const opacity = 1;
    const strokeWidthValue = (hovered || selected) ? 4 : 2;

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
