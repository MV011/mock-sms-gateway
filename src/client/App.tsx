import { Routes, Route, Navigate } from 'react-router-dom';
import Inbox from './pages/Inbox';

export default function App() {
  return (
    <div className="h-screen w-screen bg-[#010409] text-gray-200">
      <Routes>
        <Route path="/" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route
          path="/settings"
          element={
            <div className="flex h-full items-center justify-center text-gray-500">
              Settings — coming soon
            </div>
          }
        />
      </Routes>
    </div>
  );
}
