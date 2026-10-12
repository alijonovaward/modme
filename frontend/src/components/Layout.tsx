import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  superadmin: [
    { to: "/superadmin/staff", label: "Xodimlar" },
    { to: "/admin/students", label: "O'quvchilar" },
    { to: "/admin/subjects", label: "Fanlar" },
    { to: "/admin/groups", label: "Guruhlar" },
  ],
  admin: [
    { to: "/admin/students", label: "O'quvchilar" },
    { to: "/admin/subjects", label: "Fanlar" },
    { to: "/admin/groups", label: "Guruhlar" },
  ],
  teacher: [
    { to: "/teacher/groups", label: "Guruhlarim" },
    { to: "/teacher/finance", label: "Moliyam" },
  ],
  student: [{ to: "/student", label: "Kabinetim" }],
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Administrator",
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">O'quv Markazi CRM</p>
            <p className="text-sm text-slate-500">
              {user.full_name} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {(user.role === "teacher" || user.role === "student") && (
              <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                Balans: {user.balance.toLocaleString("uz-UZ")} so'm
              </div>
            )}
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Chiqish
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
