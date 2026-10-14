import { useEffect, useState } from "react";
import { listStaffUsers, listTransactions } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import { Badge, Card, ErrorMessage, extractErrorMessage, Select, Table } from "../../components/ui";
import type { TransactionListItem, User } from "../../types";
import { Layout } from "../../components/Layout";

export function TransactionsPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [adminFilter, setAdminFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (createdById?: string) => {
    setIsLoading(true);
    try {
      const data = await listTransactions(
        createdById ? { created_by_id: Number(createdById) } : undefined,
      );
      setTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isSuperadmin) {
      listStaffUsers().then(setAdmins).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <Card
        title="Tranzaksiyalar tarixi"
        action={
          isSuperadmin ? (
            <Select
              className="w-56"
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                load(e.target.value || undefined);
              }}
            >
              <option value="">Barcha xodimlar</option>
              {admins
                .filter((a) => a.role === "admin" || a.role === "superadmin")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
            </Select>
          ) : undefined
        }
      >
        <ErrorMessage message={error} />
        {!isSuperadmin && (
          <p className="mb-4 text-sm text-slate-500">
            Faqat o'zingiz amalga oshirgan tranzaksiyalar ko'rsatilmoqda.
          </p>
        )}
        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <Table headers={["Sana", "O'quvchi", "Turi", "Summa", "Kim tomonidan", "Izoh"]}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.student_name}</td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-600">{t.created_by_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Layout>
  );
}
