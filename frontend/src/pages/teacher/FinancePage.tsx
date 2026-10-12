import { useEffect, useState } from "react";
import { getTeacherFinance, listGroups } from "../../api/endpoints";
import { Badge, Card, ErrorMessage, extractErrorMessage, Select, Table } from "../../components/ui";
import type { GroupListItem, TeacherTransaction } from "../../types";
import { Layout } from "../../components/Layout";

export function FinancePage() {
  const [transactions, setTransactions] = useState<TeacherTransaction[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (groupId?: string) => {
    setIsLoading(true);
    try {
      const data = await getTeacherFinance(groupId ? { group_id: Number(groupId) } : undefined);
      setTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    listGroups().then(setGroups).catch(() => undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Layout>
      <Card
        title="Moliyam"
        action={
          <Select
            className="w-56"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              load(e.target.value || undefined);
            }}
          >
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        }
      >
        <ErrorMessage message={error} />
        <p className="mb-4 text-sm text-slate-600">
          Jami: <span className="font-semibold text-emerald-700">{total.toLocaleString("uz-UZ")} so'm</span>
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <Table headers={["Sana", "Turi", "Summa"]}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "lesson_earning" ? "green" : "amber"}>
                    {t.type === "lesson_earning" ? "Dars daromadi" : "To'lov"}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Layout>
  );
}
