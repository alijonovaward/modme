import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAttendanceHistory, getStudentTransactions } from "../../api/endpoints";
import {
  Badge,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Pagination,
  StatTile,
  Table,
  usePagination,
} from "../../components/ui";
import type { StudentAttendanceHistoryItem, Transaction } from "../../types";
import { Layout } from "../../components/Layout";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Keldi",
  excused: "Sababli",
  unexcused: "Sababsiz",
};

export function StudentDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  const transactionsPagination = usePagination(transactions);
  const attendancePagination = usePagination(attendance);

  if (!user) return null;

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );

  return (
    <Layout>
      <ErrorMessage message={error} />
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm text-emerald-700">Joriy balans</p>
        <p className="text-2xl font-semibold text-emerald-800">
          {user.balance.toLocaleString("uz-UZ")} so'm
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="To'lovlar va yechimlar tarixi">
          {isLoading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <StatTile
                  label="Jami to'ldirilgan"
                  value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
                  color="green"
                />
                <StatTile
                  label="Jami yechilgan"
                  value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
                  color="red"
                />
              </div>
              <Table headers={["Sana", "Turi", "Summa", "Izoh"]}>
              {transactionsPagination.pageItems.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={t.type === "deposit" ? "green" : "red"}>
                      {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {t.amount.toLocaleString("uz-UZ")} so'm
                  </td>
                  <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
                </tr>
              ))}
              </Table>
              <Pagination
                page={transactionsPagination.page}
                pageCount={transactionsPagination.pageCount}
                total={transactionsPagination.total}
                onPageChange={transactionsPagination.setPage}
              />
            </>
          )}
        </Card>

        <Card title="Davomat va baholarim">
          {isLoading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : (
            <>
              <Table headers={["Sana", "Guruh", "Holat", "Baho"]}>
                {attendancePagination.pageItems.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-slate-600">{a.lesson_date}</td>
                    <td className="px-3 py-2 text-slate-600">{a.group_name}</td>
                    <td className="px-3 py-2">
                      <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"}>
                        {ATTENDANCE_LABEL[a.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{a.grade ?? "-"}</td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={attendancePagination.page}
                pageCount={attendancePagination.pageCount}
                total={attendancePagination.total}
                onPageChange={attendancePagination.setPage}
              />
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}
