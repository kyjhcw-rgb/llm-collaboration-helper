import React, { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { request } from "../../api/http";
import './SidebarRight.css';

const SidebarRight = () => {
    const {
        nodes,
        edges,
        selectedNodeId,
        setSelectedNodeId,
        selectedEdgeId,
        setSelectedEdgeId,
        updateNodeData,
        updateEdgeData,
        deleteNode,  // 새롭게 만든 Yjs 기반 노드 삭제 함수
        deleteEdge,  // 새롭게 만든 Yjs 기반 엣지 삭제 함수
        saveProjectToServer,
        userRole,    // GUEST 여부를 판단하기 위해 스토어에서 가져옴
        currentProjectId,
    } = useCanvasStore();

    const [activeTab, setActiveTab] = useState("info");
    const [info, setInfo] = useState({ label: "", description: "" });
    const [edgeInfo, setEdgeInfo] = useState({ type: "call" });

    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const chatBottomRef = useRef(null);

    // GUEST 권한일 경우 편집을 막기 위한 플래그
    const isEditable = userRole !== 'GUEST';
    const isMockMode = currentProjectId === 'mock-project' || !currentProjectId;

    useEffect(() => {
        if (selectedNodeId) {
            const node = nodes.find((n) => n.id === selectedNodeId);
            if (node) {
                setInfo({
                    label: node.data?.label || node.data?.name || "",
                    description: node.data?.description || ""
                });
            }
        }
    }, [selectedNodeId, nodes]);

    useEffect(() => {
        if (selectedEdgeId) {
            const edge = edges.find((e) => e.id === selectedEdgeId);
            if (edge) {
                setEdgeInfo({ type: edge.data?.type || "call" });
            }
        }
    }, [selectedEdgeId, edges]);

    // LLM 탭 진입 시 이전 대화 기록 로드
    useEffect(() => {
        if (activeTab !== "llm" || isMockMode) return;
        request(`/projects/${currentProjectId}/chat`)
            .then(setMessages)
            .catch(() => {});
    }, [activeTab, currentProjectId]);

    // 메시지 추가 시 스크롤 하단으로
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleNodeChange = (e) => {
        const { name, value } = e.target;
        setInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleEdgeChange = (e) => {
        const { name, value } = e.target;
        setEdgeInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveNode = async () => {
        if (selectedNodeId && isEditable) {
            updateNodeData(selectedNodeId, info);
            await saveProjectToServer();
            alert("블록 정보가 성공적으로 저장 및 동기화되었습니다.");
        }
    };

    const handleSaveEdge = async () => {
        if (selectedEdgeId && isEditable) {
            updateEdgeData(selectedEdgeId, edgeInfo);
            await saveProjectToServer();
            alert("선 타입이 성공적으로 변경 및 동기화되었습니다.");
        }
    };

    // Yjs 트랜잭션 함수(deleteNode)를 사용하여 크래시 방지
    const handleDeleteBlock = async () => {
        if (!selectedNodeId || !isEditable) return;
        const confirmDelete = window.confirm("블록과 연결된 선이 함께 삭제됩니다. 진행하시겠습니까?");
        if (!confirmDelete) return;

        deleteNode(selectedNodeId);
        setSelectedNodeId(null);
        saveProjectToServer();
    };

    // Yjs 트랜잭션 함수(deleteEdge)를 사용하여 크래시 방지
    const handleDeleteEdge = async () => {
        if (!selectedEdgeId || !isEditable) return;

        deleteEdge(selectedEdgeId);
        setSelectedEdgeId(null);
        saveProjectToServer();
    };

    const handleSendChat = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading || isMockMode || !isEditable) return;

        const userMsg = { id: `tmp-${Date.now()}`, sender: "USER", message: text };
        setMessages((prev) => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);

        try {
            const res = await request(`/projects/${currentProjectId}/chat`, {
                method: "POST",
                body: JSON.stringify({ message: text }),
            });
            setMessages((prev) => [
                ...prev,
                { id: `tmp-${Date.now() + 1}`, sender: "ASSISTANT", message: res.reply },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { id: `tmp-${Date.now() + 1}`, sender: "ASSISTANT", message: "응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleChatKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendChat();
        }
    };

    return (
        <aside className="sidebar-right">
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

            <div className="tab-content">
                {activeTab === "info" && (
                    <div className="info-panel">
                        {/* 1. 선(Edge)이 선택된 경우 */}
                        {selectedEdgeId && (
                            <div className="info-form">
                                <div className="property-group">
                                    <label>관계선 유형</label>
                                    <select
                                        name="type"
                                        value={edgeInfo.type}
                                        onChange={handleEdgeChange}
                                        disabled={!isEditable} // GUEST는 선택 박스 비활성화
                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: !isEditable ? '#f5f5f5' : 'white' }}
                                    >
                                        <option value="call">호출/데이터 (파란색 실선)</option>
                                        <option value="inheritance">상속 (보라색 실선)</option>
                                        <option value="implementation">구현 (초록색 점선)</option>
                                    </select>
                                </div>
                                {/* GUEST에게는 저장/삭제 버튼 자체를 숨김 */}
                                {isEditable && (
                                    <>
                                        <button className="save-btn" onClick={handleSaveEdge}>
                                            관계선 저장하기
                                        </button>
                                        <button className="delete-block-btn" onClick={handleDeleteEdge}>
                                            선 삭제하기
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 2. 블록(Node)이 선택된 경우 */}
                        {!selectedEdgeId && selectedNodeId && (
                            <div className="info-form">
                                <div className="property-group">
                                    <label>블록 이름</label>
                                    <input
                                        name="label"
                                        value={info.label}
                                        onChange={handleNodeChange}
                                        placeholder="이름을 입력하세요"
                                        disabled={!isEditable} // GUEST는 입력 비활성화
                                        style={{ backgroundColor: !isEditable ? '#f5f5f5' : 'white' }}
                                    />
                                </div>
                                <div className="property-group">
                                    <label>상세 내용</label>
                                    <textarea
                                        name="description"
                                        value={info.description}
                                        onChange={handleNodeChange}
                                        placeholder="내용을 입력하세요"
                                        disabled={!isEditable} // GUEST는 입력 비활성화
                                        style={{ backgroundColor: !isEditable ? '#f5f5f5' : 'white' }}
                                    />
                                </div>
                                {/* GUEST에게는 저장/삭제 버튼 자체를 숨김 */}
                                {isEditable && (
                                    <>
                                        <button className="save-btn" onClick={handleSaveNode}>
                                            변경사항 저장하기
                                        </button>
                                        <button className="delete-block-btn" onClick={handleDeleteBlock}>
                                            블록 삭제하기
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. 아무것도 선택되지 않았을 때 */}
                        {!selectedEdgeId && !selectedNodeId && (
                            <div className="no-selection-wrapper">
                                <p className="no-selection">수정할 블록이나 선을 클릭해 주세요.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "llm" && (
                    <div className="llm-panel">
                        <h3 className="info-title">AI 어시스턴트</h3>
                        <div className="chat-history">
                            <div className="chat-msg ai">
                                안녕하세요. 현재 프로젝트 다이어그램을 기반으로 궁금한 점이나 보완할 점이 있다면 말씀해 주세요.
                            </div>
                            {isMockMode && (
                                <div className="chat-msg ai">
                                    채팅 기능은 실제 프로젝트에서 사용할 수 있습니다.
                                </div>
                            )}
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`chat-msg ${msg.sender === "USER" ? "user" : "ai"}`}
                                >
                                    {msg.message}
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="chat-msg ai chat-loading">
                                    <span>.</span><span>.</span><span>.</span>
                                </div>
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        <div className="chat-input-wrapper">
                            <textarea
                                className="chat-textarea"
                                placeholder={
                                    isMockMode
                                        ? "실제 프로젝트에서 사용 가능합니다"
                                        : !isEditable
                                        ? "GUEST는 채팅을 사용할 수 없습니다"
                                        : "메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                                }
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatKeyDown}
                                disabled={isMockMode || !isEditable || chatLoading}
                            />
                            <button
                                className="chat-send-icon-btn"
                                title="전송"
                                onClick={handleSendChat}
                                disabled={isMockMode || !isEditable || chatLoading || !chatInput.trim()}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="extraction-section">
                <button className="foundation-btn">
                    파운데이션 코드 추출
                </button>
            </div>
        </aside>
    );
};

export default SidebarRight;
