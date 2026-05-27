import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

const CustomNode = ({ id, data, selected }) => {
    const updateNodeInternals = useUpdateNodeInternals();
    const isMethod = data.blockType === '메소드' || data.type === 'method';

    // 현재 엣지를 드래그 중인지 React Flow 내부 상태로 감지
    const isConnecting = useStore((state) => !!state.connectionNodeId);
    const [isHovered, setIsHovered] = useState(false);

    // 핸들을 보여줄 조건:
    // 1. 이 노드가 선택(클릭)됐을 때
    // 2. 엣지 드래그 중에 이 노드 위에 마우스가 올라왔을 때
    const showHandles = selected || (isConnecting && isHovered);

    useEffect(() => {
        updateNodeInternals(id);
    }, [id, updateNodeInternals]);

    const handleStyle = (visible) => ({
        width: visible ? '14px' : '8px',
        height: visible ? '14px' : '8px',
        backgroundColor: visible ? '#4953BE' : 'transparent',
        border: visible ? '2px solid white' : '2px solid transparent',
        borderRadius: '50%',
        zIndex: 100,
        opacity: visible ? 1 : 0,
        transition: 'all 0.15s ease',
        pointerEvents: 'all',
    });

    return (
        <div
            style={{ width: '100%', height: '100%' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <NodeResizer color="#4953BE" isVisible={selected} minWidth={100} minHeight={40} />

            <Handle type="source" position={Position.Top}    id="top"    style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Left}   id="left"   style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Right}  id="right"  style={handleStyle(showHandles)} />

            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: isMethod ? 'center' : 'flex-start',
                justifyContent: isMethod ? 'center' : 'flex-start',
                boxSizing: 'border-box',
                pointerEvents: 'none',
            }}>
                <div style={{ wordBreak: 'keep-all' }}>
                    {data.label || data.name}
                </div>
            </div>
        </div>
    );
};

export default memo(CustomNode);