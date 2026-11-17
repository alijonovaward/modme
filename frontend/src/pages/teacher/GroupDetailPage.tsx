import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getGroupAttendanceGrid,
  getGroupAttendanceStats,
  getGroupDetail,
  listGroupLessons,
} from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Pagination,
  Table,
  usePagination,
} from "../../components/ui";
import { AttendanceGridTable, AttendanceStatsTable } from "../../components/AttendanceGridView";
import { DateRangeFilterModal } from "../../components/DateRangeFilterModal";
import { useDateRangeFilter, type DateRange } from "../../hooks/useDateRangeFilter";
import type {
  AttendanceGrid,
  GroupDetail,
  GroupStudentStatus,
  Lesson,
  StudentAttendanceStats,
} from "../../types";
import { Layout } from "../../components/Layout";

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

const STATUS_TABS: { value: GroupStudentStatus | ""; label: string }[] = [
  { value: "", label: "Hammasi" },
  { value: "active", label: "Faol" },
  { value: "frozen", label: "Muzlatilgan" },
  { value: "dropped", label: "Arxiv" },
];

export function TeacherGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GroupStudentStatus | "">("");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats[]>([]);
  const [attendanceGrid, setAttendanceGrid] = useState<AttendanceGrid | null>(null);

  const lessonsFilter = useDateRangeFilter((range) => reloadLessons(range));
  const gridFilter = useDateRangeFilter((range) => reloadGrid(range));
  const statsFilter = useDateRangeFilter((range) => reloadStats(range));

  const reloadLessons = async (range: DateRange = lessonsFilter.filters) => {
    try {
      setLessons(
        await listGroupLessons(id, {
          date_from: range.dateFrom || undefined,
          date_to: range.dateTo || undefined,
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const reloadGrid = async (range: DateRange = gridFilter.filters) => {
    try {
      setAttendanceGrid(
        await getGroupAttendanceGrid(id, {
          date_from: range.dateFrom || undefined,
          date_to: range.dateTo || undefined,
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const reloadStats = async (range: DateRange = statsFilter.filters) => {
    try {
      setAttendanceStats(
        await getGroupAttendanceStats(id, {
          date_from: range.dateFrom || undefined,
          date_to: range.dateTo || undefined,
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  useEffect(() => {
    getGroupDetail(id)
      .then(setGroup)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    Promise.all([reloadLessons(), reloadGrid(), reloadStats()]).catch((err) =>
      setError(extractErrorMessage(err)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredStudents = useMemo(() => {
    if (!group) return [];
    if (!statusFilter) return group.students;
    return group.students.filter((s) => s.status === statusFilter);
  }, [group, statusFilter]);

  const studentPagination = usePagination(filteredStudents);
  const lessonsPagination = usePagination(lessons);

  if (isLoading || !group) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{group.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {group.subject_name} · {group.lesson_price.toLocaleString("uz-UZ")} so'm/dars
        </p>
      </div>
      <ErrorMessage message={error} />
      <Card title="O'quvchilar">
        <div className="mb-3 flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                statusFilter === tab.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Table headers={["F.I.O", "Holat"]}>
          {studentPagination.pageItems.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{s.student_name}</td>
              <td className="px-3 py-2">
                <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                {s.status === "dropped" && s.status_reason && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sababi: {s.status_reason}</p>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          page={studentPagination.page}
          pageCount={studentPagination.pageCount}
          total={studentPagination.total}
          onPageChange={studentPagination.setPage}
        />
      </Card>

      <div className="mt-6">
        <Card
          title="Darslar"
          action={
            <Button variant="secondary" onClick={lessonsFilter.open}>
              Filterlar
            </Button>
          }
        >
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {lessonsFilter.filters.dateFrom || "..."} — {lessonsFilter.filters.dateTo || "..."}
          </p>
          {lessons.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Hali dars qo'shilmagan</p>
          ) : (
            <>
              <Table headers={["Sana", "Vaqt", "Holat"]}>
                {lessonsPagination.pageItems.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{l.lesson_date}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {l.start_time && l.end_time
                        ? `${l.start_time.slice(0, 5)}–${l.end_time.slice(0, 5)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={l.status === "completed" ? "green" : "slate"}>
                        {l.status === "completed" ? "O'tildi" : "Rejada"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={lessonsPagination.page}
                pageCount={lessonsPagination.pageCount}
                total={lessonsPagination.total}
                onPageChange={lessonsPagination.setPage}
              />
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Davomat jadvali"
          action={
            <Button variant="secondary" onClick={gridFilter.open}>
              Filterlar
            </Button>
          }
        >
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {gridFilter.filters.dateFrom || "..."} — {gridFilter.filters.dateTo || "..."}
          </p>
          <AttendanceGridTable grid={attendanceGrid} />
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Davomat statistikasi"
          action={
            <Button variant="secondary" onClick={statsFilter.open}>
              Filterlar
            </Button>
          }
        >
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {statsFilter.filters.dateFrom || "..."} — {statsFilter.filters.dateTo || "..."}
          </p>
          <AttendanceStatsTable stats={attendanceStats} />
        </Card>
      </div>

      <DateRangeFilterModal
        title="Darslar uchun filter"
        isOpen={lessonsFilter.isOpen}
        draft={lessonsFilter.draft}
        onChangeDraft={lessonsFilter.setDraft}
        onApply={lessonsFilter.apply}
        onClear={lessonsFilter.clear}
        onClose={lessonsFilter.close}
      />
      <DateRangeFilterModal
        title="Davomat jadvali uchun filter"
        isOpen={gridFilter.isOpen}
        draft={gridFilter.draft}
        onChangeDraft={gridFilter.setDraft}
        onApply={gridFilter.apply}
        onClear={gridFilter.clear}
        onClose={gridFilter.close}
      />
      <DateRangeFilterModal
        title="Davomat statistikasi uchun filter"
        isOpen={statsFilter.isOpen}
        draft={statsFilter.draft}
        onChangeDraft={statsFilter.setDraft}
        onApply={statsFilter.apply}
        onClear={statsFilter.clear}
        onClose={statsFilter.close}
      />
    </Layout>
  );
}
