import { useEffect, useState } from "react";
import { listAuditLogs } from "../../api/endpoints";
import {
  Card,
  ErrorMessage,
  extractErrorMessage,
  MobileList,
  MobileListRow,
  PAGE_SIZE,
  Pagination,
  Table,
} from "../../components/ui";
import type { AuditLogItem } from "../../types";
import { Layout } from "../../components/Layout";

const ACTION_LABELS: Record<string, string> = {
  "student.blocked": "O'quvchi bloklandi",
  "student.unblocked": "O'quvchi faollashtirildi",
  "student.deleted": "O'quvchi o'chirildi",
  "student.restored": "O'quvchi tiklandi",
  "staff.blocked": "Xodim bloklandi",
  "staff.unblocked": "Xodim faollashtirildi",
  "staff.deleted": "Xodim o'chirildi",
  "staff.restored": "Xodim tiklandi",
  "user.password_changed": "Parol o'zgartirildi",
  "teacher.percentage_changed": "O'qituvchi foizi o'zgartirildi",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  student: "O'quvchi",
  staff: "Xodim",
  user: "Foydalanuvchi",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDetails(log: AuditLogItem): string | null {
  if (!log.details) return null;
  try {
    const parsed = JSON.parse(log.details) as Record<string, unknown>;
    if (log.action === "teacher.percentage_changed" && "old" in parsed && "new" in parsed) {
      return `${parsed.old ?? "—"}% → ${parsed.new ?? "—"}%`;
    }
    return JSON.stringify(parsed);
  } catch {
    return log.details;
  }
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (pageArg: number) => {
    setIsLoading(true);
    try {
      const data = await listAuditLogs({ page: pageArg, page_size: PAGE_SIZE });
      setLogs(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Layout>
      <Card title="Harakatlar tarixi">
        <ErrorMessage message={error} />
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Hali hech qanday harakat yozilmagan.</p>
        ) : (
          <>
          <div className="hidden sm:block">
            <Table headers={["Sana", "Kim", "Amal", "Nishon", "Tafsilot"]}>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                    {log.actor_name ?? "Noma'lum"}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {TARGET_TYPE_LABELS[log.target_type] ?? log.target_type} #{log.target_id}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {formatDetails(log) ?? "—"}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <MobileList>
            {logs.map((log) => (
              <MobileListRow key={log.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {log.actor_name ?? "Noma'lum"} ·{" "}
                    {TARGET_TYPE_LABELS[log.target_type] ?? log.target_type} #{log.target_id}
                    {formatDetails(log) ? ` · ${formatDetails(log)}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {formatDateTime(log.created_at)}
                </p>
              </MobileListRow>
            ))}
          </MobileList>

          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={load} />
          </>
        )}
      </Card>
    </Layout>
  );
}
