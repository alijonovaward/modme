import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAttendanceHistory } from "../../api/endpoints";
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
import type { StudentAttendanceHistoryItem } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Keldi",
  excused: "Sababli",
  unexcused: "Sababsiz",
};

interface Filters {
  dateFrom: string;
  dateTo: string;
  status: string;
  groupId: string;
}

const DEFAULT_FILTERS: Filters = {
  ...currentMonthRange(),
  status: "",
  groupId: "",
};

export function StudentAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<StudentAttendanceHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const load = async (filters: Filters) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getStudentAttendanceHistory(user.id, {
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        status: filters.status ? (filters.status as "present" | "excused" | "unexcused") : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      });
      setAttendance(data);
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
    attendance.forEach((a) => {
      if (!seen.has(a.group_id)) {
        seen.set(a.group_id, a.group_name);
      }
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value: String(value), label }));
  }, [attendance]);

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

  const activeCount = [appliedFilters.status, appliedFilters.groupId].filter(Boolean).length;

  const summary = useMemo(() => {
    const present = attendance.filter((a) => a.status === "present").length;
    const excused = attendance.filter((a) => a.status === "excused").length;
    const unexcused = attendance.filter((a) => a.status === "unexcused").length;
    return { present, excused, unexcused };
  }, [attendance]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(attendance);

  return (
    <Layout>
      <Card
        title="Davomat"
        action={
          <Button onClick={openModal}>
            Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      >
        <ErrorMessage message={error} />
        {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {appliedFilters.dateFrom || "..."} — {appliedFilters.dateTo || "..."}
          </p>
        )}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Keldi" value={String(summary.present)} color="green" />
          <StatTile label="Sababli" value={String(summary.excused)} color="indigo" />
          <StatTile label="Sababsiz" value={String(summary.unexcused)} color="red" />
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Sana", "Guruh", "O'qituvchi", "Holat", "Baho"]}>
            {pageItems.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.lesson_date}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.group_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.teacher_name}</td>
                <td className="px-3 py-2">
                  <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"}>
                    {ATTENDANCE_LABEL[a.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{a.grade ?? "-"}</td>
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
              <Label>Holat</Label>
              <Select
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Barchasi</option>
                <option value="present">Keldi</option>
                <option value="excused">Sababli</option>
                <option value="unexcused">Sababsiz</option>
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
