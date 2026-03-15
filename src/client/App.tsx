import { Routes, Route, Navigate } from 'react-router-dom';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="h-screen w-screen bg-[#010409] text-gray-200">
      <Routes>
        <Route path="/" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
