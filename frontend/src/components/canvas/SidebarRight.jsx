import React, { useEffect, useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore"; 
import './SidebarRight.css';

const SidebarRight = () => {
    const { pages, currentPageId, selectedNodeId, updateNodeData } = useCanvasStore();
    const [activeTab, setActiveTab] = useState("info");
    const [info, setInfo] = useState({ label: "", description: "" });
    const [chatInput, setChatInput] = useState("");

    useEffect(() => {
        if (selectedNodeId) {
            const currentNodes = pages[currentPageId]?.nodes || [];
            const node = currentNodes.find((n) => n.id === selectedNodeId);
            if (node) {
                setInfo({
                    label: node.data.label || "",
                    description: node.data.description || ""
                });
            }
        }
    }, [selectedNodeId, currentPageId, pages]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (selectedNodeId) {
            updateNodeData(selectedNodeId, info);
            alert("정보가 성공적으로 저장되었습니다.");
        }
    };

    return (
        <aside className="sidebar-right">
            {/* 상단 탭 메뉴 영역 */}
            <div className="right-tabs">
                <button 
                    className={`tab-btn ${activeTab === "info" ? "active" : ""}`}
                    onClick={() => setActiveTab("info")}
                >
                    객체 정보
                </button>
                <button 
                    className={`tab-btn ${activeTab === "llm" ? "active" : ""}`}
                    onClick={() => setActiveTab("llm")}
                >
                    LLM
                </button>
            </div>

            {/* 탭 별 콘텐츠 본문 영역 */}
            <div className="tab-content">
                {activeTab === "info" ? (
                    <div className="info-panel">
                        {selectedNodeId ? (
                            <div className="info-form">
                                <div className="property-group">
                                    <label>블록 이름</label>
                                    <input 
                                        name="label" 
                                        value={info.label} 
                                        onChange={handleChange} 
                                        placeholder="이름을 입력하세요"
                                    />
                                </div>
                                <div className="property-group">
                                    <label>상세 내용</label>
                                    <textarea 
                                        name="description" 
                                        value={info.description} 
                                        onChange={handleChange} 
                                        placeholder="내용을 입력하세요"
                                       
                                    />
                                </div>
                                <button className="save-btn" onClick={handleSave}>
                                    변경사항 저장하기
                                </button>
                            </div>
                        ) : (
                            <div className="no-selection-wrapper">
                                <p className="no-selection">수정할 블록을 선택해 주세요.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="llm-panel">
                        <h3 className="info-title">AI 어시스턴트</h3>
                        {/* 채팅 내역이 표시되는 영역 (가변 높이 확보) */}
                        <div className="chat-history">
                            <div className="chat-msg ai">
                                안녕하세요. 선택하신 설계 블록에 대해 궁금한 점이나 보완할 점이 있다면 말씀해 주세요.
                            </div>
                        </div>
                        
                        {/* 통합형 채팅 입력창 (전송 버튼 내장형) */}
                        <div className="chat-input-wrapper">
                            <textarea 
                                className="chat-textarea"
                                placeholder="메시지를 입력하세요..." 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                            />
                            <button className="chat-send-icon-btn" title="전송">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 최하단 추출 버튼 고정 영역 */}
            <div className="extraction-section">
                <button className="foundation-btn">
                    파운데이션 코드 추출
                </button>
            </div>
        </aside>
    );
};

export default SidebarRight;