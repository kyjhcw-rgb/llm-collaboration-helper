import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EditProfileModal from './EditProfileModal';

export default function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // 묵업값
  const [currentUser, setCurrentUser] = useState({
    nickname: location.state?.nickname || '사용자',
    username: 'user_id',
  });

  const handleSave = (updatedData) => {
    setCurrentUser((prev) => ({ ...prev, ...updatedData }));
  };

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <EditProfileModal
        isOpen={true} 
        onClose={() => navigate('/projects')} 
        currentUser={currentUser}
        onSave={handleSave}
      />
    </div>
  );
}
