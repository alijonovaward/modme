import { useEffect, useState } from "react";
import { listGroups, listTransactions } from "../../api/endpoints";
import {
  Badge,
  Card,
  Combobox,
  ErrorMessage,
  extractErrorMessage,
  Pagination,
  StatTile,
  Table,
  usePagination,
} from "../../components/ui";
import type { GroupListItem, TransactionListItem } from "../../types";
import { Layout } from "../../components/Layout";

export function TeacherTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (groupId?: string) => {
    setIsLoading(true);
    try {
      const data = await listTransactions(groupId ? { group_id: Number(groupId) } : undefined);
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

  const totalDeducted = Math.abs(transactions.reduce((sum, t) => sum + t.amount, 0));
  const { page, setPage, pageCount, pageItems, total } = usePagination(transactions);

  return (
    <Layout>
      <Card
        title="O'quvchilardan yechilgan pullar"
        action={
          <Combobox
            className="w-56"
            value={groupFilter}
            onChange={(value) => {
              setGroupFilter(value);
              load(value || undefined);
            }}
            placeholder="Barcha guruhlar"
            options={[
              { value: "", label: "Barcha guruhlar" },
              ...groups.map((g) => ({ value: String(g.id), label: g.name })),
            ]}
          />
        }
      >
        <ErrorMessage message={error} />
        <p className="mb-4 text-sm text-slate-500">
          Davomat olganingizda guruh o'quvchilaridan yechilgan pullar tarixi.
        </p>
        {!isLoading && (
          <div className="mb-4 max-w-xs">
            <StatTile
              label="Jami yechilgan"
              value={`${totalDeducted.toLocaleString("uz-UZ")} so'm`}
              color="red"
            />
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Sana", "O'quvchi", "Guruh", "Summa"]}>
            {pageItems.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2">
                  <Badge color="red">{t.amount.toLocaleString("uz-UZ")} so'm</Badge>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </Layout>
  );
}
