import { useEffect, useState } from "react";
import { listGroups, listStaffUsers, listStudents, listTransactions } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
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
  Select,
  Table,
} from "../../components/ui";
import type { GroupListItem, TransactionListItem, User } from "../../types";
import { Layout } from "../../components/Layout";

interface Filters {
  dateFrom: string;
  dateTo: string;
  type: string;
  studentId: string;
  groupId: string;
  adminId: string;
}

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  type: "",
  studentId: "",
  groupId: "",
  adminId: "",
};

export function TransactionsPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const load = async (filters: Filters) => {
    setIsLoading(true);
    try {
      const data = await listTransactions({
        created_by_id: filters.adminId ? Number(filters.adminId) : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        student_id: filters.studentId ? Number(filters.studentId) : undefined,
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
    listGroups().then(setGroups).catch(() => undefined);
    listStudents().then(setStudents).catch(() => undefined);
    if (isSuperadmin) {
      listStaffUsers().then(setAdmins).catch(() => undefined);
    }
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
    setDraft(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setIsModalOpen(false);
    load(EMPTY_FILTERS);
  };

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;

  return (
    <Layout>
      <Card
        title="Tranzaksiyalar tarixi"
        action={
          <Button onClick={openModal}>
            Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
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
          <Table headers={["Sana", "O'quvchi", "Guruh", "Turi", "Summa", "Kim tomonidan", "Izoh"]}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
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
              <Label>O'quvchi</Label>
              <Combobox
                value={draft.studentId}
                onChange={(value) => setDraft((prev) => ({ ...prev, studentId: value }))}
                placeholder="Barcha o'quvchilar"
                options={[
                  { value: "", label: "Barcha o'quvchilar" },
                  ...students.map((s) => ({ value: String(s.id), label: s.full_name })),
                ]}
              />
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
            {isSuperadmin && (
              <div>
                <Label>Kim tomonidan</Label>
                <Combobox
                  value={draft.adminId}
                  onChange={(value) => setDraft((prev) => ({ ...prev, adminId: value }))}
                  placeholder="Barcha xodimlar"
                  options={[
                    { value: "", label: "Barcha xodimlar" },
                    ...admins
                      .filter((a) => a.role === "admin" || a.role === "superadmin")
                      .map((a) => ({ value: String(a.id), label: a.full_name })),
                  ]}
                />
              </div>
            )}
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
