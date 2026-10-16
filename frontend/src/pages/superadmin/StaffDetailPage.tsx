import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  getTeacherFinanceById,
  listStaffUsers,
  payoutTeacher,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const staff = await listStaffUsers();
      const found = staff.find((s) => s.id === id) ?? null;
      setStaffMember(found);
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
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{staffMember.full_name}</h1>
        <p className="text-sm text-slate-500">
          {staffMember.phone} ·{" "}
          <Badge color={staffMember.role === "superadmin" ? "amber" : "slate"}>
            {ROLE_LABEL[staffMember.role] ?? staffMember.role}
          </Badge>
          {staffMember.teacher_percentage !== null && (
            <span className="ml-2">Foiz: {staffMember.teacher_percentage}%</span>
          )}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Balans: <span className="font-semibold">{staffMember.balance.toLocaleString("uz-UZ")} so'm</span>
        </p>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          <Card title="Moliya tarixi">
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
            <Table headers={["Sana", "Turi", "Guruh", "Summa", "Izoh"]}>
              {pageItems.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(t.created_at).toLocaleString("uz-UZ")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                      {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {t.amount.toLocaleString("uz-UZ")} so'm
                  </td>
                  <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
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
