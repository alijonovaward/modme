import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface BottomNavItem {
  to: string;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const BOTTOM_NAV_BY_ROLE: Record<string, BottomNavItem[]> = {
  superadmin: [
    {
      to: "/superadmin/staff",
      label: "Xodimlar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.749.728H2.25a.75.75 0 0 1-.749-.728l-.001-.122ZM13.5 19.125a5.24 5.24 0 0 0-.698-2.61 7.476 7.476 0 0 1 8.948 2.613l.001.119a.75.75 0 0 1-.749.728h-6.752a.75.75 0 0 1-.75-.75v-.1Z" />
        </svg>
      ),
    },
    {
      to: "/admin/students",
      label: "O'quvchilar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M11.7 2.805a.75.75 0 0 1 .6 0l9.435 4.718a.75.75 0 0 1 0 1.354L12.3 13.595a.75.75 0 0 1-.6 0L2.265 8.877a.75.75 0 0 1 0-1.354L11.7 2.805ZM3.816 11.66 12 15.751l8.184-4.091V14a.75.75 0 0 1-1.5 0v-1.611l-6.084 3.042a.75.75 0 0 1-.6 0L5.916 12.39v2.86a2.25 2.25 0 0 0 1.258 2.013l4.25 2.125a.75.75 0 0 0 .672 0l4.25-2.125a2.25 2.25 0 0 0 1.258-2.013V15a.75.75 0 0 1 1.5 0v.25a3.75 3.75 0 0 1-2.097 3.355l-4.25 2.125a2.25 2.25 0 0 1-2.016 0l-4.25-2.125A3.75 3.75 0 0 1 3.816 15.25v-3.59Z" />
        </svg>
      ),
    },
    {
      to: "/admin/groups",
      label: "Guruhlar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 7.5a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v.75a.75.75 0 0 1-.75.75h-19.5a.75.75 0 0 1-.75-.75V7.5Z" />
        </svg>
      ),
    },
    {
      to: "/admin/transactions",
      label: "Moliya",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 12 7.5ZM2.25 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 2.25 7.5ZM12 16.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 0 1-4.5-4.5Z" />
        </svg>
      ),
    },
  ],
  admin: [
    {
      to: "/admin/students",
      label: "O'quvchilar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M11.7 2.805a.75.75 0 0 1 .6 0l9.435 4.718a.75.75 0 0 1 0 1.354L12.3 13.595a.75.75 0 0 1-.6 0L2.265 8.877a.75.75 0 0 1 0-1.354L11.7 2.805ZM3.816 11.66 12 15.751l8.184-4.091V14a.75.75 0 0 1-1.5 0v-1.611l-6.084 3.042a.75.75 0 0 1-.6 0L5.916 12.39v2.86a2.25 2.25 0 0 0 1.258 2.013l4.25 2.125a.75.75 0 0 0 .672 0l4.25-2.125a2.25 2.25 0 0 0 1.258-2.013V15a.75.75 0 0 1 1.5 0v.25a3.75 3.75 0 0 1-2.097 3.355l-4.25 2.125a2.25 2.25 0 0 1-2.016 0l-4.25-2.125A3.75 3.75 0 0 1 3.816 15.25v-3.59Z" />
        </svg>
      ),
    },
    {
      to: "/admin/groups",
      label: "Guruhlar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 7.5a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v.75a.75.75 0 0 1-.75.75h-19.5a.75.75 0 0 1-.75-.75V7.5Z" />
        </svg>
      ),
    },
    {
      to: "/admin/lessons",
      label: "Darslar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h.75V3a.75.75 0 0 1 .75-.75ZM3.75 9v9.75a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V9H3.75Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      to: "/admin/transactions",
      label: "Moliya",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 12 7.5ZM2.25 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 2.25 7.5ZM12 16.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 0 1-4.5-4.5Z" />
        </svg>
      ),
    },
  ],
  teacher: [
    {
      to: "/teacher/groups",
      label: "Guruhlarim",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 7.5a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v.75a.75.75 0 0 1-.75.75h-19.5a.75.75 0 0 1-.75-.75V7.5Z" />
        </svg>
      ),
    },
    {
      to: "/admin/lessons",
      label: "Darslar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h.75V3a.75.75 0 0 1 .75-.75ZM3.75 9v9.75a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V9H3.75Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      to: "/teacher/finance",
      label: "Moliyam",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 12 7.5ZM2.25 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 2.25 7.5ZM12 16.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 0 1-4.5-4.5Z" />
        </svg>
      ),
    },
  ],
  student: [
    {
      to: "/admin/lessons",
      label: "Darslar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h.75V3a.75.75 0 0 1 .75-.75ZM3.75 9v9.75a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V9H3.75Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      to: "/student/transactions",
      label: "Tranzaksiyalar",
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
          <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 12 7.5ZM2.25 7.5a4.5 4.5 0 1 1 4.5 4.5A4.5 4.5 0 0 1 2.25 7.5ZM12 16.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 0 1-4.5-4.5Z" />
        </svg>
      ),
    },
  ],
};

