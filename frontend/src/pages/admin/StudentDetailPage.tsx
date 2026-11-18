import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  depositToStudent,
  getStudentAttendanceHistory,
  getStudentGroups,
  getStudentPendingCharges,
  getStudentTransactions,
  listStudents,
  updateStudent,
  updateStudentStatus,
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
  Modal,
  Pagination,
  StatTile,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type {
  StudentAttendanceHistoryItem,
  StudentGroupStats,
  StudentPendingCharge,
  StudentTransactionListItem,
  TransactionType,
  User,
} from "../../types";
import { Layout } from "../../components/Layout";
import { downloadXlsx } from "../../utils/download";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Keldi",
  excused: "Sababli",
  unexcused: "Sababsiz",
};

const GROUP_STATUS_LABEL: Record<string, string> = {
  active: "Faol",
  frozen: "Muzlatilgan",
  dropped: "Chetlatilgan",
};

const GROUP_STATUS_COLOR: Record<string, "green" | "amber" | "red"> = {
  active: "green",
  frozen: "amber",
  dropped: "red",
};

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const id = Number(studentId);

  const [student, setStudent] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<StudentTransactionListItem[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceHistoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroupStats[]>([]);
  const [pendingCharges, setPendingCharges] = useState<StudentPendingCharge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositComment, setDepositComment] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const students = await listStudents();
      const found = students.find((s) => s.id === id) ?? null;
      setStudent(found);
      if (found) {
        setEditFullName(found.full_name);
        setEditPhone(found.phone);
      }
      setTransactions(await getStudentTransactions(id));
      setAttendance(await getStudentAttendanceHistory(id));
      setGroups(await getStudentGroups(id));
      setPendingCharges(await getStudentPendingCharges(id));
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
    if (!amount || amount <= 0 || isSubmitting) return;
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

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await updateStudent(id, { full_name: editFullName, phone: editPhone });
      setSuccess("Ma'lumotlar saqlandi");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!student) return;
    setError(null);
    setSuccess(null);
    try {
      await updateStudentStatus(id, !student.is_active);
      setSuccess(student.is_active ? "O'quvchi bloklandi" : "O'quvchi faollashtirildi");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
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

  const [txFilterTab, setTxFilterTab] = useState<"all" | "deposit" | "deduction" | "pending_charge">("all");

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );
  const totalRemaining = totalDeposits - totalDeductions;

  const mappedPendingTransactions: StudentTransactionListItem[] = useMemo(() => {
    return pendingCharges.map((p) => {
      const orig = p.original_amount || p.amount;
      const rem = p.amount;
      const paid = Math.max(0, orig - rem);

      return {
        id: -p.id,
        amount: -p.amount,
        type: "pending_charge" as TransactionType,
        comment:
          paid > 0
            ? `Kutilayotgan qarz dars puli (${orig.toLocaleString("uz-UZ")} so'mdan ${paid.toLocaleString("uz-UZ")} so'm to'langan, ${rem.toLocaleString("uz-UZ")} so'm qolgan)`
            : "Kutilayotgan qarz dars puli",
        created_at: p.created_at,
        group_id: null,
        group_name: p.group_name,
        teacher_name: p.teacher_name,
        lesson_date: p.lesson_date,
      };
    });
  }, [pendingCharges]);

  const allUnifiedTransactions = useMemo<StudentTransactionListItem[]>(() => {
    const combined = [...transactions, ...mappedPendingTransactions];
    return combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [transactions, mappedPendingTransactions]);

  const filteredTransactions = useMemo<StudentTransactionListItem[]>(() => {
    if (txFilterTab === "all") return allUnifiedTransactions;
    return allUnifiedTransactions.filter((t: StudentTransactionListItem) => t.type === txFilterTab);
  }, [allUnifiedTransactions, txFilterTab]);

  const [selectedTx, setSelectedTx] = useState<StudentTransactionListItem | null>(null);
  const {
    page: transactionsPage,
    setPage: setTransactionsPage,
    pageCount: transactionsPageCount,
    pageItems: transactionsPageItems,
    total: transactionsTotal,
  } = usePagination<StudentTransactionListItem>(filteredTransactions);
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

  const displayBalance = student ? (student.balance !== 0 ? student.balance : totalRemaining) : 0;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
            {student.full_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!student.is_active && <Badge color="red">Bloklangan</Badge>}
            <Badge color={student.telegram_linked ? "green" : "slate"}>
              Telegram: {student.telegram_linked ? "Ulangan" : "Ulanmagan"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{student.phone}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Balans:{" "}
            <span
              className={`font-semibold ${
                displayBalance < 0
                  ? "font-bold text-rose-600 dark:text-rose-400"
                  : "text-slate-800 dark:text-slate-200"
              }`}
            >
              {displayBalance.toLocaleString("uz-UZ")} so'm
            </span>
          </p>
        </div>
        <div className="shrink-0">
          <Button variant={student.is_active ? "danger" : "secondary"} onClick={handleToggleActive}>
            {student.is_active ? "Bloklash" : "Faollashtirish"}
          </Button>
        </div>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Ma'lumotlarni tahrirlash">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>F.I.O</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              Saqlash
            </Button>
          </form>
        </Card>

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
        <Card title="Fanlar va guruhlar">
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O'quvchi hali hech qanday guruhga yozilmagan.
            </p>
          ) : (
            <Table headers={["Fan", "Guruh", "O'qituvchi", "Holat", "Davomat foizi", "Sarflangan summa"]}>
              {groups.map((g) => (
                <tr key={g.group_id}>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{g.subject_name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.group_name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.teacher_name}</td>
                  <td className="px-3 py-2">
                    <Badge color={GROUP_STATUS_COLOR[g.status]}>{GROUP_STATUS_LABEL[g.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.attendance_rate}%</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                    {g.total_spent.toLocaleString("uz-UZ")} so'm
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="To'lovlar va yechimlar tarixi"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadXlsx(
                  `/api/v1/students/${id}/transactions/export`,
                  undefined,
                  `${student.full_name}_tranzaksiyalari.xlsx`,
                )
              }
            >
              Excel'ga chiqarish
            </Button>
          }
        >
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Jami to'ldirilgan"
              value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
              color="green"
            />
            <StatTile
              label="Jami qolgan"
              value={`${totalRemaining.toLocaleString("uz-UZ")} so'm`}
              color="indigo"
            />
            <StatTile
              label="Jami yechilgan"
              value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
              color="red"
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5 select-none">
            <button
              type="button"
              onClick={() => {
                setTxFilterTab("all");
                setTransactionsPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                txFilterTab === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Barchasi ({allUnifiedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTxFilterTab("deposit");
                setTransactionsPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                txFilterTab === "deposit"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              To'lovlar ({transactions.filter((t) => t.type === "deposit").length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTxFilterTab("deduction");
                setTransactionsPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                txFilterTab === "deduction"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Yechimlar ({transactions.filter((t) => t.type === "deduction").length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTxFilterTab("pending_charge");
                setTransactionsPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                txFilterTab === "pending_charge"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
              }`}
            >
              Kutilayotgan qarzlar ({pendingCharges.length})
            </button>
          </div>

          <Table headers={["Sana", "Turi", "Guruh", "Summa", "Izoh"]}>
            {transactionsPageItems.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelectedTx(t)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {t.lesson_date || new Date(t.created_at).toLocaleDateString("uz-UZ")}
                </td>
                <td className="px-2.5 py-2.5">
                  <Badge
                    color={
                      t.type === "deposit"
                        ? "green"
                        : t.type === "pending_charge"
                          ? "amber"
                          : "red"
                    }
                  >
                    {t.type === "deposit"
                      ? "To'ldirish"
                      : t.type === "pending_charge"
                        ? "Kutilayotgan qarz"
                        : "Yechim"}
                  </Badge>
                </td>
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-2.5 py-2.5 font-semibold">
                  <span
                    className={
                      t.type === "deposit"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : t.type === "pending_charge"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-800 dark:text-slate-200"
                    }
                  >
                    {t.amount > 0 ? `+${t.amount.toLocaleString("uz-UZ")}` : `${t.amount.toLocaleString("uz-UZ")}`} so'm
                  </span>
                </td>
                <td className="px-2.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">{t.comment ?? "-"}</td>
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
        <Card
          title="Davomat va baholar tarixi"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadXlsx(
                  `/api/v1/students/${id}/attendance/export`,
                  undefined,
                  `${student.full_name}_davomati.xlsx`,
                )
              }
            >
              Excel'ga chiqarish
            </Button>
          }
        >
          <Table headers={["Sana", "Guruh", "O'qituvchi", "Holat", "Test natijasi"]}>
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
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <span>{a.total_count != null ? `${a.correct_count}/${a.total_count}` : "-"}</span>
                    {a.is_trial && <Badge color="amber">Sinov</Badge>}
                  </div>
                </td>
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

      {selectedTx && (
        <Modal title="Tranzaksiya tafsilotlari" onClose={() => setSelectedTx(null)}>
          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Turi:</span>
              <Badge color={selectedTx.type === "deposit" ? "green" : "red"}>
                {selectedTx.type === "deposit" ? "To'ldirish" : "Yechim"}
              </Badge>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Summa:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {selectedTx.amount.toLocaleString("uz-UZ")} so'm
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Guruh:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTx.group_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">O'qituvchi:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTx.teacher_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Sana va vaqt:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {new Date(selectedTx.created_at).toLocaleString("uz-UZ")}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 mb-1 dark:text-slate-400">To'liq izoh:</span>
              <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {selectedTx.comment || "Izoh mavjud emas"}
              </p>
            </div>
            <Button className="w-full mt-2" onClick={() => setSelectedTx(null)}>
              Yopish
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
