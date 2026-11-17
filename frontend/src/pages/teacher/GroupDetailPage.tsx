import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getGroupAttendanceGrid, getGroupAttendanceStats, getGroupDetail } from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Pagination,
  Table,
  usePagination,
} from "../../components/ui";
import { AttendanceGridTable, AttendanceStatsTable } from "../../components/AttendanceGridView";
import type { AttendanceGrid, GroupDetail, GroupStudentStatus, StudentAttendanceStats } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";

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
  const [attendanceFilters, setAttendanceFilters] = useState(() => currentMonthRange());
  const [isAttendanceFilterModalOpen, setIsAttendanceFilterModalOpen] = useState(false);
  const [attendanceFilterDraft, setAttendanceFilterDraft] = useState(attendanceFilters);

  const loadAttendance = async (filters = attendanceFilters) => {
    const params = {
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
    };
    const [statsData, gridData] = await Promise.all([
      getGroupAttendanceStats(id, params),
      getGroupAttendanceGrid(id, params),
    ]);
    setAttendanceStats(statsData);
    setAttendanceGrid(gridData);
  };

  useEffect(() => {
    getGroupDetail(id)
      .then(setGroup)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    loadAttendance().catch((err) => setError(extractErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openAttendanceFilterModal = () => {
    setAttendanceFilterDraft(attendanceFilters);
    setIsAttendanceFilterModalOpen(true);
  };

  const applyAttendanceFilters = () => {
    setAttendanceFilters(attendanceFilterDraft);
    setIsAttendanceFilterModalOpen(false);
    loadAttendance(attendanceFilterDraft).catch((err) => setError(extractErrorMessage(err)));
  };

  const clearAttendanceFilters = () => {
    const defaults = currentMonthRange();
    setAttendanceFilterDraft(defaults);
    setAttendanceFilters(defaults);
    setIsAttendanceFilterModalOpen(false);
    loadAttendance(defaults).catch((err) => setError(extractErrorMessage(err)));
  };

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
          title="Davomat jadvali"
          action={
            <Button variant="secondary" onClick={openAttendanceFilterModal}>
              Filterlar
            </Button>
          }
        >
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {attendanceFilters.dateFrom || "..."} — {attendanceFilters.dateTo || "..."}
          </p>
          <AttendanceGridTable grid={attendanceGrid} />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Davomat statistikasi">
          <AttendanceStatsTable stats={attendanceStats} />
        </Card>
      </div>

      {isAttendanceFilterModalOpen && (
        <Modal title="Davomat uchun filter" onClose={() => setIsAttendanceFilterModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={attendanceFilterDraft.dateFrom}
                  onChange={(e) =>
                    setAttendanceFilterDraft((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={attendanceFilterDraft.dateTo}
                  onChange={(e) =>
                    setAttendanceFilterDraft((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={applyAttendanceFilters}>
                Qo'llash
              </Button>
              <Button variant="secondary" onClick={clearAttendanceFilters}>
                Shu oyga qaytarish
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
