import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  depositToStudent,
  getStudentAttendanceHistory,
  getStudentGroups,
  getStudentPendingCharges,
  listStudents,
  updateStudent,
  updateStudentStatus,
  updateUserPassword,
  withdrawFromStudent,
} from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  MobileList,
  MobileListRow,
  Modal,
  Pagination,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type {
  StudentAttendanceHistoryItem,
  StudentGroupStats,
  StudentPendingCharge,
  User,
} from "../../types";
import { Layout } from "../../components/Layout";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
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
  const navigate = useNavigate();
  const id = Number(studentId);

  const [student, setStudent] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<StudentAttendanceHistoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroupStats[]>([]);
  const [pendingCharges, setPendingCharges] = useState<StudentPendingCharge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositComment, setDepositComment] = useState("");
  const depositIdempotencyKey = useIdempotencyKey();
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawComment, setWithdrawComment] = useState("");
  const withdrawIdempotencyKey = useIdempotencyKey();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleActiveConfirmOpen, setIsToggleActiveConfirmOpen] = useState(false);

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
      await depositToStudent(
        id,
        amount,
        depositComment || undefined,
        depositIdempotencyKey.get(),
      );
      depositIdempotencyKey.renew();
      setSuccess("Balans to'ldirildi");
      setDepositAmount("");
      setDepositComment("");
      setIsDepositModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || isSubmitting) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await withdrawFromStudent(
        id,
        amount,
        withdrawComment || undefined,
        withdrawIdempotencyKey.get(),
      );
      withdrawIdempotencyKey.renew();
      setSuccess("Pul qaytarib berildi");
      setWithdrawAmount("");
      setWithdrawComment("");
      setIsWithdrawModalOpen(false);
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
      if (newPassword.trim()) {
        await updateUserPassword(id, newPassword.trim());
      }
      setSuccess(newPassword.trim() ? "Ma'lumotlar va parol saqlandi" : "Ma'lumotlar saqlandi");
      setNewPassword("");
      setIsEditModalOpen(false);
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
      setIsToggleActiveConfirmOpen(false);
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

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

  const displayBalance = student.balance;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              {student.full_name}
            </h1>
            <button
              onClick={() => {
                setNewPassword("");
                setIsEditModalOpen(true);
              }}
              aria-label="Tahrirlash"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125 16.862 4.487" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!student.is_active && <Badge color="red">Bloklangan</Badge>}
            <Badge color={student.telegram_linked ? "green" : "slate"}>
              Telegram: {student.telegram_linked ? "Ulangan" : "Ulanmagan"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{student.phone}</p>
          <div className="mt-1.5 flex items-center gap-2.5 text-base text-slate-600 dark:text-slate-400">
            <span>
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
            </span>
            <button
              onClick={() => setIsDepositModalOpen(true)}
              aria-label="Balansni to'ldirish"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              aria-label="Pul qaytarish"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition-colors hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
                <path strokeLinecap="round" d="M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="mt-6">
        <Card title="Fanlar va guruhlar">
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O'quvchi hali hech qanday guruhga yozilmagan.
            </p>
          ) : (
            <>
            <div className="hidden sm:block">
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
            </div>

            <MobileList>
              {groups.map((g) => (
                <MobileListRow key={g.group_id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {g.subject_name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {g.group_name} · {g.teacher_name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Davomat: {g.attendance_rate}%
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge color={GROUP_STATUS_COLOR[g.status]}>{GROUP_STATUS_LABEL[g.status]}</Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {g.total_spent.toLocaleString("uz-UZ")} so'm
                    </p>
                  </div>
                </MobileListRow>
              ))}
            </MobileList>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Tranzaksiyalar tarixi"
          action={
            <div className="flex flex-wrap gap-2">
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
              <Button onClick={() => navigate("/admin/transactions", { state: { studentId: id } })}>
                To'liq tarixni ko'rish
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ushbu o'quvchining barcha to'lov va yechimlari (kim tomonidan kiritilgan/yechilganidan qat'i
            nazar) umumiy Tranzaksiyalar sahifasida, shu o'quvchi bo'yicha filtrlangan holda ko'rinadi.
          </p>
        </Card>
      </div>

      {pendingCharges.length > 0 && (
        <div className="mt-6">
          <Card title="Kutilayotgan qarzlar">
            <div className="hidden sm:block">
              <Table headers={["Sana", "Guruh", "O'qituvchi", "Qolgan summa"]}>
                {pendingCharges.map((p) => {
                  const orig = p.original_amount || p.amount;
                  const paid = Math.max(0, orig - p.amount);
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{p.lesson_date}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{p.group_name}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{p.teacher_name}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {p.amount.toLocaleString("uz-UZ")} so'm
                        </span>
                        {paid > 0 && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {orig.toLocaleString("uz-UZ")} so'mdan {paid.toLocaleString("uz-UZ")} to'langan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </div>

            <MobileList>
              {pendingCharges.map((p) => {
                const orig = p.original_amount || p.amount;
                const paid = Math.max(0, orig - p.amount);
                return (
                  <MobileListRow key={p.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {p.group_name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {p.teacher_name} · {p.lesson_date}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {p.amount.toLocaleString("uz-UZ")} so'm
                      </span>
                      {paid > 0 && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {orig.toLocaleString("uz-UZ")} so'mdan {paid.toLocaleString("uz-UZ")} to'langan
                        </span>
                      )}
                    </div>
                  </MobileListRow>
                );
              })}
            </MobileList>
          </Card>
        </div>
      )}

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
          <div className="hidden sm:block">
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
          </div>

          <MobileList>
            {attendancePageItems.map((a) => (
              <MobileListRow key={a.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {a.group_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {a.teacher_name} · {a.lesson_date}
                  </p>
                  {a.total_count != null && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Test: {a.correct_count}/{a.total_count}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"}>
                    {ATTENDANCE_LABEL[a.status]}
                  </Badge>
                  {a.is_trial && <Badge color="amber">Sinov</Badge>}
                </div>
              </MobileListRow>
            ))}
          </MobileList>

          <Pagination
            page={attendancePage}
            pageCount={attendancePageCount}
            total={attendanceTotal}
            onPageChange={setAttendancePage}
          />
        </Card>
      </div>

      {isDepositModalOpen && (
        <Modal title="Balansni to'ldirish" onClose={() => setIsDepositModalOpen(false)}>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              To'ldirish
            </Button>
          </form>
        </Modal>
      )}

      {isWithdrawModalOpen && (
        <Modal title="Pulni qaytarib berish" onClose={() => setIsWithdrawModalOpen(false)}>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            O'quvchi ortiqcha to'lagan yoki guruhni tark etayotgan bo'lsa, balansidan naqd pul
            qaytarib berilganini shu yerda qayd eting. Joriy balans:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {student.balance.toLocaleString("uz-UZ")} so'm
            </span>
          </p>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <Label>Summa</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                max={student.balance > 0 ? student.balance : 0}
                required
              />
            </div>
            <div>
              <Label>Izoh (ixtiyoriy)</Label>
              <Input value={withdrawComment} onChange={(e) => setWithdrawComment(e.target.value)} />
            </div>
            <Button type="submit" variant="danger" className="w-full" disabled={isSubmitting}>
              Qaytarib berish
            </Button>
          </form>
        </Modal>
      )}

      {isEditModalOpen && (
        <Modal title="Ma'lumotlarni tahrirlash" onClose={() => setIsEditModalOpen(false)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>F.I.O</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required />
            </div>
            <div>
              <Label>Yangi parol (ixtiyoriy)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Bo'sh qoldirilsa, parol eskiligicha qoladi.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Saqlash
            </Button>
          </form>

          <div className="my-5 border-t border-slate-100 dark:border-slate-800" />

          <Button
            variant={student.is_active ? "danger" : "secondary"}
            className="w-full"
            onClick={() => setIsToggleActiveConfirmOpen(true)}
          >
            {student.is_active ? "Bloklash" : "Faollashtirish"}
          </Button>
        </Modal>
      )}

      <ConfirmModal
        isOpen={isToggleActiveConfirmOpen}
        title={student.is_active ? "Bloklashni tasdiqlang" : "Faollashtirishni tasdiqlang"}
        message={
          student.is_active
            ? `${student.full_name} bloklansinmi? Uning barcha faol guruh a'zoliklari avtomatik muzlatiladi.`
            : `${student.full_name} faollashtirilsinmi?`
        }
        confirmLabel={student.is_active ? "Ha, bloklash" : "Ha, faollashtirish"}
        variant="danger"
        onConfirm={handleToggleActive}
        onClose={() => setIsToggleActiveConfirmOpen(false)}
      />
    </Layout>
  );
}
