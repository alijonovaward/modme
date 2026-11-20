import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listAllLessons, listGroups } from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  MobileList,
  MobileListRow,
  Modal,
  PAGE_SIZE,
  Pagination,
  Select,
  StatTile,
  Table,
} from "../../components/ui";
import type { GroupListItem, LessonListItem } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";

interface Filters {
  dateFrom: string;
  dateTo: string;
  groupId: string;
  status: string;
}

const DEFAULT_FILTERS: Filters = {
  ...currentMonthRange(),
  groupId: "",
  status: "",
};

export function AttendanceHubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupIdFromUrl = searchParams.get("group_id");
  const initialFilters: Filters = groupIdFromUrl
    ? { dateFrom: "", dateTo: "", groupId: groupIdFromUrl, status: "" }
    : DEFAULT_FILTERS;

  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ completed: 0, planned: 0 });

  const load = async (filters: Filters, pageArg: number) => {
    setIsLoading(true);
    try {
      const data = await listAllLessons({
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        status: filters.status ? (filters.status as "planned" | "completed") : undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setLessons(data.items);
      setTotal(data.total);
      setSummary({ completed: data.completed_count, planned: data.planned_count });
      setPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(appliedFilters, 1);
    listGroups().then(setGroups).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = () => {
    setDraft(appliedFilters);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draft);
    setIsModalOpen(false);
    load(draft, 1);
  };

  const clearFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setIsModalOpen(false);
    load(DEFAULT_FILTERS, 1);
  };

  const activeCount = [appliedFilters.groupId, appliedFilters.status].filter(Boolean).length;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const handlePageChange = (nextPage: number) => {
    load(appliedFilters, nextPage);
  };

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
          <StatTile label="Jami darslar" value={String(total)} color="indigo" />
          <StatTile label="O'tilgan" value={String(summary.completed)} color="green" />
          <StatTile label="Rejalashtirilgan" value={String(summary.planned)} color="amber" />
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <div className="hidden sm:block">
            <Table headers={["Sana", "Guruh", "Fan", "Holat"]}>
              {lessons.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/teacher/groups/${l.group_id}/lessons/${l.id}`)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
                >
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{l.lesson_date}</td>
                  <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{l.group_name}</td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{l.subject_name}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge color={l.status === "completed" ? "green" : "slate"}>
                      {l.status === "completed" ? "O'tildi" : "Rejada"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <MobileList>
            {lessons.map((l) => (
              <MobileListRow
                key={l.id}
                onClick={() => navigate(`/teacher/groups/${l.group_id}/lessons/${l.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {l.group_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {l.subject_name} · {l.lesson_date}
                  </p>
                </div>
                <Badge color={l.status === "completed" ? "green" : "slate"}>
                  {l.status === "completed" ? "O'tildi" : "Rejada"}
                </Badge>
              </MobileListRow>
            ))}
          </MobileList>

          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={handlePageChange} />
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
                <option value="planned">Rejada</option>
                <option value="completed">O'tildi</option>
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
