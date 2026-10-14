import { useEffect, useState, type FormEvent } from "react";
import { createStaffUser, listStaffUsers, payoutTeacher } from "../../api/endpoints";
import { Button, Card, ErrorMessage, extractErrorMessage, Input, Label, Select, SuccessMessage, Table, Badge } from "../../components/ui";
import type { User } from "../../types";
import { Layout } from "../../components/Layout";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Admin",
  admin: "Administrator",
  teacher: "O'qituvchi",
};

export function StaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "teacher">("teacher");
  const [percentage, setPercentage] = useState("40");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payoutAmounts, setPayoutAmounts] = useState<Record<number, string>>({});

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await listStaffUsers();
      setStaff(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await createStaffUser({
        full_name: fullName,
        phone,
        password,
        role,
        teacher_percentage: role === "teacher" ? Number(percentage) : undefined,
      });
      setSuccess("Xodim muvaffaqiyatli yaratildi");
      setFullName("");
      setPhone("");
      setPassword("");
      await loadStaff();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayout = async (teacherId: number) => {
    const amountStr = payoutAmounts[teacherId];
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    setError(null);
    setSuccess(null);
    try {
      await payoutTeacher(teacherId, amount, "Admin tomonidan pul berildi");
      setSuccess("Pul o'qituvchi balansidan yechildi");
      setPayoutAmounts((prev) => ({ ...prev, [teacherId]: "" }));
      await loadStaff();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Yangi xodim qo'shish">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>F.I.O</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Telefon raqam</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998901234567"
                required
              />
            </div>
            <div>
              <Label>Parol</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as "admin" | "teacher")}>
                <option value="teacher">O'qituvchi</option>
                <option value="admin">Administrator</option>
              </Select>
            </div>
            {role === "teacher" && (
              <div>
                <Label>Foiz stavkasi (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  required
                />
              </div>
            )}
            <ErrorMessage message={error} />
            <SuccessMessage message={success} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Yaratish"}
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Xodimlar ro'yxati">
            {isLoading ? (
              <p className="text-sm text-slate-500">Yuklanmoqda...</p>
            ) : (
              <Table headers={["F.I.O", "Telefon", "Rol", "Foiz", "Balans", "Pul berish"]}>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.full_name}</td>
                    <td className="px-3 py-2 text-slate-600">{s.phone}</td>
                    <td className="px-3 py-2">
                      <Badge color={s.role === "superadmin" ? "amber" : "slate"}>
                        {ROLE_LABEL[s.role] ?? s.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.teacher_percentage !== null ? `${s.teacher_percentage}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.balance.toLocaleString("uz-UZ")} so'm
                    </td>
                    <td className="px-3 py-2">
                      {s.role === "teacher" && (
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            placeholder="Summa"
                            className="w-28"
                            value={payoutAmounts[s.id] ?? ""}
                            onChange={(e) =>
                              setPayoutAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                          />
                          <Button variant="secondary" onClick={() => handlePayout(s.id)}>
                            Berish
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
