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

  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
            <th className="sticky left-0 z-20 w-[125px] min-w-[125px] bg-slate-50/95 px-2.5 py-2 font-semibold shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3.5 sm:py-3 sm:shadow-none dark:bg-slate-900/95 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
              O'quvchi
            </th>
            <th className="w-[80px] min-w-[80px] bg-slate-50/95 px-2.5 py-2 font-semibold sm:sticky sm:left-[150px] sm:z-20 sm:w-[90px] sm:min-w-[90px] sm:px-3.5 sm:py-3 dark:bg-slate-900/95">
              Jami darslar
            </th>
            <th className="w-[80px] min-w-[80px] bg-slate-50/95 px-2.5 py-2 font-semibold sm:sticky sm:left-[240px] sm:z-20 sm:w-[90px] sm:min-w-[90px] sm:px-3.5 sm:py-3 sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-900/95 dark:sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
              Umumiy foiz
            </th>
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
                <td className="sticky left-0 z-10 w-[125px] min-w-[125px] truncate bg-white px-2.5 py-2.5 font-medium text-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3 sm:shadow-none dark:bg-slate-950 dark:text-slate-200 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                  {s.student_name}
                </td>
                <td className="w-[80px] min-w-[80px] bg-white px-2.5 py-2.5 text-slate-600 sm:sticky sm:left-[150px] sm:z-10 sm:w-[90px] sm:min-w-[90px] sm:px-3 dark:bg-slate-950 dark:text-slate-400">
                  {stat?.total_lessons ?? 0}
                </td>
                <td className="w-[80px] min-w-[80px] bg-white px-2.5 py-2.5 text-slate-600 sm:sticky sm:left-[240px] sm:z-10 sm:w-[90px] sm:min-w-[90px] sm:px-3 sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-950 dark:text-slate-400 dark:sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                  {stat ? `${stat.attendance_rate}%` : "-"}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
