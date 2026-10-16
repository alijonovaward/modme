import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getTeacherFinance, listGroups } from "../../api/endpoints";
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
import type { GroupListItem, TeacherTransaction } from "../../types";
import { Layout } from "../../components/Layout";

interface Filters {
  dateFrom: string;
  dateTo: string;
  type: string;
  groupId: string;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dateFrom: toISODate(firstDay), dateTo: toISODate(lastDay) };
}

const DEFAULT_FILTERS: Filters = {
  ...currentMonthRange(),
  type: "",
  groupId: "",
};

export function FinancePage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TeacherTransaction[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const load = async (filters: Filters) => {
    setIsLoading(true);
    try {
      const data = await getTeacherFinance({
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      });
      setTransactions(
        filters.type ? data.filter((t) => t.type === filters.type) : data,
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    listGroups().then(setGroups).catch(() => undefined);
    load(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const extraFilterCount = [appliedFilters.type, appliedFilters.groupId].filter(Boolean).length;
  const totalEarnings = transactions
    .filter((t) => t.type === "lesson_earning")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayouts = Math.abs(
    transactions.filter((t) => t.type === "payout").reduce((sum, t) => sum + t.amount, 0),
  );
  const { page, setPage, pageCount, pageItems, total } = usePagination(transactions);

  return (
    <Layout>
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm text-emerald-700">Yechib olish mumkin bo'lgan pul (joriy balans)</p>
        <p className="text-2xl font-semibold text-emerald-800">
          {(user?.balance ?? 0).toLocaleString("uz-UZ")} so'm
        </p>
      </div>

      <Card
        title="Moliyam"
        action={
          <Button onClick={openModal}>
            Filterlar{extraFilterCount > 0 ? ` (${extraFilterCount})` : ""}
          </Button>
        }
      >
        <ErrorMessage message={error} />
        {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
          <p className="mb-4 text-sm text-slate-500">
            Davr: {appliedFilters.dateFrom || "..."} — {appliedFilters.dateTo || "..."}
          </p>
        )}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            label="Jami kirim (dars daromadi)"
            value={`${totalEarnings.toLocaleString("uz-UZ")} so'm`}
            color="green"
          />
          <StatTile
            label="Jami yechilgan (admin bergan)"
            value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
            color="red"
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Sana", "Turi", "O'quvchi", "Guruh", "Summa", "Izoh"]}>
            {pageItems.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                    {t.type === "lesson_earning" ? "Dars daromadi" : "Admin yechgan"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.student_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2 font-medium text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
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
                <option value="lesson_earning">Dars daromadi</option>
                <option value="payout">Admin yechgan</option>
              </Select>
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={draft.groupId}
                onChange={(value) => setDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
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
