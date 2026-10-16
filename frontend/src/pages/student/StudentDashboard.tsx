import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAttendanceHistory, getStudentTransactions } from "../../api/endpoints";
import {
  Badge,
  Card,
  ErrorMessage,
  extractErrorMessage,
  StatTile,
  Table,
} from "../../components/ui";
import type { StudentAttendanceHistoryItem, StudentTransactionListItem } from "../../types";
import { Layout } from "../../components/Layout";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Keldi",
  excused: "Sababli",
  unexcused: "Sababsiz",
};

export function StudentDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<StudentTransactionListItem[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getStudentTransactions(user.id), getStudentAttendanceHistory(user.id)])
      .then(([tx, att]) => {
        setTransactions(tx);
        setAttendance(att);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [user]);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    attendance.forEach((a) => seen.set(a.group_name, a.teacher_name));
    transactions.forEach((t) => {
      if (t.group_name && t.teacher_name) seen.set(t.group_name, t.teacher_name);
    });
    return Array.from(seen.entries());
  }, [attendance, transactions]);

  const attendanceSummary = useMemo(
    () => ({
      present: attendance.filter((a) => a.status === "present").length,
      excused: attendance.filter((a) => a.status === "excused").length,
      unexcused: attendance.filter((a) => a.status === "unexcused").length,
    }),
    [attendance],
  );

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );

  if (!user) return null;

  return (
    <Layout>
      <ErrorMessage message={error} />

      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Joriy balans</p>
        <p className="text-2xl font-semibold text-emerald-800 dark:text-emerald-300">
          {user.balance.toLocaleString("uz-UZ")} so'm
        </p>
      </div>

      {!isLoading && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatTile label="Keldi" value={String(attendanceSummary.present)} color="green" />
            <StatTile label="Sababli" value={String(attendanceSummary.excused)} color="indigo" />
            <StatTile label="Sababsiz" value={String(attendanceSummary.unexcused)} color="red" />
            <StatTile
              label="Jami to'ldirilgan"
              value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
              color="slate"
            />
            <StatTile
              label="Jami yechilgan"
              value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
              color="amber"
            />
          </div>

          {groups.length > 0 && (
            <div className="mb-6">
              <Card title="Guruhlarim">
                <div className="flex flex-wrap gap-2">
                  {groups.map(([groupName, teacherName]) => (
                    <Badge key={groupName} color="slate">
                      {groupName} · {teacherName}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title="So'nggi tranzaksiyalar"
              action={
                <Link to="/student/transactions" className="text-sm text-indigo-600 hover:underline">
                  Barchasi
                </Link>
              }
            >
              <Table headers={["Sana", "Turi", "Summa"]}>
                {transactions.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={t.type === "deposit" ? "green" : "red"}>
                        {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {t.amount.toLocaleString("uz-UZ")} so'm
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>

            <Card
              title="So'nggi davomat"
              action={
                <Link to="/student/attendance" className="text-sm text-indigo-600 hover:underline">
                  Barchasi
                </Link>
              }
            >
              <Table headers={["Sana", "Guruh", "Holat", "Baho"]}>
                {attendance.slice(0, 5).map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.lesson_date}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.group_name}</td>
                    <td className="px-3 py-2">
                      <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"}>
                        {ATTENDANCE_LABEL[a.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{a.grade ?? "-"}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        </>
      )}
    </Layout>
  );
}
