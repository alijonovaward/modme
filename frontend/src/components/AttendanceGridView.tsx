import { useMemo, useState } from "react";
import { submitAttendance } from "../api/endpoints";
import { Button, ErrorMessage, SuccessMessage } from "./ui";
import type { AttendanceGrid, AttendanceStatus, StudentAttendanceStats } from "../types";

function renderAttendanceStatusCircle(
  status: AttendanceStatus | undefined,
  isTrial?: boolean,
  isModified?: boolean,
) {
  if (!status) {
    return (
      <span
        className={`inline-block h-5 w-5 rounded-full border-2 border-slate-200 transition-all dark:border-slate-700 ${
          isModified ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900" : ""
        }`}
      />
    );
  }
  const color =
    status === "present"
      ? "bg-green-500"
      : status === "unexcused"
        ? "bg-rose-500"
        : "bg-amber-400 dark:bg-amber-500";
  const icon = status === "present" ? "✓" : status === "unexcused" ? "✕" : "–";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all ${color} ${
        isTrial ? "ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900" : ""
      } ${isModified ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
      title={isTrial ? "Sinov darsi" : undefined}
    >
      {icon}
    </span>
  );
}

export function AttendanceCombinedTable({
  grid,
  stats,
  onReload,
}: {
  grid: AttendanceGrid | null;
  stats: StudentAttendanceStats[];
  onReload?: () => Promise<void>;
}) {
  const [editedCells, setEditedCells] = useState<Record<string, AttendanceStatus | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const modifiedLessonIds = useMemo(() => {
    const lessonIds = new Set<number>();
    for (const key of Object.keys(editedCells)) {
      const [, lessonIdStr] = key.split("_");
      const lessonId = Number(lessonIdStr);
      if (lessonId) lessonIds.add(lessonId);
    }
    return Array.from(lessonIds);
  }, [editedCells]);

  if (!grid || grid.students.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Hali o'quvchi yo'q.</p>;
  }
  const statsByStudent = new Map(stats.map((s) => [s.student_id, s]));

  const getCellStatus = (studentId: number, lessonId: number): AttendanceStatus | undefined => {
    const cellKey = `${studentId}_${lessonId}`;
    if (cellKey in editedCells) {
      return editedCells[cellKey] ?? undefined;
    }
    const cell = grid.cells.find((c) => c.student_id === studentId && c.lesson_id === lessonId);
    return cell?.status;
  };

  const isCellModified = (studentId: number, lessonId: number): boolean => {
    const cellKey = `${studentId}_${lessonId}`;
    return cellKey in editedCells;
  };

  const handleCellClick = (studentId: number, lessonId: number) => {
    const currentStatus = getCellStatus(studentId, lessonId);
    let nextStatus: AttendanceStatus | null;
    if (!currentStatus) {
      nextStatus = "present";
    } else if (currentStatus === "present") {
      nextStatus = "excused";
    } else if (currentStatus === "excused") {
      nextStatus = "unexcused";
    } else {
      nextStatus = null;
    }

    setEditedCells((prev) => ({
      ...prev,
      [`${studentId}_${lessonId}`]: nextStatus,
    }));
  };

  const handleSave = async () => {
    if (modifiedLessonIds.length === 0) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      for (const lessonId of modifiedLessonIds) {
        const records = grid.students.map((s) => {
          const status = getCellStatus(s.student_id, lessonId) ?? "present";
          return { student_id: s.student_id, status };
        });
        await submitAttendance(lessonId, records);
      }
      setSuccessMsg("Davomat muvaffaqiyatli saqlandi");
      setEditedCells({});
      if (onReload) {
        await onReload();
      }
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Davomatni saqlashda xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <ErrorMessage message={errorMsg} />
      <SuccessMessage message={successMsg} />

      {modifiedLessonIds.length > 0 && (
        <div className="flex select-none items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-2 shadow-sm dark:border-indigo-900/80 dark:bg-indigo-950/60">
          <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            O'zgartirilgan darslar: {modifiedLessonIds.length} ta
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditedCells({})}
              className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Bekor qilish
            </button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </div>
      )}

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
                    const originalCell = grid.cells.find(
                      (c) => c.student_id === s.student_id && c.lesson_id === l.id,
                    );
                    const currentStatus = getCellStatus(s.student_id, l.id);
                    const isModified = isCellModified(s.student_id, l.id);

                    return (
                      <td key={l.id} className="px-3.5 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleCellClick(s.student_id, l.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90"
                          title={`${s.student_name} (${l.lesson_date}): Bosib holatni almashtiring`}
                        >
                          {renderAttendanceStatusCircle(
                            currentStatus,
                            originalCell?.is_trial,
                            isModified,
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
