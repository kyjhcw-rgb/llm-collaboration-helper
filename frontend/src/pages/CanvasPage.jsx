import { useParams, useNavigate } from "react-router-dom";

export default function CanvasPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    return (
        <main>
            <header>
                <h2>다이어그램 캔버스 (프로젝트 ID: {projectId})</h2>
                <button type="button" onClick={() => navigate("/projects")}>
                    목록으로 나가기
                </button>
            </header>

            <section>
                <p>이곳에 다이어그램을 그리는 캔버스와 AI 조작 도구가 배치됩니다.</p>
            </section>
        </main>
    );
}