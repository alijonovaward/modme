import { useMemo, useState, type ReactNode } from "react";
import { submitAttendance } from "../api/endpoints";
import { Badge, Button, ErrorMessage, SuccessMessage } from "./ui";
import type { AttendanceGrid, AttendanceStatus, GroupRosterItem, StudentAttendanceStats } from "../types";

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

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

// Sticky-column left offsets (desktop only - see the `sm:` gating below) and the
// per-status row tint. Dropped/frozen rows need an opaque tint on every cell
// (not just the <tr>), because the sticky cells each set their own background to
// stay opaque while the row scrolls horizontally underneath them.
const ROW_TINT = {
  active: { sticky: "bg-white dark:bg-slate-950", cell: "" },
  frozen: { sticky: "bg-amber-50/90 dark:bg-amber-950/40", cell: "bg-amber-50/40 dark:bg-amber-950/20" },
  dropped: { sticky: "bg-slate-100/90 dark:bg-slate-800/40", cell: "bg-slate-100/50 dark:bg-slate-800/20" },
} as const;

const GROUP_HEADER_LABEL: Record<"frozen" | "dropped", string> = {
  frozen: "Muzlatilgan",
  dropped: "Arxiv",
};

const GROUP_HEADER_TINT: Record<"frozen" | "dropped", string> = {
  frozen: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  dropped: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400",
};

