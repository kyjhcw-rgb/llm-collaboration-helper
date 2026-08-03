import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';

const CustomNode = ({ id, data, selected }) => {
    const updateNodeInternals = useUpdateNodeInternals();
    const isMethod = data.blockType === '메소드' || data.type === 'method';

    // 현재 엣지를 드래그 중인지 React Flow 내부 상태로 감지
    const isConnecting = useStore((state) => !!state.connectionNodeId);
    const [isHovered, setIsHovered] = useState(false);

    // 수정자 정보 찾기
    const projectMembers = useCanvasStore(state => state.projectMembers || []);
    const updater = projectMembers.find(m => m.userId === data.lastUpdatedBy);
    const updaterName = updater ? updater.nickname : null;

    // 6번: 마지막 커밋 이후에 이 블록이 바뀌었는지 여부
    const lastCommitAt = useCanvasStore(state => state.lastCommitAt);
    const changedSinceCommit = !!data.lastUpdatedAt && data.lastUpdatedAt > lastCommitAt;

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
            {updaterName && (
                <div style={{
                    position: 'absolute', top: '-18px', left: 0,
                    fontSize: '11px', color: '#fff', background: '#e67e22',
                    padding: '2px 6px', borderRadius: '4px', zIndex: 10,
                    fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}>
                    ✍️ {updaterName}
                </div>
            )}

            {/* 엣지 연결 수 상위 25%(4분위) 블록 강조 배지.
                method-node는 CSS에서 overflow:hidden이라 박스 밖으로 튀어나가는 배지는 잘리므로,
                박스 안쪽 모서리에 작은 원형 아이콘으로 표시하고 title 툴팁으로 내용을 보완한다. */}
            {data.connectionTier === 4 && (
                <div
                    title={`엣지 연결 ${data.connectionCount}개 (상위 25%)`}
                    style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#ff4d4f', color: '#fff',
                        fontSize: '9px', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 4px rgba(255,77,79,0.8)', zIndex: 10, cursor: 'default'
                    }}
                >
                    🔥
                </div>
            )}

            {/* 마지막 커밋 이후 변경된 블록 표시 (다음 커밋 전까지 유지) */}
            {changedSinceCommit && (
                <div
                    title="마지막 커밋 이후 변경됨"
                    style={{
                        position: 'absolute', bottom: 2, right: 2,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#8e44ad', color: '#fff',
                        fontSize: '8px', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 4px rgba(142,68,173,0.8)', zIndex: 10, cursor: 'default'
                    }}
                >
                    🏷️
                </div>
            )}

            <NodeResizer color="#4953BE" isVisible={selected} minWidth={100} minHeight={40} />

            <Handle type="source" position={Position.Top}    id="top"    style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Left}   id="left"   style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle(showHandles)} />
            <Handle type="source" position={Position.Right}  id="right"  style={handleStyle(showHandles)} />

            <div style={{
                position: 'absolute',
                top: isMethod ? 0 : 8,
                left: isMethod ? 0 : 12,
                right: 0,
                bottom: 0,
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