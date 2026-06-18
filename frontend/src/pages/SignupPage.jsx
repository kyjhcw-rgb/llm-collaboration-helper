import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { request } from "../api/http";
import '../styles/SignupPage.css'

export default function SignupPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);

    const [formData, setFormData] = useState({ username: "", password: "", nickname: "" });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // 1. 인증 메일 발송 (발송 전 이메일 중복 체크 포함)
    const handleSendEmail = async () => {
        if (!email) return alert("이메일을 입력해주세요.");

        try {
            // 메일 발송 전 이메일 가입 여부 확인
            const checkRes = await request(`/auth/check-email?email=${email}`, { method: "GET" });
            if (!checkRes.available) {
                return alert("이미 가입된 이메일입니다. 다른 이메일을 사용해주세요.");
            }

            await request("/auth/email/send", {
                method: "POST",
                body: JSON.stringify({ email })
            });
            setIsEmailSent(true);
            alert("인증 메일이 발송되었습니다. 메일함을 확인해주세요.");
        } catch (error) {
            alert(error.message);
        }
    };

    // 2. 인증 번호 확인
    const handleVerifyCode = async () => {
        if (!verificationCode) return alert("인증번호를 입력해주세요.");
        try {
            await request("/auth/email/verify", {
                method: "POST",
                body: JSON.stringify({ email, code: verificationCode })
            });
            setIsEmailVerified(true);
            alert("이메일 인증이 완료되었습니다!");
        } catch (error) {
            alert(error.message);
        }
    };

    // 3. 회원가입 완료 (가입 버튼 클릭 시 아이디 중복 확인 실행)
    const handleSignup = async (e) => {
        e.preventDefault();

        if (!isEmailVerified) return alert("이메일 인증을 완료해주세요.");

        try {
            // 💡 [가입 직전 방어] 아이디 중복 확인을 여기서 몰래 실행합니다.
            const checkRes = await request(`/auth/check-username?username=${formData.username}`, { method: "GET" });

            if (!checkRes.available) {
                return alert("이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.");
            }

            // 중복이 아니면 최종 회원가입 진행
            await request("/auth/signup", {
                method: "POST",
                body: JSON.stringify({
                    email,
                    username: formData.username,
                    password: formData.password,
                    nickname: formData.nickname
                }),
            });
            alert("회원가입 완료! 로그인해주세요.");
            navigate("/login");
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <main className="SignupBackground">
            <div className="SignupBox">
                <header className="Signupheader"><h1>회원가입</h1></header>
                <section>
                    <div className="Signup0">
                        <div className="Signup1">
                            <label>이메일</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEmailVerified} />
                            <button className="Signupsubbutton" type="button" onClick={handleSendEmail} disabled={isEmailVerified}>
                                {isEmailSent ? "재전송" : "인증번호 받기"}
                            </button>
                        </div>

                        {isEmailSent && !isEmailVerified && (
                            <div className="Signup2">
                                <label>인증번호</label>
                                <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
                                <button className="Signupsubbutton" type="button" onClick={handleVerifyCode}>확인</button>
                            </div>
                        )}
                    </div>
                </section>

                {isEmailVerified && (
                    <section className="Signup3">
                        <form onSubmit={handleSignup}>
                            <div>
                                <label>아이디</label>
                                <input name="username" type="text" value={formData.username} onChange={handleChange} required />
                            </div>
                            <div>
                                <label>비밀번호</label>
                                <input name="password" type="password" value={formData.password} onChange={handleChange} required />
                            </div>
                            <div>
                                <label>닉네임 (팀원 표시용)</label>
                                <input name="nickname" type="text" value={formData.nickname} onChange={handleChange} required />
                            </div>
                            <button className="Signupbutton" type="submit">가입하기</button>
                        </form>
                    </section>
                )}
            </div>
            <nav><Link to="/login">돌아가기</Link></nav>
        </main>
    );
}