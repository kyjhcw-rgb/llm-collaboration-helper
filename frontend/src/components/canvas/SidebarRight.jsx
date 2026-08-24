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
        loadProjectFromServer,
        userRole,
        currentProjectId,
        currentVersion,
        myUserId, projectMembers
    } = useCanvasStore();

    const [activeTab, setActiveTab] = useState("info");
    const [info, setInfo] = useState({ label: "", description: "" });
    const [edgeInfo, setEdgeInfo] = useState({ type: "call" });

    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatMode, setChatMode] = useState("ask"); // 'ask' | 'agent'
    const chatBottomRef = useRef(null);
    const applyingProposalIdsRef = useRef(new Set()); // 연타로 agent/agree가 중복 호출되는 것 방지 (state는 반영 시차가 있어 ref로 동기 체크)

    // 댓글 및 멘션 관련 상태
    const [comments, setComments] = useState([]);
    const [commentInput, setCommentInput] = useState("");
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [mentionQuery, setMentionQuery] = useState(null);
    const [membersList, setMembersList] = useState([]);
    const commentInputRef = useRef(null);

    const isLive = currentVersion === 'live';
    const isEditable = userRole !== 'GUEST' && isLive;
    const isMockMode = currentProjectId === 'mock-project' || !currentProjectId;
    // Ask 모드는 GUEST도 사용 가능(백엔드 assertPartyMember만 적용), Agent 모드는 GUEST 불가(assertNotGuest)
    const canAsk = !isMockMode && isLive;
    const canAgent = canAsk && userRole !== 'GUEST';

    useEffect(() => {
        if (selectedNodeId) {
            const node = nodes.find((n) => n.id === selectedNodeId);
            if (node) {
                setInfo({
                    label: node.data?.label || node.data?.name || "",
                    description: node.data?.description || "",
                    lastUpdatedBy: node.data?.lastUpdatedBy || null
                });
            }
        }
    }, [selectedNodeId, nodes]);

    useEffect(() => {
        if (selectedEdgeId) {
            const edge = edges.find((e) => e.id === selectedEdgeId);
            if (edge) {
                setEdgeInfo({
                    type: edge.data?.type || "call",
                    lastUpdatedBy: edge.data?.lastUpdatedBy || null
                });
            }
        }
    }, [selectedEdgeId, edges]);

    // LLM 탭 진입 시 이전 대화 기록 로드
    useEffect(() => {
        if (activeTab !== "llm" || isMockMode) return;
        request(`/projects/${currentProjectId}/chat/messages`)
            .then(setMessages)
            .catch(() => {});
    }, [activeTab, currentProjectId]);

    // 메시지 추가 시 스크롤 하단으로
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 댓글 조회 및 멤버 리스트 로드
    useEffect(() => {
        if (activeTab === "comments" && selectedNodeId && !isMockMode) {
            fetchComments();
            // 멘션을 위한 멤버 리스트 로드
            request(`/projects/${currentProjectId}/members`)
                .then(setMembersList)
                .catch(console.error);
        }
    }, [activeTab, selectedNodeId, currentProjectId, isMockMode]);

    const fetchComments = async () => {
        try {
            const res = await request(`/projects/${currentProjectId}/blocks/${selectedNodeId}/comments`);
            setComments(res);
        } catch (e) {
            console.error(e);
        }
    };

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
            updateNodeData(selectedNodeId, { ...info, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() });
            await saveProjectToServer();
            alert("블록 정보가 성공적으로 저장 및 동기화되었습니다.");
        }
    };

    const handleSaveEdge = async () => {
        if (selectedEdgeId && isEditable) {
            updateEdgeData(selectedEdgeId, { ...edgeInfo, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() });
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
        const usingAgent = chatMode === "agent";
        if (!text || chatLoading || isMockMode) return;
        if (usingAgent ? !canAgent : !canAsk) return;

        const userMsg = { id: `tmp-${Date.now()}`, sender: "USER", message: text };
        setMessages((prev) => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);

        try {
            if (usingAgent) {
                // Agent 모드: 제안만 받아오고 캔버스에는 반영하지 않음 (동의 시에만 적용)
                const res = await request(`/projects/${currentProjectId}/chat/agent`, {
                    method: "POST",
                    body: JSON.stringify({ message: text }),
                });
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `tmp-${Date.now() + 1}`,
                        sender: "ASSISTANT",
                        type: "agent_proposal",
                        message: res.reply,
                        blocks: res.blocks || [],
                        edges: res.edges || [],
                        status: "pending",
                    },
                ]);
            } else {
                const res = await request(`/projects/${currentProjectId}/chat/ask`, {
                    method: "POST",
                    body: JSON.stringify({ message: text }),
                });
                setMessages((prev) => [
                    ...prev,
                    { id: `tmp-${Date.now() + 1}`, sender: "ASSISTANT", message: res.reply },
                ]);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                { id: `tmp-${Date.now() + 1}`, sender: "ASSISTANT", message: "응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    // Agent 제안에 동의 → 이때만 백엔드에 적용 요청을 보내고, 성공 시 캔버스를 새로고침
    const handleAgentAgree = async (msgId) => {
        if (applyingProposalIdsRef.current.has(msgId)) return; // 연타 시 두 번째 클릭을 동기적으로 즉시 차단
        const target = messages.find((m) => m.id === msgId);
        if (!target || target.status !== "pending") return;

        applyingProposalIdsRef.current.add(msgId);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "applying" } : m)));
        try {
            await request(`/projects/${currentProjectId}/chat/agent/agree`, {
                method: "POST",
                body: JSON.stringify({ blocks: target.blocks, edges: target.edges }),
            });
            await loadProjectFromServer(currentProjectId, null);
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "applied" } : m)));
        } catch (e) {
            alert(e.message || "변경사항 적용에 실패했습니다.");
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "pending" } : m)));
        } finally {
            applyingProposalIdsRef.current.delete(msgId);
        }
    };

    // 거부 시에는 로컬 상태만 지우고, 백엔드에는 어떤 요청도 보내지 않음
    const handleAgentDecline = (msgId) => {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "declined" } : m)));
    };

    const handleChatKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendChat();
        }
    };

    const getUpdaterName = (userId) => {
        const member = projectMembers.find(m => m.userId === userId);
        return member ? member.nickname : "정보 없음";
    };

    // --- 댓글 관련 핸들러 ---
    const handleCommentChange = (e) => {
        const val = e.target.value;
        setCommentInput(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPosition);
        const match = textBeforeCursor.match(/@(\S*)$/);

        if (match) {
            setMentionQuery(match[1]);
        } else {
            setMentionQuery(null);
        }
    };

    const handleMentionSelect = (nickname) => {
        const cursorPosition = commentInputRef.current.selectionStart;
        const textBeforeCursor = commentInput.slice(0, cursorPosition);
        const textAfterCursor = commentInput.slice(cursorPosition);
        const lastAtPos = textBeforeCursor.lastIndexOf('@');

        const newText = textBeforeCursor.slice(0, lastAtPos) + `@${nickname} ` + textAfterCursor;
        setCommentInput(newText);
        setMentionQuery(null);
        commentInputRef.current?.focus();
    };

    const handleSendComment = async () => {
        if (!commentInput.trim() || !isEditable) return;
        try {
            if (editingCommentId) {
                await request(`/projects/${currentProjectId}/blocks/${selectedNodeId}/comments/${editingCommentId}`, {
                    method: "PUT",
                    body: JSON.stringify({ content: commentInput })
                });
                setEditingCommentId(null);
            } else {
                await request(`/projects/${currentProjectId}/blocks/${selectedNodeId}/comments`, {
                    method: "POST",
                    body: JSON.stringify({ content: commentInput })
                });
            }
            setCommentInput("");
            fetchComments();
        } catch (e) {
            alert(e.message || "댓글 저장에 실패했습니다.");
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        try {
            await request(`/projects/${currentProjectId}/blocks/${selectedNodeId}/comments/${commentId}`, {
                method: "DELETE"
            });
            fetchComments();
        } catch (e) {
            alert(e.message || "삭제 실패");
        }
    };

    const renderCommentBody = (text) => {
        const parts = text.split(/(@\S+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} style={{ color: '#4953BE', fontWeight: 'bold' }}>{part}</span>;
            }
            return part;
        });
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
                <button
                    className={`tab-btn ${activeTab === "comments" ? "active" : ""}`}
                    onClick={() => setActiveTab("comments")}
                >
                    댓글
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
                                <div className="property-group">
                                    <label>최근 수정자</label>
                                    <div style={{ padding: '8px', backgroundColor: '#f0f2fb', borderRadius: '8px', fontSize: '13px', color: '#4953BE', fontWeight: 'bold' }}>
                                        {getUpdaterName(edgeInfo.lastUpdatedBy)}
                                    </div>
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
                                msg.type === "agent_proposal" ? (
                                    <div key={msg.id} className="chat-msg ai agent-proposal">
                                        <div>{msg.message}</div>
                                        <div className="agent-proposal-summary">
                                            📋 블록 {msg.blocks.length}개 · 엣지 {msg.edges.length}개 변경 제안
                                        </div>
                                        {msg.status === "pending" && (
                                            <div className="agent-proposal-actions">
                                                <button className="agent-decline-btn" onClick={() => handleAgentDecline(msg.id)}>
                                                    거부
                                                </button>
                                                <button className="agent-agree-btn" onClick={() => handleAgentAgree(msg.id)}>
                                                    동의하고 적용
                                                </button>
                                            </div>
                                        )}
                                        {msg.status === "applying" && (
                                            <div className="agent-proposal-status">적용 중...</div>
                                        )}
                                        {msg.status === "applied" && (
                                            <div className="agent-proposal-status applied">✅ 캔버스에 적용됨</div>
                                        )}
                                        {msg.status === "declined" && (
                                            <div className="agent-proposal-status declined">거부됨 (캔버스에 반영되지 않았습니다)</div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        key={msg.id}
                                        className={`chat-msg ${msg.sender === "USER" ? "user" : "ai"}`}
                                    >
                                        {msg.message}
                                    </div>
                                )
                            ))}
                            {chatLoading && (
                                <div className="chat-msg ai chat-loading">
                                    <span>.</span><span>.</span><span>.</span>
                                </div>
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        {!isMockMode && (
                            <div className="chat-mode-toggle">
                                <button
                                    className={`mode-btn ${chatMode === "ask" ? "active" : ""}`}
                                    onClick={() => setChatMode("ask")}
                                >
                                    질문 (Ask)
                                </button>
                                {userRole !== 'GUEST' && (
                                    <button
                                        className={`mode-btn ${chatMode === "agent" ? "active" : ""}`}
                                        onClick={() => setChatMode("agent")}
                                    >
                                        수정 제안 (Agent)
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="chat-input-wrapper">
                            <textarea
                                className="chat-textarea"
                                placeholder={
                                    isMockMode
                                        ? "실제 프로젝트에서 사용 가능합니다"
                                        : !isLive
                                        ? "과거 버전은 읽기 전용입니다"
                                        : chatMode === "agent"
                                        ? "다이어그램에 반영할 변경사항을 지시하세요... (적용 전 동의 절차를 거칩니다)"
                                        : "메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                                }
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatKeyDown}
                                disabled={isMockMode || !canAsk || chatLoading}
                            />
                            <button
                                className="chat-send-icon-btn"
                                title="전송"
                                onClick={handleSendChat}
                                disabled={isMockMode || !canAsk || chatLoading || !chatInput.trim()}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "comments" && (
                    <div className="comments-panel">
                        {!selectedNodeId ? (
                            <div className="no-selection-wrapper">
                                <p className="no-selection">블럭을 선택해주세요.</p>
                            </div>
                        ) : (
                            <>
                                <div className="comment-list">
                                    {comments.length === 0 ? (
                                        <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>아직 등록된 댓글이 없습니다.</p>
                                    ) : (
                                        comments.map(c => (
                                            <div key={c.id} className="comment-item">
                                                <span className="comment-author">{c.nickname}</span>
                                                <div className="comment-body">{renderCommentBody(c.content)}</div>
                                                <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
                                                {isEditable && c.userId === myUserId && (
                                                    <div className="comment-actions">
                                                        <button onClick={() => { setCommentInput(c.content); setEditingCommentId(c.id); }}>수정</button>
                                                        <button onClick={() => handleDeleteComment(c.id)}>삭제</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* 과거 버전이거나 권한이 없는 경우(isEditable=false) 작성/수정 UI 비노출 */}
                                {isEditable && (
                                    <div className="comment-input-wrapper">
                                        {mentionQuery !== null && (
                                            <ul className="mention-dropdown">
                                                {membersList.filter(m => m.nickname.toLowerCase().includes(mentionQuery.toLowerCase())).map(m => (
                                                    <li key={m.userId} onClick={() => handleMentionSelect(m.nickname)}>
                                                        {m.nickname}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <textarea
                                            ref={commentInputRef}
                                            className="comment-textarea"
                                            placeholder="댓글을 입력하세요... (@로 멤버 멘션)"
                                            value={commentInput}
                                            onChange={handleCommentChange}
                                        />
                                        <div className="comment-input-actions">
                                            {editingCommentId && <button className="cancel-btn" onClick={() => {setEditingCommentId(null); setCommentInput("");}}>취소</button>}
                                            <button className="save-btn" onClick={handleSendComment}>{editingCommentId ? "수정" : "등록"}</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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
