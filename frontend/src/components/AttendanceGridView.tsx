import { Badge, Table } from "./ui";
import type { AttendanceGrid, StudentAttendanceStats } from "../types";

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

export function AttendanceGridTable({ grid }: { grid: AttendanceGrid | null }) {
  if (!grid || grid.lessons.length === 0 || grid.students.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Hali dars yoki o'quvchi yo'q.</p>
    );
  }
  return (
    <Table headers={["O'quvchi", ...grid.lessons.map((l) => l.lesson_date)]}>
      {grid.students.map((s) => (
        <tr key={s.student_id}>
          <td className="px-3.5 py-2.5 font-medium whitespace-nowrap text-slate-800 dark:text-slate-200">
            {s.student_name}
          </td>
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
      ))}
    </Table>
  );
}

export function AttendanceStatsTable({ stats }: { stats: StudentAttendanceStats[] }) {
  if (stats.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Hali o'quvchi yo'q</p>;
  }
  return (
    <Table
      headers={["O'quvchi", "Jami darslar", "Umumiy foiz", "Oldingi 14 kun", "So'nggi 14 kun", "Trend"]}
    >
      {stats.map((s) => (
        <tr key={s.student_id}>
          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
            {s.student_name}
          </td>
          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.total_lessons}</td>
          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.attendance_rate}%</td>
          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
            {s.previous_attendance_rate != null ? `${s.previous_attendance_rate}%` : "-"}
          </td>
          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
            {s.recent_attendance_rate != null ? `${s.recent_attendance_rate}%` : "-"}
          </td>
          <td className="px-3 py-2">
            {s.is_declining ? (
              <Badge color="red">Pasaymoqda</Badge>
            ) : (
              <Badge color="slate">Barqaror</Badge>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}
