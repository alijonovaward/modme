import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { InstallPWA } from "./InstallPWA";
import { BottomNav } from "./BottomNav";

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  superadmin: [
    { to: "/superadmin/staff", label: "Xodimlar" },
    { to: "/admin/students", label: "O'quvchilar" },
    { to: "/admin/groups", label: "Guruhlar" },
    { to: "/admin/lessons", label: "Darslar" },
    { to: "/admin/transactions", label: "Tranzaksiyalar" },
    { to: "/superadmin/stats", label: "Statistika" },
    { to: "/superadmin/audit-log", label: "Harakatlar tarixi" },
  ],
  admin: [
    { to: "/admin/students", label: "O'quvchilar" },
    { to: "/admin/groups", label: "Guruhlar" },
    { to: "/admin/lessons", label: "Darslar" },
    { to: "/admin/transactions", label: "Tranzaksiyalar" },
  ],
  teacher: [
    { to: "/teacher/groups", label: "Guruhlarim" },
    { to: "/admin/lessons", label: "Darslar" },
    { to: "/teacher/finance", label: "Moliyam" },
  ],
  student: [
    { to: "/admin/lessons", label: "Darslar" },
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

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Nova" className="h-8 w-8 shrink-0 rounded-lg" />
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                NOVA
              </p>
              <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">O'quv Markazi CRM</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {user.full_name} · {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-4">
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="Menyu"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition-all hover:bg-slate-100 active:scale-95 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 z-40 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg dark:border-slate-700/80 dark:bg-slate-900">
                  <button
                    onClick={() => {
                      toggleTheme();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {theme === "dark" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm9-6a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm13.07-6.07a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0ZM7.05 16.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0ZM18.36 16.95a1 1 0 0 1 1.41 0l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41ZM7.05 7.05a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41ZM12 20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path d="M21.64 13a9 9 0 1 1-10.63-10.63 1 1 0 0 1 1.11 1.44A7 7 0 0 0 20.2 11.89a1 1 0 0 1 1.44 1.11Z" />
                      </svg>
                    )}
                    {theme === "dark" ? "Kun rejimi" : "Tun rejimi"}
                  </button>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m6 4 4 4-4 4m4-4H9" />
                    </svg>
                    Chiqish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden relative border-t border-slate-100 sm:block dark:border-slate-800/60">
          {/* Gradient fade indicators for horizontal tab scrolling */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white via-white/80 to-transparent sm:hidden dark:from-slate-950 dark:via-slate-950/80 dark:to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white via-white/80 to-transparent sm:hidden dark:from-slate-950 dark:via-slate-950/80 dark:to-transparent" />
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 scroll-smooth sm:px-6">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-2 py-3 pb-24 sm:px-6 sm:py-8 sm:pb-8">{children}</main>
      <InstallPWA />
      <BottomNav />
    </div>
  );
}
