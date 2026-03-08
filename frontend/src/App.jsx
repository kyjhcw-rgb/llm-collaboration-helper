import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// 페이지들 불러오기
import Login from './pages/Login';
import Landing from './pages/Landing';
import ProjectCreate from './pages/ProjectCreate';
import Lobby from './pages/Lobby';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/projectcreate" element={<ProjectCreate />} />
        <Route path="/lobby" element={<Lobby />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
