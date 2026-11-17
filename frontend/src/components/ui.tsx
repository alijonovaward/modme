import { useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-6 dark:border-slate-800/80 dark:bg-slate-950">
      {(title || action) && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:mb-5 sm:gap-3">
          {title && <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-slate-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:disabled:bg-indigo-950",
    secondary:
      "border border-slate-300/80 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
  }[variant];
  return (
    <button
      className={`inline-flex select-none items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-300/80 bg-white px-3.5 py-2 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full select-none rounded-xl border border-slate-300/80 bg-white px-3.5 py-2 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 ${className}`}
      {...props}
    />
  );
}

export interface ComboboxOption {
  value: string;
  label: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, searchQuery]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full select-none items-center justify-between rounded-xl border border-slate-300/80 bg-white px-3.5 py-2 text-left text-sm text-slate-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
      >
        <span className={selectedOption ? "font-medium text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>
          {selectedOption ? selectedOption.label : (placeholder ?? "Tanlang...")}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg dark:border-slate-700/80 dark:bg-slate-900">
          {options.length > 2 && (
            <div className="p-1 border-b border-slate-100 dark:border-slate-800">
              <input
                type="text"
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          )}
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 select-none">Topilmadi</p>
            ) : (
              filteredOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`block w-full select-none rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 ${
                    o.value === value
                      ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block select-none text-xs font-semibold text-slate-700 dark:text-slate-300">{children}</label>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  const hasEmptyLastHeader = headers.length > 0 && headers[headers.length - 1] === "";

  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
            {headers.map((h, i) => {
              const isLast = i === headers.length - 1;
              const isEmptyHeader = h === "";
              return (
                <th
                  key={i}
                  className={`px-2.5 py-2 font-semibold sm:px-3.5 sm:py-3 ${
                    isEmptyHeader ? "w-px whitespace-nowrap" : ""
                  } ${
                    isLast && hasEmptyLastHeader
                      ? "sticky right-0 z-20 bg-slate-50/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-900/95 dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)]"
                      : ""
                  }`}
                >
                  {h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">{children}</tbody>
      </table>
    </div>
  );
}

export function TdAction({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={`sticky right-0 z-10 bg-white px-2.5 py-2 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] transition-colors group-hover:bg-slate-50 sm:px-3.5 sm:py-2.5 dark:bg-slate-950 dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] dark:group-hover:bg-slate-900 ${className}`}
    >
      {children}
    </td>
  );
}

export const PAGE_SIZE = 10;

export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  return { page: safePage, setPage, pageCount, pageItems, total: items.length };
}

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const pageNumbers = (() => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const nums = new Set([1, pageCount, page - 1, page, page + 1]);
    return Array.from(nums)
      .filter((n) => n >= 1 && n <= pageCount)
      .sort((a, b) => a - b);
  })();

  return (
    <div className="mt-6 flex flex-col items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Oldingi sahifa"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ‹
        </button>
        {pageNumbers.map((n, i) => {
          const prev = pageNumbers[i - 1];
          const showGap = prev !== undefined && n - prev > 1;
          return (
            <span key={n} className="flex items-center">
              {showGap && <span className="px-1 text-slate-300 dark:text-slate-600">…</span>}
              <button
                onClick={() => onPageChange(n)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-xl px-2.5 text-xs font-semibold transition-all active:scale-95 ${
                  n === page
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {n}
              </button>
            </span>
          );
        })}
        <button
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Keyingi sahifa"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ›
        </button>
      </div>
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Jami: {total} ta</span>
    </div>
  );
}

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "green" | "red" | "amber" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60",
  }[color];
  return <span className={`inline-flex select-none items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "amber" | "indigo" | "slate" | "violet";
}) {
  const styles = {
    green: "bg-emerald-50/70 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/80",
    red: "bg-rose-50/70 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/80",
    amber: "bg-amber-50/70 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/80",
    indigo: "bg-indigo-50/70 text-indigo-800 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/80",
    slate: "bg-slate-50/70 text-slate-800 border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700/80",
    violet: "bg-violet-50/70 text-violet-800 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/80",
  }[color];
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm transition-all hover:-translate-y-0.5 sm:p-6 ${styles}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 sm:text-xs">{label}</p>
      <p className="mt-1 break-words text-lg font-bold tracking-tight sm:text-3xl">{value}</p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4 dark:bg-slate-950/80">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Yopish"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-rose-200/60 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400">
      {message}
    </div>
  );
}

export function SuccessMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
      {message}
    </div>
  );
}

export function extractErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
    return (detail[0].msg as string).replace(/^Value error,\s*/, "");
  }

  return "Nimadir xato ketdi";
}
