import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectListPage from './pages/ProjectListPage';
import CanvasPage from './pages/CanvasPage'; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />  
        <Route path="/lobby" element={<ProjectListPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;