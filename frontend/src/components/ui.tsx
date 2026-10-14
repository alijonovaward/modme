import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  }[variant];
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "green" | "red" | "amber" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
  }[color];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "amber" | "indigo";
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[color];
  return (
    <div className={`rounded-xl border border-slate-200 p-5 ${styles}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{message}</div>
  );
}

export function SuccessMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</div>
  );
}

export function extractErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === "string"
  ) {
    return (error as { response: { data: { detail: string } } }).response.data.detail;
  }
  return "Nimadir xato ketdi";
}
