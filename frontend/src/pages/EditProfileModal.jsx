import { useState, useEffect } from 'react';
import '../styles/EditProfileModal.css';

export default function EditProfileModal({ isOpen, onClose, currentUser, onSave }) {
    const [nickname, setNickname] = useState('');
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [backupData, setBackupData] = useState({});

    const [editingFields, setEditingFields] = useState({
        nickname: false,
        password: false,
    });

    useEffect(() => {
        if (isOpen && currentUser) {
            setNickname(currentUser.nickname || '');
            setUsername(currentUser.username || '');
            setCurrentPassword('');
            setPassword('');
            setConfirmPassword('');
            setEditingFields({ nickname: false, password: false });
            setBackupData({ nickname: currentUser.nickname || '' });
        }
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    const handleEditStart = (field) => {
        setEditingFields((prev) => ({ ...prev, [field]: true }));
        if (field === 'nickname') setBackupData({ nickname });
    };

    const handleCancel = (field) => {
        setEditingFields((prev) => ({ ...prev, [field]: false }));

        if (field === 'nickname') setNickname(backupData.nickname);
        if (field === 'password') {
            setCurrentPassword('');
            setPassword('');
            setConfirmPassword('');
        }
    };

    const handleSave = async (field) => {
        if (field === 'nickname' && !nickname.trim()) {
            alert('닉네임을 입력하세요.');
            return;
        }

        if (field === 'password') {
            if (!currentPassword) {
                alert('현재 비밀번호를 입력해주세요.');
                return;
            }
            if (!password) {
                alert('새 비밀번호를 입력해주세요.');
                return;
            }
            if (password !== confirmPassword) {
                alert('새 비밀번호가 일치하지 않습니다.');
                return;
            }
        }

        // 백엔드 UserUpdateReq 스펙에 맞춘 페이로드
        const payload = {};
        if (field === 'nickname') payload.nickname = nickname;
        if (field === 'password') {
            payload.currentPassword = currentPassword;
            payload.newPassword = password;
        }

        try {
            await onSave(payload, field); // 비동기 API 통신 대기

            setEditingFields((prev) => ({ ...prev, [field]: false }));
            if (field === 'nickname') setBackupData((prev) => ({ ...prev, nickname }));
            if (field === 'password') {
                setCurrentPassword('');
                setPassword('');
                setConfirmPassword('');
            }
            alert('수정되었습니다.');
        } catch (error) {
            // ProfilePage 측에서 alert을 띄우므로 여기선 모달만 유지시킴
        }
    };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* 오른쪽 위 X 버튼 */}
        <button className="close-button" onClick={onClose}>&times;</button>
        
        <h2 className="modal-title">회원 정보 수정</h2>
        
        {/* 닉네임 필드 */}
        <div className="input-row">
          <div className="input-group">
            <label>닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={!editingFields.nickname}
            />
          </div>
          {!editingFields.nickname && (
            <button className="row-edit-button" onClick={() => handleEditStart('nickname')}>수정</button>
          )}
        </div>
        {editingFields.nickname && (
          <div className="row-action-buttons">
            <button className="cancel-button" onClick={() => handleCancel('nickname')}>취소</button>
            <button className="save-button" onClick={() => handleSave('nickname')}>저장</button>
          </div>
        )}

        {/* 아이디 필드 - 백엔드 정책 상 수정 불가 */}
        <div className="input-row">
          <div className="input-group">
            <label>아이디</label>
            <input
              type="text"
              value={username}
              disabled={true}
            />
          </div>
        </div>

        {/* 비밀번호 필드 */}
        <div className="input-row">
          <div className="input-group">
            <label>비밀번호</label>

            {/* 수정 모드가 아닐 때: 숨김 처리된 기본 칸 표시 */}
            {!editingFields.password ? (
              <input
                type="password"
                value="********"
                disabled={true}
              />
            ) : (
              /* 수정 모드일 때: 3개의 칸(현재, 새 비밀번호, 확인)을 명확하게 표시 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                  autoFocus
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호 입력"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호 확인"
                />
              </div>
            )}
          </div>

          {!editingFields.password && (
            <button className="row-edit-button" onClick={() => handleEditStart('password')}>수정</button>
          )}
        </div>

        {/* 비밀번호 취소/저장 버튼 */}
        {editingFields.password && (
          <div className="row-action-buttons" style={{ marginTop: '10px' }}>
            <button className="cancel-button" onClick={() => handleCancel('password')}>취소</button>
            <button className="save-button" onClick={() => handleSave('password')}>저장</button>
          </div>
        )}

      </div>
    </div>
  );
}
