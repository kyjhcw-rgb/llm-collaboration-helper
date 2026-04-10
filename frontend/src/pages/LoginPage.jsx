import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { request } from "../api/http";
import '../styles/LoginPage.css'
import logo2 from "../images/logo2.png";
import logo1 from "../images/logo1.png";

export default function LoginPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: "", password: "" });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify(formData),
            });
            localStorage.setItem("accessToken", response.accessToken);
            navigate("/projects");
        } catch (error) {
            alert(error.message || "로그인에 실패했습니다.");
        }
    };

    return (
        <main className="LoginBackground">
            <div className="LoginBox">
                <header className="LoginHeader">
                <img className="logo1" src={logo1} alt="logo1" />
                <img className="logo2" src={logo2} alt="logo2" />
               
                </header>
                <section className="LoginSection">
                <form onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="username">아이디</label>
                        <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required />
                    </div>
                    <div>
                        <label htmlFor="password">비밀번호</label>
                        <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required />
                    </div>
                    <button className="Loginbutton" type="submit">로그인</button>
                </form>
                </section>
                <nav>
                    <Link to="/signup">계정이 없으신가요? 회원가입</Link>
                </nav>
            </div>
        </main>
    );
}
