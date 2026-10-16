import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const HOME_BY_ROLE: Record<string, string> = {
  superadmin: "/superadmin/staff",
  admin: "/admin/students",
  teacher: "/teacher/groups",
  student: "/student/transactions",
};

export function HomePage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] ?? "/login"} replace />;
}
