import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getGroupAttendanceGrid, getGroupAttendanceStats, getGroupDetail } from "../../api/endpoints";
import { Button, Card, ErrorMessage, extractErrorMessage } from "../../components/ui";
import { AttendanceCombinedTable } from "../../components/AttendanceGridView";
import { DateRangeFilterModal } from "../../components/DateRangeFilterModal";
import { useDateRangeFilter, type DateRange } from "../../hooks/useDateRangeFilter";
import type { AttendanceGrid, GroupDetail, StudentAttendanceStats } from "../../types";
import { Layout } from "../../components/Layout";

export function TeacherGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        title="O'quvchilar va davomat"
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
          roster={group.students}
          grid={attendanceGrid}
          stats={attendanceStats}
          onReload={reloadAttendance}
        />
      </Card>

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