export function AttendanceCombinedTable({
  roster,
  grid,
  stats,
  onReload,
  renderActions,
}: {
  roster: GroupRosterItem[];
  grid: AttendanceGrid | null;
  stats: StudentAttendanceStats[];
  onReload?: () => Promise<void>;
  renderActions?: (student: GroupRosterItem) => ReactNode;
}) {
  const [editedCells, setEditedCells] = useState<Record<string, AttendanceStatus | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const modifiedLessonIds = useMemo(() => {
    const lessonIds = new Set<number>();
    for (const key of Object.keys(editedCells)) {
      const [, lessonIdStr] = key.split("_");
      const lessonId = Number(lessonIdStr);
      if (lessonId) lessonIds.add(lessonId);
    }
    return Array.from(lessonIds);
  }, [editedCells]);

  const todayStr = useMemo(() => getTodayStr(), []);

  const statsByStudent = useMemo(() => new Map(stats.map((s) => [s.student_id, s])), [stats]);
  const activeStudentIds = useMemo(
    () => new Set((grid?.students ?? []).map((s) => s.student_id)),
    [grid],
  );

  const rosterGroups = useMemo(() => {
    const active = roster.filter((s) => s.status === "active");
    const frozen = roster.filter((s) => s.status === "frozen");
    const dropped = roster.filter((s) => s.status === "dropped");
    return { active, frozen, dropped };
  }, [roster]);

  const hiddenCount = rosterGroups.frozen.length + rosterGroups.dropped.length;

  const visibleRows = useMemo(() => {
    type Row = { kind: "student"; student: GroupRosterItem } | { kind: "header"; status: "frozen" | "dropped" };
    const rows: Row[] = rosterGroups.active.map((student) => ({ kind: "student", student }));
    if (showAll) {
      if (rosterGroups.frozen.length > 0) {
        rows.push({ kind: "header", status: "frozen" });
        for (const student of rosterGroups.frozen) rows.push({ kind: "student", student });
      }
      if (rosterGroups.dropped.length > 0) {
        rows.push({ kind: "header", status: "dropped" });
        for (const student of rosterGroups.dropped) rows.push({ kind: "student", student });
      }
    }
    return rows;
  }, [rosterGroups, showAll]);

  const getCellStatus = (studentId: number, lessonId: number): AttendanceStatus | undefined => {
    const cellKey = `${studentId}_${lessonId}`;
    if (cellKey in editedCells) {
      return editedCells[cellKey] ?? undefined;
    }
    const cell = grid?.cells.find((c) => c.student_id === studentId && c.lesson_id === lessonId);
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
    if (modifiedLessonIds.length === 0 || isSaving || !grid) return;
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

  if (roster.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Hali o'quvchi yo'q.</p>;
  }

  const lessons = grid?.lessons ?? [];

  return (
    <div className="space-y-3">
      <ErrorMessage message={errorMsg} />
      <SuccessMessage message={successMsg} />

      <div className="flex items-center justify-between">
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {showAll ? "Faqat faollarni ko'rsatish" : `Hammasini ko'rsatish (${hiddenCount} ta yashirin)`}
          </button>
        ) : (
          <span />
        )}

        {modifiedLessonIds.length > 0 && (
          <div className="flex select-none items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-2 shadow-sm dark:border-indigo-900/80 dark:bg-indigo-950/60">
            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              O'zgartirilgan darslar: {modifiedLessonIds.length} ta
            </p>
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
        )}
      </div>

      <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
              <th className="sticky left-0 z-20 w-[125px] min-w-[125px] bg-slate-50/95 px-2.5 py-2 font-semibold shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3.5 sm:py-3 sm:shadow-none dark:bg-slate-900/95 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                O'quvchi
              </th>
              <th className="w-[90px] min-w-[90px] bg-slate-50/95 px-2.5 py-2 font-semibold sm:sticky sm:left-[150px] sm:z-20 sm:w-[100px] sm:min-w-[100px] sm:px-3.5 sm:py-3 dark:bg-slate-900/95">
                Holat
              </th>
              <th className="w-[80px] min-w-[80px] bg-slate-50/95 px-2.5 py-2 font-semibold sm:sticky sm:left-[250px] sm:z-20 sm:w-[90px] sm:min-w-[90px] sm:px-3.5 sm:py-3 dark:bg-slate-900/95">
                Jami darslar
              </th>
              <th className="w-[80px] min-w-[80px] bg-slate-50/95 px-2.5 py-2 font-semibold sm:sticky sm:left-[340px] sm:z-20 sm:w-[90px] sm:min-w-[90px] sm:px-3.5 sm:py-3 sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-900/95 dark:sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                Umumiy foiz
              </th>
              {lessons.map((l) => (
                <th key={l.id} className="whitespace-nowrap px-2.5 py-2 font-semibold sm:px-3.5 sm:py-3">
                  {l.lesson_date}
                </th>
              ))}
              {renderActions && (
                <th className="sticky right-0 z-20 w-px whitespace-nowrap bg-slate-50/95 px-2.5 py-2 font-semibold shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:px-3.5 sm:py-3 dark:bg-slate-900/95 dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                  Amallar
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {visibleRows.map((row) => {
              if (row.kind === "header") {
                return (
                  <tr key={`header-${row.status}`}>
                    <td
                      colSpan={4 + lessons.length + (renderActions ? 1 : 0)}
                      className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider ${GROUP_HEADER_TINT[row.status]}`}
                    >
                      {GROUP_HEADER_LABEL[row.status]}
                    </td>
                  </tr>
                );
              }

              const s = row.student;
              const stat = statsByStudent.get(s.student_id);
              const hasAttendanceData = activeStudentIds.has(s.student_id);
              const tint = ROW_TINT[s.status];

              return (
                <tr key={s.student_id}>
                  <td
                    className={`sticky left-0 z-10 w-[125px] min-w-[125px] truncate px-2.5 py-2.5 font-medium text-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3 sm:shadow-none dark:text-slate-200 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] ${tint.sticky}`}
                  >
                    {s.student_name}
                  </td>
                  <td
                    className={`w-[90px] min-w-[90px] px-2.5 py-2.5 sm:sticky sm:left-[150px] sm:z-10 sm:w-[100px] sm:min-w-[100px] sm:px-3 ${tint.sticky} ${tint.cell}`}
                  >
                    <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                    {s.status === "dropped" && s.status_reason && (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{s.status_reason}</p>
                    )}
                  </td>
                  <td
                    className={`w-[80px] min-w-[80px] px-2.5 py-2.5 text-slate-600 sm:sticky sm:left-[250px] sm:z-10 sm:w-[90px] sm:min-w-[90px] sm:px-3 dark:text-slate-400 ${tint.sticky} ${tint.cell}`}
                  >
                    {hasAttendanceData ? stat?.total_lessons ?? 0 : "–"}
                  </td>
                  <td
                    className={`w-[80px] min-w-[80px] px-2.5 py-2.5 text-slate-600 sm:sticky sm:left-[340px] sm:z-10 sm:w-[90px] sm:min-w-[90px] sm:px-3 sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:text-slate-400 dark:sm:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] ${tint.sticky} ${tint.cell}`}
                  >
                    {hasAttendanceData ? (stat ? `${stat.attendance_rate}%` : "-") : "–"}
                  </td>
                  {lessons.map((l) => {
                    if (!hasAttendanceData) {
                      return (
                        <td key={l.id} className={`px-3.5 py-2.5 text-center text-slate-300 dark:text-slate-700 ${tint.cell}`}>
                          –
                        </td>
                      );
                    }

                    const originalCell = grid?.cells.find(
                      (c) => c.student_id === s.student_id && c.lesson_id === l.id,
                    );
                    const currentStatus = getCellStatus(s.student_id, l.id);
                    const isModified = isCellModified(s.student_id, l.id);
                    const isFutureLesson = l.lesson_date > todayStr;

                    return (
                      <td key={l.id} className={`px-3.5 py-2.5 text-center ${tint.cell}`}>
                        <button
                          type="button"
                          disabled={isFutureLesson}
                          onClick={() => !isFutureLesson && handleCellClick(s.student_id, l.id)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
                            isFutureLesson
                              ? "cursor-not-allowed opacity-40"
                              : "active:scale-90"
                          }`}
                          title={
                            isFutureLesson
                              ? "Kelgusi kunlar uchun davomat belgilab bo'lmaydi"
                              : `${s.student_name} (${l.lesson_date}): Bosib holatni almashtiring`
                          }
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
                  {renderActions && (
                    <td className={`sticky right-0 z-10 whitespace-nowrap px-2.5 py-2.5 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:px-3.5 dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] ${tint.sticky}`}>
                      {renderActions(s)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
