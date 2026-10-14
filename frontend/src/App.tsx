import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { StaffPage } from "./pages/superadmin/StaffPage";
import { StatsPage } from "./pages/superadmin/StatsPage";
import { StudentsPage } from "./pages/admin/StudentsPage";
import { SubjectsPage } from "./pages/admin/SubjectsPage";
import { GroupsPage } from "./pages/admin/GroupsPage";
import { GroupDetailPage } from "./pages/admin/GroupDetailPage";
import { TransactionsPage } from "./pages/admin/TransactionsPage";
import { MyGroupsPage } from "./pages/teacher/MyGroupsPage";
import { TeacherGroupDetailPage } from "./pages/teacher/GroupDetailPage";
import { AttendancePage } from "./pages/teacher/AttendancePage";
import { FinancePage } from "./pages/teacher/FinancePage";
import { TeacherTransactionsPage } from "./pages/teacher/TransactionsPage";
import { StudentDashboard } from "./pages/student/StudentDashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />

          <Route
            path="/superadmin/staff"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/stats"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <StatsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/students"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/subjects"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <SubjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/groups"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/groups/:groupId"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <GroupDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/transactions"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/groups"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <MyGroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/groups/:groupId"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <TeacherGroupDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/groups/:groupId/lessons/:lessonId"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/finance"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <FinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/transactions"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <TeacherTransactionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
