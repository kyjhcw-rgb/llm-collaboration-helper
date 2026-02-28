import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// 페이지들 불러오기
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import ProjectCreate from './pages/ProjectCreate';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/create" element={<ProjectCreate />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;