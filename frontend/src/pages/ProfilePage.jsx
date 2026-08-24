import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/http';
import EditProfileModal from './EditProfileModal';

export default function ProfilePage() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);

    // 1. 컴포넌트 마운트 시 사용자 프로필 정보 조회
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await request('/users/me', { method: 'GET' });
                setCurrentUser(data); // 백엔드에서 반환하는 { id, username, email, nickname, profileImageUrl } 형태
            } catch (error) {
                console.error("프로필 조회 오류:", error);
                alert("프로필 정보를 불러오지 못했습니다.");
                navigate('/projects');
            }
        };
        fetchProfile();
    }, [navigate]);

    // 2. 백엔드로 프로필 수정 요청 (닉네임 또는 비밀번호)
    const handleSave = async (updatedData, field) => {
        try {
            await request('/users/me', {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            // 요청 성공 시 로컬 상태 반영
            if (updatedData.nickname) {
                setCurrentUser((prev) => ({ ...prev, nickname: updatedData.nickname }));
            }
        } catch (error) {
            console.error("프로필 업데이트 오류:", error);
            alert("프로필 업데이트에 실패했습니다. 현재 비밀번호 등을 확인해주세요.");
            throw error; // 에러를 던져 모달이 닫히지 않도록 유지
        }
    };

    if (!currentUser) return null; // 로딩 중 화면 처리

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