const SUPERADMIN_MORE_ITEMS: BottomNavItem[] = [
  {
    to: "/admin/lessons",
    label: "Darslar",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h.75V3a.75.75 0 0 1 .75-.75ZM3.75 9v9.75a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V9H3.75Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/superadmin/stats",
    label: "Statistika",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
        <path d="M18.375 2.25c.966 0 1.75.784 1.75 1.75v16c0 .966-.784 1.75-1.75 1.75h-1.75a1.75 1.75 0 0 1-1.75-1.75V4c0-.966.784-1.75 1.75-1.75h1.75ZM11.125 9c.966 0 1.75.784 1.75 1.75v9.25c0 .966-.784 1.75-1.75 1.75h-1.75a1.75 1.75 0 0 1-1.75-1.75v-9.25c0-.966.784-1.75 1.75-1.75h1.75ZM3.875 14.25c.966 0 1.75.784 1.75 1.75v4c0 .966-.784 1.75-1.75 1.75h-1.75A1.75 1.75 0 0 1 .375 20v-4c0-.966.784-1.75 1.75-1.75h1.75Z" />
      </svg>
    ),
  },
  {
    to: "/superadmin/audit-log",
    label: "Harakatlar tarixi",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [showMoreModal, setShowMoreModal] = useState(false);

  if (!user) return null;

  const items = BOTTOM_NAV_BY_ROLE[user.role] ?? [];
  const isSuperadmin = user.role === "superadmin";

  const isMoreActive =
    isSuperadmin && SUPERADMIN_MORE_ITEMS.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-safe pt-2 backdrop-blur sm:hidden dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <div className={`relative ${isActive ? "scale-110" : ""}`}>
                  {item.icon(isActive)}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-tight ${isActive ? "font-bold" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Superadmin 'Ko'proq ⋯' tab */}
          {isSuperadmin && (
            <button
              onClick={() => setShowMoreModal(true)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                isMoreActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <div className={`relative ${isMoreActive ? "scale-110" : ""}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM10.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
                </svg>
                {isMoreActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </div>
              <span className={`text-[10px] font-semibold tracking-tight ${isMoreActive ? "font-bold" : ""}`}>
                Ko'proq
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Superadmin 'Ko'proq' Bottom Sheet Modal */}
      {showMoreModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:hidden">
          <div className="w-full max-w-md animate-slide-up rounded-t-3xl border-t border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Barcha bo‘limlar</h3>
              <button
                onClick={() => setShowMoreModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 py-2">
              {SUPERADMIN_MORE_ITEMS.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setShowMoreModal(false)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all active:scale-95 ${
                      isActive
                        ? "border-indigo-500 bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                        : "border-slate-200/80 bg-slate-50/50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
                      {item.icon(isActive)}
                    </div>
                    <span className="text-xs font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
