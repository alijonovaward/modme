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
  const [newPassword, setNewPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="max-w-md">
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
            onClick={handleToggleActive}
          >
            {student.is_active ? "Bloklash" : "Faollashtirish"}
          </Button>
        </Modal>
      )}
    </Layout>
  );
}
