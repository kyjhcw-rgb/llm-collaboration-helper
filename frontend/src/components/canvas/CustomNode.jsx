import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

const CustomNode = ({ data, selected }) => {
    const isMethod = data.blockType === '메소드' || data.type === 'method';

    const handleStyle = {
        width: '14px',
        height: '14px',
        backgroundColor: '#4953BE',
        border: '2px solid white',
        borderRadius: '50%',
        zIndex: 100
    };

    return (
        <>
            <NodeResizer color="#4953BE" isVisible={selected} minWidth={100} minHeight={40} />

            {/* 🌟 엇나감의 원인이었던 top, left 하드코딩 완전 삭제. React Flow 엔진이 100% 정중앙에 자동 정렬합니다. */}
            <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
            <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

            {/* 블록 본문 컨테이너 */}
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: isMethod ? 'center' : 'flex-start',
                justifyContent: isMethod ? 'center' : 'flex-start',
                boxSizing: 'border-box'
            }}>
                <div style={{ wordBreak: 'keep-all' }}>
                    {data.label || data.name}
                </div>
            </div>
        </>
    );
};

export default memo(CustomNode);