import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getGroupAttendanceGrid, getGroupAttendanceStats, getGroupDetail } from "../../api/endpoints";
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
import { AttendanceCombinedTable } from "../../components/AttendanceGridView";
import { DateRangeFilterModal } from "../../components/DateRangeFilterModal";
import { useDateRangeFilter, type DateRange } from "../../hooks/useDateRangeFilter";
import type { AttendanceGrid, GroupDetail, GroupStudentStatus, StudentAttendanceStats } from "../../types";
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

  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats[]>([]);
  const [attendanceGrid, setAttendanceGrid] = useState<AttendanceGrid | null>(null);

  const attendanceFilter = useDateRangeFilter((range) => reloadAttendance(range));

  const reloadAttendance = async (range: DateRange = attendanceFilter.filters) => {
    try {
      const params = {
        date_from: range.dateFrom || undefined,
        date_to: range.dateTo || undefined,
      };
      const [gridData, statsData] = await Promise.all([
        getGroupAttendanceGrid(id, params),
        getGroupAttendanceStats(id, params),
      ]);
      setAttendanceGrid(gridData);
      setAttendanceStats(statsData);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  useEffect(() => {
    getGroupDetail(id)
      .then(setGroup)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    reloadAttendance().catch((err) => setError(extractErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredStudents = useMemo(() => {
    if (!group) return [];
    if (!statusFilter) return group.students;
    return group.students.filter((s) => s.status === statusFilter);
  }, [group, statusFilter]);

  const studentPagination = usePagination(filteredStudents);

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
      <Card
        title="Davomat"
        action={
          <Button variant="secondary" onClick={attendanceFilter.open}>
            Filterlar
          </Button>
        }
      >
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Davr: {attendanceFilter.filters.dateFrom || "..."} — {attendanceFilter.filters.dateTo || "..."}
        </p>
        <AttendanceCombinedTable
          grid={attendanceGrid}
          stats={attendanceStats}
          onReload={reloadAttendance}
        />
      </Card>

      <div className="mt-6">
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
      </div>

      <DateRangeFilterModal
        title="Davomat uchun filter"
        isOpen={attendanceFilter.isOpen}
        draft={attendanceFilter.draft}
        onChangeDraft={attendanceFilter.setDraft}
        onApply={attendanceFilter.apply}
        onClear={attendanceFilter.clear}
        onClose={attendanceFilter.close}
      />
    </Layout>
  );
}
