import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/CanvasPage.css';
import usericon from '../images/usericon.png';

export default function CanvasPage() {
    const navigate = useNavigate();
    const [rightTab, setRightTab] = useState('info');

    // 🌟 현재 선택된 노드의 정보를 관리하는 상태 (초기값은 '로그인')
    const [selectedNode, setSelectedNode] = useState({
        name: "로그인",
        type: "기능 (Feature)",
        description: "회원 인증 및 세션 발급 로직을 처리합니다.",
        input: "아이디, 비밀번호",
        output: "JWT 토큰, 사용자 프로필 정보"
    });

    // 🌟 노드 데이터 정의 (이미지에 있는 4개 기능)
    const nodes = [
        { id: 1, name: "회원가입", top: '80px', left: '260px', description: "새로운 사용자를 시스템에 등록합니다.", input: "아이디, 비번, 이메일", output: "가입 성공 메시지" },
        { id: 2, name: "로그인", top: '220px', left: '260px', description: "회원 인증 및 세션 발급 로직을 처리합니다.", input: "아이디, 비밀번호", output: "JWT 토큰, 사용자 프로필 정보" },
        { id: 3, name: "로그아웃", top: '380px', left: '150px', description: "사용자의 인증 세션을 종료합니다.", input: "Access Token", output: "로그아웃 성공 여부" },
        { id: 4, name: "회원탈퇴", top: '380px', left: '370px', description: "사용자의 모든 정보를 DB에서 삭제합니다.", input: "비밀번호 확인", output: "탈퇴 완료 메시지" },
    ];

    const handleNodeClick = (node) => {
        setSelectedNode({
            name: node.name,
            type: "기능 (Feature)",
            description: node.description,
            input: node.input,
            output: node.output
        });
        setRightTab('info'); // 노드 클릭 시 자동으로 객체 정보 탭으로 이동
    };

    const handleLogout = () => {
        localStorage.removeItem("accessToken");
        navigate("/login");
    };

    const goToLobby = () => navigate("/lobby");

    const onlineUsers = [
        { id: 1, name: "홍길동", status: "온라인", profileImg: usericon },
        { id: 2, name: "김철수", status: "온라인", profileImg: usericon },
    ];

    return (
        <div className="CanvasPage-container">
            <header className="CanvasPage-header">
                <h1 onClick={goToLobby} style={{ cursor: 'pointer' }}>Our Diagram</h1>
                <div className="header-right">
                    <div className="online-members">
                        {onlineUsers.map(user => (
                            <div key={user.id} className="member-avatar">
                                <img src={user.profileImg} alt={user.name} />
                                <span className="online-dot"></span>
                                <div className="tooltip">{user.name}({user.status})</div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleLogout} className="logout-btn">로그아웃</button>
                </div>
            </header>

            <div className="CanvasPage-body">
                <div className="sidebar-left">
                    <div className="directory-box">
                        <h3 className="sidebar-title">Directory Tree</h3>
                        <div className="tree-root">
                            <span className="tree-item project">📦 Our_Shopping_Mall</span>
                            <ul className="tree-branch">
                                <li>
                                    <span className="tree-item folder">📂 src/auth/</span>
                                    <ul className="tree-branch">
                                        <li><span className="tree-item file">📄 AuthController.java</span></li>
                                        <li><span className="tree-item file">📄 AuthService.java</span></li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="block-palette">
                        <h3 className="sidebar-title">Blocks</h3>
                        <div className="block-list">
                            <div className="drag-block feature" draggable>기능 (Feature)</div>
                            <div className="drag-block interface" draggable>인터페이스</div>
                            <div className="drag-block class" draggable>클래스</div>
                            <div className="drag-block method" draggable>메서드</div>
                        </div>
                    </div>
                </div>

                <div className="canvas-main">
                    {/* 이미지와 동일한 연결선 (SVG) */}
                    <svg className="canvas-svg">
                        <line x1="335" y1="130" x2="335" y2="220" stroke="#FFD1DC" strokeWidth="3" />
                        <line x1="335" y1="270" x2="335" y2="330" stroke="#FFD1DC" strokeWidth="3" />
                        <line x1="225" y1="330" x2="445" y2="330" stroke="#FFD1DC" strokeWidth="3" />
                        <line x1="225" y1="330" x2="225" y2="380" stroke="#FFD1DC" strokeWidth="3" />
                        <line x1="445" y1="330" x2="445" y2="380" stroke="#FFD1DC" strokeWidth="3" />
                    </svg>

                    {/* 🌟 4개의 기능 블럭 렌더링 */}
                    {nodes.map(node => (
                        <div 
                            key={node.id} 
                            className={`diagram-node feature-node ${selectedNode.name === node.name ? 'active' : ''}`}
                            style={{ top: node.top, left: node.left, zIndex: 2 }}
                            onClick={() => handleNodeClick(node)}
                        >
                            <div className="node-body">{node.name}</div>
                        </div>
                    ))}
                </div>

                <div className="sidebar-right">
                    <div className="right-tabs">
                        <button className={`tab-btn ${rightTab === 'info' ? 'active' : ''}`} onClick={() => setRightTab('info')}>객체 정보</button>
                        <button className={`tab-btn ${rightTab === 'llm' ? 'active' : ''}`} onClick={() => setRightTab('llm')}>LLM 멘토</button>
                    </div>

                    <div className="tab-content">
                        {rightTab === 'info' && (
                            <div className="info-panel">
                                <div className="info-inputs">
                                    <h3 className="info-title">{selectedNode.name} 기능</h3>
                                    <div className="property-group">
                                        <label>자연어 설명</label>
                                        <textarea rows="3" value={selectedNode.description} onChange={(e) => setSelectedNode({...selectedNode, description: e.target.value})} />
                                    </div>
                                    <div className="property-group">
                                        <label>입력값</label>
                                        <input type="text" value={selectedNode.input} onChange={(e) => setSelectedNode({...selectedNode, input: e.target.value})} />
                                    </div>
                                    <div className="property-group">
                                        <label>출력값</label>
                                        <input type="text" value={selectedNode.output} onChange={(e) => setSelectedNode({...selectedNode, output: e.target.value})} />
                                    </div>
                                </div>
                                <div className="extraction-section">
                                    <button className="foundation-btn">Foundation Code 추출</button>
                                </div>
                            </div>
                        )}

                        {rightTab === 'llm' && (
                            <div className="llm-panel">
                                <div className="chat-history">
                                    <div className="chat-msg ai">반가워! '{selectedNode.name}' 기능 설계를 도와줄게.</div>
                                </div>
                                <div className="chat-input-box">
                                    <textarea placeholder="멘토에게 질문하기..." rows="2"></textarea>
                                    <button>전송</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}