import { useState, useEffect } from 'react';
import '../styles/EditProfileModal.css';

export default function EditProfileModal({ isOpen, onClose, currentUser, onSave }) {
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [editingFields, setEditingFields] = useState({
    nickname: false,
    username: false,
    password: false,
  });

  const [backupData, setBackupData] = useState({
    nickname: '',
    username: '',
  });

  useEffect(() => {
    if (isOpen && currentUser) {
      const initNickname = currentUser.nickname || '';
      const initUsername = currentUser.username || '';
      setNickname(initNickname);
      setUsername(initUsername);
      setPassword('');
      setConfirmPassword('');
      setEditingFields({ nickname: false, username: false, password: false });
      setBackupData({ nickname: initNickname, username: initUsername });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleEditStart = (field) => {
    setEditingFields((prev) => ({ ...prev, [field]: true }));
    if (field === 'nickname') setBackupData((prev) => ({ ...prev, nickname }));
    if (field === 'username') setBackupData((prev) => ({ ...prev, username }));
  };

  const handleCancel = (field) => {
    setEditingFields((prev) => ({ ...prev, [field]: false }));
    
    if (field === 'nickname') setNickname(backupData.nickname);
    if (field === 'username') setUsername(backupData.username);
    if (field === 'password') {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleSave = (field) => {
    if (field === 'nickname' && !nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    if (field === 'username' && !username.trim()) {
      alert('아이디를 입력해주세요.');
      return;
    }
    if (field === 'password') {
      if (!password) {
        alert('변경할 비밀번호를 입력해주세요.');
        return;
      }
      if (password !== confirmPassword) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    onSave({
      nickname: field === 'nickname' ? nickname : currentUser.nickname,
      username: field === 'username' ? username : currentUser.username,
      password: field === 'password' ? password : '', 
    });

    setEditingFields((prev) => ({ ...prev, [field]: false }));
    if (field === 'nickname') setBackupData((prev) => ({ ...prev, nickname }));
    if (field === 'username') setBackupData((prev) => ({ ...prev, username }));
    if (field === 'password') {
      setPassword('');
      setConfirmPassword('');
    }
    
    alert('수정이 완료되었습니다.');
  };

  const isAnyEditing = editingFields.nickname || editingFields.username || editingFields.password;

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

        {/* 아이디 필드 */}
        <div className="input-row">
          <div className="input-group">
            <label>아이디</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              disabled={!editingFields.username} 
            />
          </div>
          {!editingFields.username && (
            <button className="row-edit-button" onClick={() => handleEditStart('username')}>수정</button>
          )}
        </div>
        {editingFields.username && (
          <div className="row-action-buttons">
            <button className="cancel-button" onClick={() => handleCancel('username')}>취소</button>
            <button className="save-button" onClick={() => handleSave('username')}>저장</button>
          </div>
        )}

        {/* 비밀번호 필드 */}
        <div className="input-row">
          <div className="input-group">
            <label>비밀번호</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              disabled={!editingFields.password} 
              placeholder={editingFields.password ? "새 비밀번호 입력" : "********"}
            />
          </div>
          {!editingFields.password && (
            <button className="row-edit-button" onClick={() => handleEditStart('password')}>수정</button>
          )}
        </div>

        {/* 비밀번호 수정 모드일 때만 비밀번호 재확인 및 하단 버튼 렌더링 */}
        {editingFields.password && (
          <>
            <div className="input-group password-confirm-group">
              <label>비밀번호 확인</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="비밀번호 재입력"
              />
            </div>
            <div className="row-action-buttons">
              <button className="cancel-button" onClick={() => handleCancel('password')}>취소</button>
              <button className="save-button" onClick={() => handleSave('password')}>저장</button>
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}
