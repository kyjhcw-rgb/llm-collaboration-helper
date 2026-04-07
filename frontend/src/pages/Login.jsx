import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

import logo1 from "../images/logo1.png";
import logo2 from "../images/logo2.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    console.log(email, password);
    navigate("/lobby");
  };


  return (
    <div className="login-background">
      
      <img className="logo1" src={logo1} alt="logo" />
      <img className="logo2" src={logo2} alt="logo" />
      <div className="login-box">
        
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
          <button className="submit" type="submit">로그인</button>
          <div className="footer">
            <button className="newuser">회원가입</button>
            <span className="division"> | </span>
            <button className="finduser">아이디/비밀번호 찾기</button>
          </div>
        
        
        </div>

        </form>
      </div>
    </div>
  );
}
