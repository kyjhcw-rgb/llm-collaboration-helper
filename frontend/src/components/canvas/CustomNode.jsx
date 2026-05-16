import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css'; 

const CustomNode = ({ data, selected }) => {
    const isMethod = data.blockType === '메소드';

    return (
        <div style={{ 
            width: '100%', 
            height: '100%',
            display: 'flex',
            alignItems: isMethod ? 'center' : 'flex-start',
            justifyContent: isMethod ? 'center' : 'flex-start',
            boxSizing: 'border-box'
        }}>
            
            <NodeResizer 
                color="#4953BE" 
                isVisible={selected} 
                minWidth={100} 
                minHeight={40} 
            />
            
            {/* 글자 표시 영역 */}
            <div>
                {data.label}
            </div>

            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="source" position={Position.Right} id="right" />
            <Handle type="source" position={Position.Bottom} id="bottom" />
            <Handle type="target" position={Position.Left} id="left" />
        </div>
    );
};

export default memo(CustomNode);