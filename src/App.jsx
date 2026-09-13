import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminLayout from "./components/layout/AdminLayout.jsx";

import AdminLogin from "./pages/AdminLogin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Announcements from "./pages/Announcements.jsx";
import DocumentRepository from "./pages/DocumentRepository.jsx";
import DocumentQueue from "./pages/DocumentQueue.jsx";
import Scholarships from "./pages/Scholarships.jsx";
import AchievementManagement from "./pages/AchievementManagement.jsx";
import CampusFeed from "./pages/CampusFeed.jsx";
import StudentEndorsement from "./pages/StudentEndorsement.jsx";
import StudentLeaders from "./pages/StudentLeaders.jsx";
import JobPostings from "./pages/JobPostings.jsx";
import AlumniProfiles from "./pages/AlumniProfiles.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import Analytics from "./pages/Analytics.jsx";
import FAQ from "./pages/FAQ.jsx";
import Reports from "./pages/Reports.jsx";
import SaaChat from "./pages/SaaChat.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="document-repository" element={<DocumentRepository />} />
          <Route path="document-queue" element={<DocumentQueue />} />
          <Route path="scholarships" element={<Scholarships />} />
          <Route path="achievements" element={<AchievementManagement />} />
          <Route path="campus-feed" element={<CampusFeed />} />
          <Route path="student-endorsement" element={<StudentEndorsement />} />
          <Route path="student-leaders" element={<StudentLeaders />} />
          <Route path="job-postings" element={<JobPostings />} />
          <Route path="alumni-profiles" element={<AlumniProfiles />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="reports" element={<Reports />} />
          <Route path="saa-chat" element={<SaaChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
