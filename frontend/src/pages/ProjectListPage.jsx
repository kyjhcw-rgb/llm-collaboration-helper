import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import '../styles/ProjectListPage.css'
import usericon from "../images/usericon.png";

export default function ProjectListPage() {
    const navigate = useNavigate();
    // 초기값을 빈 배열로 설정하여 "프로젝트 없음" 상태를 유지합니다.
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        // 기존의 request("/projects") 호출을 삭제하거나 주석 처리합니다.
        // 이렇게 하면 로그인 후 이 페이지에 도달했을 때 서버 에러로 튕기지 않습니다.
        console.log("빈 프로젝트 페이지 로드 완료");
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("accessToken");
        navigate("/login");
    };

    return (
        <main className="ProjectListPage-background">
            <header className="ProjectListPage-header">
                <h1>Our Diagram</h1>
                <h2><img className="usericon" src={usericon} alt="user-icon" />
                <button type="button" onClick={handleLogout}>로그아웃</button></h2>
            </header>

            <section className="ProjectListPage-contents-top">
                <h1>내 프로젝트</h1>
                <button type="button" onClick={() => navigate("/projects/new")}>
                    + 새 프로젝트
                </button>
            </section>

            <section className="ProjectListPage-contents-bottom">
                {/* 항상 빈 배열이므로 아래 문구가 화면에 표시됩니다. */}
                <div style={{ textAlign: "center", marginTop: "50px", color: "#888" }}>
                    <p>현재 참여 중인 프로젝트가 없습니다.</p>
                    <p>새 프로젝트를 생성하여 협업을 시작해보세요!</p>
                </div>
            </section>
        </main>
    );
}
