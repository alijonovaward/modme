import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

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
    { to: "/admin/lessons", label: "Darslar" },
    { to: "/admin/transactions", label: "Tranzaksiyalar" },
    { to: "/superadmin/stats", label: "Statistika" },
  ],
  admin: [
    { to: "/admin/students", label: "O'quvchilar" },
    { to: "/admin/subjects", label: "Fanlar" },
    { to: "/admin/groups", label: "Guruhlar" },
    { to: "/admin/lessons", label: "Darslar" },
    { to: "/admin/transactions", label: "Tranzaksiyalar" },
  ],
  teacher: [
    { to: "/teacher/groups", label: "Guruhlarim" },
    { to: "/teacher/attendance", label: "Davomat" },
    { to: "/teacher/finance", label: "Moliyam" },
  ],
  student: [
    { to: "/student/attendance", label: "Davomat" },
    { to: "/student/transactions", label: "Tranzaksiyalar" },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Administrator",
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">O'quv Markazi CRM</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.full_name} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {(user.role === "teacher" || user.role === "student") && (
              <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                Balans: {user.balance.toLocaleString("uz-UZ")} so'm
              </div>
            )}
            <button
              onClick={toggleTheme}
              aria-label="Tun/kun rejimini almashtirish"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm9-6a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm13.07-6.07a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0ZM7.05 16.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0ZM18.36 16.95a1 1 0 0 1 1.41 0l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41ZM7.05 7.05a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41ZM12 20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M21.64 13a9 9 0 1 1-10.63-10.63 1 1 0 0 1 1.11 1.44A7 7 0 0 0 20.2 11.89a1 1 0 0 1 1.44 1.11Z" />
                </svg>
              )}
            </button>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
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
