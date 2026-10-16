import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ThemeProvider } from "./theme/ThemeContext";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { StaffPage } from "./pages/superadmin/StaffPage";
import { StaffDetailPage } from "./pages/superadmin/StaffDetailPage";
import { StatsPage } from "./pages/superadmin/StatsPage";
import { StudentsPage } from "./pages/admin/StudentsPage";
import { StudentDetailPage } from "./pages/admin/StudentDetailPage";
import { SubjectsPage } from "./pages/admin/SubjectsPage";
import { GroupsPage } from "./pages/admin/GroupsPage";
import { GroupDetailPage } from "./pages/admin/GroupDetailPage";
import { LessonsPage } from "./pages/admin/LessonsPage";
import { TransactionsPage } from "./pages/admin/TransactionsPage";
import { MyGroupsPage } from "./pages/teacher/MyGroupsPage";
import { TeacherGroupDetailPage } from "./pages/teacher/GroupDetailPage";
import { AttendancePage } from "./pages/teacher/AttendancePage";
import { AttendanceHubPage } from "./pages/teacher/AttendanceHubPage";
import { FinancePage } from "./pages/teacher/FinancePage";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentTransactionsPage } from "./pages/student/TransactionsPage";
import { StudentAttendancePage } from "./pages/student/AttendancePage";

function App() {
  return (
    <ThemeProvider>
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
            path="/superadmin/staff/:userId"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <StaffDetailPage />
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
            path="/admin/students/:studentId"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <StudentDetailPage />
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
            path="/admin/lessons"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <LessonsPage />
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
            path="/teacher/attendance"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <AttendanceHubPage />
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
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/transactions"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentTransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentAttendancePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
