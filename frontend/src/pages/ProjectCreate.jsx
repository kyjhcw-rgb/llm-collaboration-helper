import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../style/ProjectBox.css"; 
import folderIcon from "../images/folder.png"; 

export default function ProjectCreate() {
  const navigate = useNavigate();
  // 1부터 7까지 단계를 저장해 둠
  const [step, setStep] = useState(1);
  // 프로젝트 이름을 저장함
  const [projectName, setProjectName] = useState("");

  // 다음 단계로 넘기거나 마지막 단계에서 분석을 시작함
  const handleNext = () => {
    if (step < 7) {
      setStep(step + 1);
    } else {
      alert("프로젝트 분석을 시작합니다."); 
      navigate('/lobby');
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}>
      <div className="box">
        <div className="header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={folderIcon} alt="folder" style={{ width: '40px' }} />
          <div style={{ border: '1px solid #D0DFFF', padding: '5px 15px', borderRadius: '10px', backgroundColor: '#fff' }}>
             <span style={{ color: '#000', fontWeight: 'bold' }}>
               {projectName || "project name"}
             </span>
          </div>
        </div>

        <div className="content" style={{ padding: '30px', minHeight: '400px' }}>
          {step === 1 && (
            <div>
              <h3>Step 1. 기본 정보</h3>
              <div style={{ marginTop: '10px' }}>
                <label>프로젝트 이름: </label>
                <input 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  style={{ marginBottom: '10px', padding: '5px' }} 
                />
              </div>
              <div style={{ marginTop: '10px' }}>
                <h4>프로젝트 실행 날짜</h4>
                시작일: <input type="text" placeholder="년" style={{ width: '50px', marginRight: '5px' }} /> 년 
                <input type="text" placeholder="월" style={{ width: '30px', margin: '0 5px' }} /> 월 
                <input type="text" placeholder="일" style={{ width: '30px', margin: '0 5px' }} /> 일 <br/><br/>
                종료일: <input type="text" placeholder="년" style={{ width: '50px', marginRight: '5px' }} /> 년 
                <input type="text" placeholder="월" style={{ width: '30px', margin: '0 5px' }} /> 월 
                <input type="text" placeholder="일" style={{ width: '30px', margin: '0 5px' }} /> 일
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>Step 2. 분석 설정 및 생성 (주기)</h3>
              <div style={{ marginTop: '10px' }}>
                분석 주기: <input type="number" style={{ width: '50px' }} /> 일
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Step 3. 깃허브 데이터 연결</h3>
              <p>해당 프로젝트의 GITHUB Repository를 연결해주세요.</p>
              <select style={{ padding: '5px', width: '200px' }}>
                <option>레포지토리 선택 (드롭다운)</option>
                <option>user/backend</option>
                <option>user/frontend</option>
              </select>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3>Step 4. 노션 데이터 연결</h3>
              <p>해당 프로젝트에 해당하는 노션 데이터 소스 연결</p>
              <select style={{ padding: '5px', width: '200px' }}>
                <option>태스크 선택 (드롭다운)</option>
                <option>Task 1</option>
              </select>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3>Step 5. 기획서 업로드</h3>
              <input type="file" />
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 style={{ marginBottom: '10px' }}>Step 6. 팀원 매핑</h3>
              <p>팀원의 GITHUB와 NOTION 계정을 매핑해주세요.</p>
              <table style={{ width: '100%', marginTop: '20px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th>GITHUB</th>
                    <th>NOTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: '#FF5B5B', fontWeight: 'bold' }}>user-id</td>
                    <td>
                      <select style={{ padding: '5px' }}>
                        <option>선택</option>
                        <option>Notion User A</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {step === 7 && (
            <div>
              <h3>Step 7. 설정 완료</h3>
              <p>준비가 완료되었습니다. 아래의 분석 버튼을 눌러주세요.</p>
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px', gap: '10px' }}>
          <button 
            style={{ border: '1px solid #3C79FE', color: '#3C79FE', padding: '10px 25px', borderRadius: '5px' }} 
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          >
            {step === 1 ? '닫기' : '이전'}
          </button>
          <button 
            style={{ backgroundColor: '#3C79FE', color: '#fff', padding: '10px 25px', borderRadius: '5px' }} 
            onClick={handleNext}
          >
            {step === 7 ? '분석' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}