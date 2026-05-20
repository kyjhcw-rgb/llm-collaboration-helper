import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

const CustomNode = ({ data, selected }) => {
    // 기능/메소드 등 블록 타입에 따른 정렬 로직
    const isMethod = data.blockType === '메소드' || data.type === 'method';

    const handleStyle = {
        width: '14px',
        height: '14px',
        backgroundColor: '#4953BE',
        border: '2px solid white',
        borderRadius: '50%',
        zIndex: 100 // 마우스 연결이 쉽도록 최상단 배치
    };

    return (
        <>
            <NodeResizer
                color="#4953BE"
                isVisible={selected}
                minWidth={100}
                minHeight={40}
            />

            {/* 선 받는 곳 (Target): 위쪽, 왼쪽 포트 */}
            <Handle type="target" position={Position.Top} id="top" style={{ ...handleStyle, top: '-7px' }} />
            <Handle type="target" position={Position.Left} id="left" style={{ ...handleStyle, left: '-7px' }} />

            {/* 선이 출발하는 곳 (Source): 아래쪽, 오른쪽 포트 */}
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, bottom: '-7px' }} />
            <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, right: '-7px' }} />

            {/* 블록 본문 컨테이너 */}
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: isMethod ? 'center' : 'flex-start',
                justifyContent: isMethod ? 'center' : 'flex-start',
                boxSizing: 'border-box'
            }}>
                {/* 글자 표시 영역 */}
                <div style={{ wordBreak: 'keep-all' }}>
                    {data.label || data.name}
                </div>
            </div>
        </>
    );
};

export default memo(CustomNode);