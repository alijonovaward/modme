import { Badge } from "./ui";
import type { AttendanceGrid, AttendanceGridStudent, StudentAttendanceStats } from "../types";

function renderAttendanceCell(cell: AttendanceGrid["cells"][number] | undefined) {
  if (!cell) {
    return (
      <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />
    );
  }
  const color =
    cell.status === "present"
      ? "bg-green-500"
      : cell.status === "unexcused"
        ? "bg-rose-500"
        : "bg-slate-300 dark:bg-slate-600";
  const icon = cell.status === "present" ? "✓" : cell.status === "unexcused" ? "✕" : "–";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${color} ${
        cell.is_trial ? "ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900" : ""
      }`}
      title={cell.is_trial ? "Sinov darsi" : undefined}
    >
      {icon}
    </span>
  );
}

const STICKY_COLUMNS = [
  { key: "name", label: "O'quvchi", width: 150 },
  { key: "total", label: "Jami darslar", width: 90 },
  { key: "overall", label: "Umumiy foiz", width: 90 },
  { key: "previous", label: "Oldingi 14 kun", width: 105 },
  { key: "recent", label: "So'nggi 14 kun", width: 105 },
  { key: "trend", label: "Trend", width: 100 },
] as const;

function stickyOffset(index: number): number {
  return STICKY_COLUMNS.slice(0, index).reduce((sum, c) => sum + c.width, 0);
}

function stickyContent(
  key: (typeof STICKY_COLUMNS)[number]["key"],
  student: AttendanceGridStudent,
  stat: StudentAttendanceStats | undefined,
) {
  switch (key) {
    case "name":
      return student.student_name;
    case "total":
      return stat?.total_lessons ?? 0;
    case "overall":
      return stat ? `${stat.attendance_rate}%` : "-";
    case "previous":
      return stat?.previous_attendance_rate != null ? `${stat.previous_attendance_rate}%` : "-";
    case "recent":
      return stat?.recent_attendance_rate != null ? `${stat.recent_attendance_rate}%` : "-";
    case "trend":
      return stat?.is_declining ? (
        <Badge color="red">Pasaymoqda</Badge>
      ) : (
        <Badge color="slate">Barqaror</Badge>
      );
  }
}

export function AttendanceCombinedTable({
  grid,
  stats,
}: {
  grid: AttendanceGrid | null;
  stats: StudentAttendanceStats[];
}) {
  if (!grid || grid.students.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Hali o'quvchi yo'q.</p>;
  }
  const statsByStudent = new Map(stats.map((s) => [s.student_id, s]));
  const lastStickyIndex = STICKY_COLUMNS.length - 1;

  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
            {STICKY_COLUMNS.map((col, i) => (
              <th
                key={col.key}
                className={`sticky z-20 whitespace-nowrap bg-slate-50/95 px-2.5 py-2 font-semibold sm:px-3.5 sm:py-3 dark:bg-slate-900/95 ${
                  i === lastStickyIndex
                    ? "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]"
                    : ""
                }`}
                style={{ left: stickyOffset(i), width: col.width, minWidth: col.width }}
              >
                {col.label}
              </th>
            ))}
            {grid.lessons.map((l) => (
              <th key={l.id} className="whitespace-nowrap px-2.5 py-2 font-semibold sm:px-3.5 sm:py-3">
                {l.lesson_date}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {grid.students.map((s) => {
            const stat = statsByStudent.get(s.student_id);
            return (
              <tr key={s.student_id}>
                {STICKY_COLUMNS.map((col, i) => (
                  <td
                    key={col.key}
                    className={`sticky z-10 whitespace-nowrap bg-white px-3 py-2.5 text-slate-600 dark:bg-slate-950 dark:text-slate-400 ${
                      col.key === "name" ? "font-medium text-slate-800 dark:text-slate-200" : ""
                    } ${
                      i === lastStickyIndex
                        ? "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]"
                        : ""
                    }`}
                    style={{ left: stickyOffset(i), width: col.width, minWidth: col.width }}
                  >
                    {stickyContent(col.key, s, stat)}
                  </td>
                ))}
                {grid.lessons.map((l) => {
                  const cell = grid.cells.find(
                    (c) => c.student_id === s.student_id && c.lesson_id === l.id,
                  );
                  return (
                    <td key={l.id} className="px-3.5 py-2.5 text-center">
                      {renderAttendanceCell(cell)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
