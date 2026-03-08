import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

import githubicon from "../images/깃허브.png";
import googleicon from "../images/구글.png"; // ← 이거 구글 아이콘으로 바꿔주기!

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    console.log(email, password);
    navigate("/lobby");
  };

  const handleGithubLogin = () => {
    navigate("/lobby");
  };

  const handleGoogleLogin = () => {
    navigate("/landing");
  };

  return (
    <div className="login-background">
      <div className="login-box">
        <div className="login-select">
          <button type="button" onClick={handleGithubLogin}>
            <img src={githubicon} alt="github" className="icon" />
            Github로 로그인
          </button>

          <button type="button" onClick={handleGoogleLogin}>
            <img src={googleicon} alt="google" className="icon" />
            Google로 로그인
          </button>
        </div>

        <form onSubmit={handleLogin}>
        <div className='login-input'>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">로그인</button>
        
        
        </div>

        </form>
      </div>
    </div>
  );
}
