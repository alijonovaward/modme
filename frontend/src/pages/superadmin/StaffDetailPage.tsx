import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  getTeacherFinanceById,
  listStaffUsers,
  payoutTeacher,
  updateStaffStatus,
  updateStaffUser,
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
import type { TeacherTransaction, User } from "../../types";
import { Layout } from "../../components/Layout";
import { downloadXlsx } from "../../utils/download";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Admin",
  admin: "Administrator",
  teacher: "O'qituvchi",
};

export function StaffDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);

  const [staffMember, setStaffMember] = useState<User | null>(null);
  const [finance, setFinance] = useState<TeacherTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutComment, setPayoutComment] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const staff = await listStaffUsers();
      const found = staff.find((s) => s.id === id) ?? null;
      setStaffMember(found);
      if (found) {
        setEditFullName(found.full_name);
        setEditPhone(found.phone);
        setEditPercentage(found.teacher_percentage != null ? String(found.teacher_percentage) : "");
      }
      if (found?.role === "teacher") {
        setFinance(await getTeacherFinanceById(id));
      }
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

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await updateStaffUser(id, {
        full_name: editFullName,
        phone: editPhone,
        teacher_percentage: staffMember.role === "teacher" ? Number(editPercentage) : undefined,
      });
      setSuccess("Ma'lumotlar saqlandi");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    try {
      await updateStaffStatus(id, !staffMember.is_active);
      setSuccess(staffMember.is_active ? "Xodim bloklandi" : "Xodim faollashtirildi");
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

  const handlePayout = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await payoutTeacher(id, amount, payoutComment || undefined);
      setSuccess("Pul o'qituvchi balansidan yechildi");
      setPayoutAmount("");
      setPayoutComment("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalEarnings = finance
    .filter((t) => t.type === "lesson_earning")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayouts = Math.abs(
    finance.filter((t) => t.type === "payout").reduce((sum, t) => sum + t.amount, 0),
  );

  const { page, setPage, pageCount, pageItems, total } = usePagination(finance);

  if (isLoading || !staffMember) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{staffMember.full_name}</h1>
            {!staffMember.is_active && <Badge color="red">Bloklangan</Badge>}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {staffMember.phone} ·{" "}
            <Badge color={staffMember.role === "superadmin" ? "amber" : "slate"}>
              {ROLE_LABEL[staffMember.role] ?? staffMember.role}
            </Badge>
            {staffMember.teacher_percentage !== null && (
              <span className="ml-2">Foiz: {staffMember.teacher_percentage}%</span>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Balans: <span className="font-semibold">{staffMember.balance.toLocaleString("uz-UZ")} so'm</span>
          </p>
        </div>
        {staffMember.role !== "superadmin" && (
          <Button
            variant={staffMember.is_active ? "danger" : "secondary"}
            onClick={handleToggleActive}
          >
            {staffMember.is_active ? "Bloklash" : "Faollashtirish"}
          </Button>
        )}
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
            {staffMember.role === "teacher" && (
              <div>
                <Label>Foiz stavkasi (%)</Label>
                <Input
                  type="number"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" disabled={isSubmitting}>
              Saqlash
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

        {staffMember.role === "teacher" && (
          <Card title="Pul berish (balansdan yechish)">
            <form onSubmit={handlePayout} className="space-y-4">
              <div>
                <Label>Summa</Label>
                <Input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Izoh (ixtiyoriy)</Label>
                <Input
                  value={payoutComment}
                  onChange={(e) => setPayoutComment(e.target.value)}
                  placeholder="Masalan: Oylik to'lov"
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                Berish
              </Button>
            </form>
          </Card>
        )}
      </div>

      {staffMember.role === "teacher" && (
        <div className="mt-6">
          <Card
            title="Moliya tarixi"
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  downloadXlsx(
                    `/api/v1/teachers/${id}/finance/export`,
                    undefined,
                    `${staffMember.full_name}_moliyasi.xlsx`,
                  )
                }
              >
                Excel'ga chiqarish
              </Button>
            }
          >
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatTile
                label="Jami dars daromadi"
                value={`${totalEarnings.toLocaleString("uz-UZ")} so'm`}
                color="green"
              />
              <StatTile
                label="Jami pul berilgan"
                value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
                color="red"
              />
            </div>
            <Table headers={["Sana", "Turi", "O'quvchi", "Guruh", "Summa", "Izoh"]}>
              {pageItems.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {new Date(t.created_at).toLocaleString("uz-UZ")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                      {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.student_name ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                    {t.amount.toLocaleString("uz-UZ")} so'm
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{t.comment ?? "-"}</td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </Card>
        </div>
      )}
    </Layout>
  );
}
