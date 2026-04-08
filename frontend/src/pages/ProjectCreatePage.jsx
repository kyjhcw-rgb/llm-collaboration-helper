import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api/http";

export default function ProjectCreatePage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ title: "", framework: "", freedomLevel: 3, descriptionPrompt: "" });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await request("/projects", { method: "POST", body: JSON.stringify(formData) });
            alert("프로젝트가 생성되었습니다.");
            navigate("/projects");
        } catch (error) { alert(error.message); }
    };

    return (
        <main>
            <header><h2>새 프로젝트 생성</h2></header>
            <section>
                <form onSubmit={handleSubmit}>
                    <div><label>프로젝트 이름</label><input name="title" type="text" value={formData.title} onChange={handleChange} required /></div>
                    <div><label>프레임워크</label><input name="framework" type="text" value={formData.framework} onChange={handleChange} required /></div>
                    <div><label>자유도 (1~5)</label><input name="freedomLevel" type="number" min="1" max="5" value={formData.freedomLevel} onChange={handleChange} /></div>
                    <div><label>초안 설명</label><textarea name="descriptionPrompt" rows="4" value={formData.descriptionPrompt} onChange={handleChange} required /></div>
                    <button type="button" onClick={() => navigate("/projects")}>취소</button>
                    <button type="submit">생성하기</button>
                </form>
            </section>
        </main>
    );
}