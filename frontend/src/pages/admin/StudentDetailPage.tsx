import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  depositToStudent,
  getStudentAttendanceHistory,
  getStudentTransactions,
  listStudents,
  updateUserPassword,
} from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Pagination,
  StatTile,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { StudentAttendanceHistoryItem, StudentTransactionListItem, User } from "../../types";
import { Layout } from "../../components/Layout";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Keldi",
  excused: "Sababli",
  unexcused: "Sababsiz",
};

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const id = Number(studentId);

  const [student, setStudent] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<StudentTransactionListItem[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositComment, setDepositComment] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const students = await listStudents();
      setStudent(students.find((s) => s.id === id) ?? null);
      setTransactions(await getStudentTransactions(id));
      setAttendance(await getStudentAttendanceHistory(id));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await depositToStudent(id, amount, depositComment || undefined);
      setSuccess("Balans to'ldirildi");
      setDepositAmount("");
      setDepositComment("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await updateUserPassword(id, newPassword);
      setSuccess("Parol muvaffaqiyatli yangilandi");
      setNewPassword("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );

  const {
    page: transactionsPage,
    setPage: setTransactionsPage,
    pageCount: transactionsPageCount,
    pageItems: transactionsPageItems,
    total: transactionsTotal,
  } = usePagination(transactions);
  const {
    page: attendancePage,
    setPage: setAttendancePage,
    pageCount: attendancePageCount,
    pageItems: attendancePageItems,
    total: attendanceTotal,
  } = usePagination(attendance);

  if (isLoading || !student) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{student.full_name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{student.phone}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Balans: <span className="font-semibold">{student.balance.toLocaleString("uz-UZ")} so'm</span>
        </p>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Balansni to'ldirish">
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <Label>Summa</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Izoh (ixtiyoriy)</Label>
              <Input value={depositComment} onChange={(e) => setDepositComment(e.target.value)} />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              To'ldirish
            </Button>
          </form>
        </Card>

        <Card title="Parolni yangilash">
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <Label>Yangi parol</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              Saqlash
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="To'lovlar va yechimlar tarixi">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Table headers={["Sana", "Turi", "Guruh", "O'qituvchi", "Summa", "Izoh"]}>
            {transactionsPageItems.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.teacher_name ?? "-"}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={transactionsPage}
            pageCount={transactionsPageCount}
            total={transactionsTotal}
            onPageChange={setTransactionsPage}
          />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Davomat va baholar tarixi">
          <Table headers={["Sana", "Guruh", "O'qituvchi", "Holat", "Baho"]}>
            {attendancePageItems.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.lesson_date}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.group_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.teacher_name}</td>
                <td className="px-3 py-2">
                  <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"}>
                    {ATTENDANCE_LABEL[a.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{a.grade ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={attendancePage}
            pageCount={attendancePageCount}
            total={attendanceTotal}
            onPageChange={setAttendancePage}
          />
        </Card>
      </div>
    </Layout>
  );
}
