import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getStudentTransactions } from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Pagination,
  Select,
  StatTile,
  Table,
  usePagination,
} from "../../components/ui";
import type { StudentTransactionListItem } from "../../types";
import { Layout } from "../../components/Layout";

interface Filters {
  dateFrom: string;
  dateTo: string;
  type: string;
  groupId: string;
}

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  type: "",
  groupId: "",
};

export function StudentTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<StudentTransactionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const load = async (filters: Filters) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getStudentTransactions(user.id, {
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        type: filters.type ? (filters.type as "deposit" | "deduction") : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      });
      setTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const groupOptions = useMemo(() => {
    const seen = new Map<number, string>();
    transactions.forEach((t) => {
      if (t.group_id && t.group_name && !seen.has(t.group_id)) {
        seen.set(t.group_id, t.group_name);
      }
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value: String(value), label }));
  }, [transactions]);

  const openModal = () => {
    setDraft(appliedFilters);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draft);
    setIsModalOpen(false);
    load(draft);
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setIsModalOpen(false);
    load(EMPTY_FILTERS);
  };

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;
  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );
  const { page, setPage, pageCount, pageItems, total } = usePagination(transactions);

  return (
    <Layout>
      <Card
        title="Tranzaksiyalar"
        action={
          <Button onClick={openModal}>
            Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      >
        <ErrorMessage message={error} />
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            label="Jami to'ldirilgan"
            value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
            color="green"
          />
          <StatTile
            label="Jami yechilgan"
            value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
            color="red"
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Sana", "Turi", "Guruh", "O'qituvchi", "Summa", "Izoh"]}>
            {pageItems.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.teacher_name ?? "-"}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Turi</Label>
              <Select
                value={draft.type}
                onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="">Barchasi</option>
                <option value="deposit">To'ldirish</option>
                <option value="deduction">Yechim</option>
              </Select>
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={draft.groupId}
                onChange={(value) => setDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[{ value: "", label: "Barcha guruhlar" }, ...groupOptions]}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={applyFilters}>
                Qo'llash
              </Button>
              <Button variant="secondary" onClick={clearFilters}>
                Tozalash
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
