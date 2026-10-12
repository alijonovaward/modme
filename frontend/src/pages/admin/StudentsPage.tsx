import { useEffect, useState, type FormEvent } from "react";
import { createStudent, depositToStudent, listStudents, updateUserPassword } from "../../api/endpoints";
import { Button, Card, ErrorMessage, extractErrorMessage, Input, Label, SuccessMessage, Table } from "../../components/ui";
import type { User } from "../../types";
import { Layout } from "../../components/Layout";

export function StudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [depositAmounts, setDepositAmounts] = useState<Record<number, string>>({});
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      setStudents(await listStudents());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await createStudent({ full_name: fullName, phone, password });
      setSuccess("O'quvchi muvaffaqiyatli qo'shildi");
      setFullName("");
      setPhone("");
      setPassword("");
      await loadStudents();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (studentId: number) => {
    const amountStr = depositAmounts[studentId];
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    setError(null);
    setSuccess(null);
    try {
      await depositToStudent(studentId, amount, "Admin tomonidan to'ldirildi");
      setSuccess("Balans to'ldirildi");
      setDepositAmounts((prev) => ({ ...prev, [studentId]: "" }));
      await loadStudents();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handlePasswordUpdate = async (studentId: number) => {
    const newPassword = newPasswords[studentId];
    if (!newPassword) return;
    setError(null);
    setSuccess(null);
    try {
      await updateUserPassword(studentId, newPassword);
      setSuccess("Parol yangilandi");
      setNewPasswords((prev) => ({ ...prev, [studentId]: "" }));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Yangi o'quvchi qo'shish">
          <form onSubmit={handleCreate} className="space-y-4">
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
            <ErrorMessage message={error} />
            <SuccessMessage message={success} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Qo'shish"}
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card title="O'quvchilar ro'yxati">
            {isLoading ? (
              <p className="text-sm text-slate-500">Yuklanmoqda...</p>
            ) : (
              <Table headers={["F.I.O", "Telefon", "Balans", "Deposit", "Yangi parol"]}>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.full_name}</td>
                    <td className="px-3 py-2 text-slate-600">{s.phone}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.balance.toLocaleString("uz-UZ")} so'm
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="Summa"
                          className="w-28"
                          value={depositAmounts[s.id] ?? ""}
                          onChange={(e) =>
                            setDepositAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        />
                        <Button variant="secondary" onClick={() => handleDeposit(s.id)}>
                          +
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Input
                          type="password"
                          placeholder="Yangi parol"
                          className="w-28"
                          value={newPasswords[s.id] ?? ""}
                          onChange={(e) =>
                            setNewPasswords((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        />
                        <Button variant="secondary" onClick={() => handlePasswordUpdate(s.id)}>
                          Saqlash
                        </Button>
                      </div>
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
