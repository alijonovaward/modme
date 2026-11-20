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
  PrivacyToggle,
  Select,
  StatTile,
  Table,
  usePagination,
  usePrivacyMode,
} from "../../components/ui";
import type { StudentTransactionListItem } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";
import { downloadXlsx } from "../../utils/download";

interface Filters {
  dateFrom: string;
  dateTo: string;
  type: string;
  groupId: string;
}

const DEFAULT_FILTERS: Filters = {
  ...currentMonthRange(),
  type: "",
  groupId: "",
};

export function StudentTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<StudentTransactionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);

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
    setDraft(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setIsModalOpen(false);
    load(DEFAULT_FILTERS);
  };

  const activeCount = [appliedFilters.type, appliedFilters.groupId].filter(Boolean).length;
  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );
  const [selectedTx, setSelectedTx] = useState<StudentTransactionListItem | null>(null);
  const { page, setPage, pageCount, pageItems, total } = usePagination(transactions);
  const { isPrivate, togglePrivacy } = usePrivacyMode();
  const balance = user?.balance ?? 0;
  const isNegative = balance < 0;

  return (
    <Layout>
      <div
        className={`mb-6 flex items-center justify-between rounded-xl border p-6 ${
          isNegative
            ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
        }`}
      >
        <div>
          <p className={`text-sm ${isNegative ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            Joriy balans
          </p>
          <p className={`text-2xl font-semibold ${isNegative ? "text-rose-800 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-300"}`}>
            {isPrivate ? "••••••••" : `${balance.toLocaleString("uz-UZ")} so'm`}
          </p>
        </div>
        <PrivacyToggle isPrivate={isPrivate} onToggle={togglePrivacy} />
      </div>

      <Card
        title="Tranzaksiyalar"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                user &&
                downloadXlsx(
                  `/api/v1/students/${user.id}/transactions/export`,
                  {
                    group_id: appliedFilters.groupId ? Number(appliedFilters.groupId) : undefined,
                    type: appliedFilters.type || undefined,
                    date_from: appliedFilters.dateFrom ? `${appliedFilters.dateFrom}T00:00:00` : undefined,
                    date_to: appliedFilters.dateTo ? `${appliedFilters.dateTo}T23:59:59` : undefined,
                  },
                  "tranzaksiyalarim.xlsx",
                )
              }
            >
              Excel'ga chiqarish
            </Button>
            <Button onClick={openModal}>
              Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {appliedFilters.dateFrom || "..."} — {appliedFilters.dateTo || "..."}
          </p>
        )}
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
          <Table headers={["Sana", "Turi", "Guruh", "Summa"]}>
            {pageItems.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelectedTx(t)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                </td>
                <td className="px-2.5 py-2.5">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-2.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
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
            <div className="flex flex-wrap gap-2">
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

      {selectedTx && (
        <Modal title="Tranzaksiya tafsilotlari" onClose={() => setSelectedTx(null)}>
          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Turi:</span>
              <Badge color={selectedTx.type === "deposit" ? "green" : "red"}>
                {selectedTx.type === "deposit" ? "To'ldirish" : "Yechim"}
              </Badge>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Summa:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {selectedTx.amount.toLocaleString("uz-UZ")} so'm
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Guruh:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTx.group_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">O'qituvchi:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTx.teacher_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Sana va vaqt:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {new Date(selectedTx.created_at).toLocaleString("uz-UZ")}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 mb-1 dark:text-slate-400">To'liq izoh:</span>
              <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {selectedTx.comment || "Izoh mavjud emas"}
              </p>
            </div>
            <Button className="w-full mt-2" onClick={() => setSelectedTx(null)}>
              Yopish
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
