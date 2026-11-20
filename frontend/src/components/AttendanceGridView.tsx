import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getLessonAttendance, submitAttendance, updateAttendance } from "../api/endpoints";
import { Badge, Button, ErrorMessage, extractErrorMessage, Input, Modal } from "./ui";
import type {
  AttendanceGrid,
  AttendanceGridCell,
  AttendanceGridLesson,
  AttendanceStatus,
  GroupRosterItem,
  StudentAttendanceStats,
} from "../types";

function renderAttendanceStatusCircle(status: AttendanceStatus | undefined, isTrial?: boolean) {
  if (!status) {
    return <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />;
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
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${color} ${
        isTrial ? "ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900" : ""
      }`}
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

interface SelectedCell {
  student: GroupRosterItem;
  lesson: AttendanceGridLesson;
  existingCell: AttendanceGridCell | undefined;
}

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
  const [showAll, setShowAll] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<GroupRosterItem | null>(null);

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

  if (roster.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Hali o'quvchi yo'q.</p>;
  }

  const lessons = grid?.lessons ?? [];

  return (
    <div className="space-y-3">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          {showAll ? "Faqat faollarni ko'rsatish" : `Hammasini ko'rsatish (${hiddenCount} ta yashirin)`}
        </button>
      )}

      <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
              <th className="sticky left-0 z-20 w-[125px] min-w-[125px] bg-slate-50/95 px-2.5 py-2 font-semibold shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3.5 sm:py-3 sm:shadow-none dark:bg-slate-900/95 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                O'quvchi
              </th>
              {lessons.map((l) => (
                <th key={l.id} className="whitespace-nowrap px-2.5 py-2 font-semibold sm:px-3.5 sm:py-3">
                  {l.lesson_date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {visibleRows.map((row) => {
              if (row.kind === "header") {
                return (
                  <tr key={`header-${row.status}`}>
                    <td
                      colSpan={1 + lessons.length}
                      className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider ${GROUP_HEADER_TINT[row.status]}`}
                    >
                      {GROUP_HEADER_LABEL[row.status]}
                    </td>
                  </tr>
                );
              }

              const s = row.student;
              const hasAttendanceData = activeStudentIds.has(s.student_id);
              const tint = ROW_TINT[s.status];
              // Only the group's own teacher can mark/correct attendance - admin and
              // superadmin get a read-only grid (see mark_attendance/update_attendance
              // on the backend, which now reject anyone else).
              const canEditAttendance = !renderActions;

              return (
                <tr key={s.student_id}>
                  <td
                    onClick={() => setSelectedStudent(s)}
                    className={`sticky left-0 z-10 w-[125px] min-w-[125px] truncate px-2.5 py-2.5 font-medium text-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] sm:w-[150px] sm:min-w-[150px] sm:px-3 sm:shadow-none dark:text-slate-200 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] ${tint.sticky} cursor-pointer underline-offset-2 hover:underline`}
                  >
                    {s.student_name}
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
                    const isFutureLesson = l.lesson_date > todayStr;
                    const isDisabled = isFutureLesson || !canEditAttendance;

                    return (
                      <td key={l.id} className={`px-3.5 py-2.5 text-center ${tint.cell}`}>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() =>
                            canEditAttendance &&
                            !isFutureLesson &&
                            setSelectedCell({ student: s, lesson: l, existingCell: originalCell })
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
                            isDisabled ? "cursor-not-allowed" : "active:scale-90"
                          } ${isFutureLesson ? "opacity-40" : ""}`}
                          title={
                            isFutureLesson
                              ? "Kelgusi kunlar uchun davomat belgilab bo'lmaydi"
                              : !canEditAttendance
                                ? "Faqat guruh o'qituvchisi davomat belgilashi mumkin"
                                : `${s.student_name} (${l.lesson_date}): Batafsil`
                          }
                        >
                          {renderAttendanceStatusCircle(originalCell?.status, originalCell?.is_trial)}
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

      {selectedCell && (
        <CellDetailModal
          student={selectedCell.student}
          lesson={selectedCell.lesson}
          existingCell={selectedCell.existingCell}
          onClose={() => setSelectedCell(null)}
          onSaved={async () => {
            if (onReload) await onReload();
          }}
        />
      )}

      {selectedStudent && (
        <Modal title={selectedStudent.student_name} onClose={() => setSelectedStudent(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={ROSTER_STATUS_COLOR[selectedStudent.status]}>{selectedStudent.status}</Badge>
              {selectedStudent.status === "dropped" && selectedStudent.status_reason && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Sababi: {selectedStudent.status_reason}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Jami darslar
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-200">
                  {activeStudentIds.has(selectedStudent.student_id)
                    ? statsByStudent.get(selectedStudent.student_id)?.total_lessons ?? 0
                    : "–"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Umumiy foiz
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-200">
                  {activeStudentIds.has(selectedStudent.student_id)
                    ? `${statsByStudent.get(selectedStudent.student_id)?.attendance_rate ?? 0}%`
                    : "–"}
                </p>
              </div>
            </div>

            {renderActions && (
              // Any action button inside here should close this modal - e.g. "Chiqarish"
              // opens the parent's own reason-input modal, which must not stack on top
              // of this one.
              <div onClick={() => setSelectedStudent(null)} className="border-t border-slate-100 pt-4 dark:border-slate-800">
                {renderActions(selectedStudent)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "🟢 Keldi" },
  { value: "excused", label: "🟡 Sababli" },
  { value: "unexcused", label: "🔴 Sababsiz" },
];

function CellDetailModal({
  student,
  lesson,
  existingCell,
  onClose,
  onSaved,
}: {
  student: GroupRosterItem;
  lesson: AttendanceGridLesson;
  existingCell: AttendanceGridCell | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(existingCell?.status ?? "present");
  const [correctCount, setCorrectCount] = useState("");
  const [totalCount, setTotalCount] = useState("");
  const [isTrial, setIsTrial] = useState(existingCell?.is_trial ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(existingCell));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingCell) return;
    let cancelled = false;
    getLessonAttendance(lesson.id)
      .then((records) => {
        if (cancelled) return;
        const record = records.find((r) => r.student_id === student.student_id);
        if (record) {
          setStatus(record.status);
          setCorrectCount(record.correct_count != null ? String(record.correct_count) : "");
          setTotalCount(record.total_count != null ? String(record.total_count) : "");
          setIsTrial(record.is_trial);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, student.student_id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        status,
        correct_count: status === "present" && correctCount !== "" ? Number(correctCount) : null,
        total_count: status === "present" && totalCount !== "" ? Number(totalCount) : null,
        is_trial: isTrial,
      };
      if (existingCell) {
        await updateAttendance(lesson.id, student.student_id, payload);
      } else {
        await submitAttendance(lesson.id, [{ student_id: student.student_id, ...payload }]);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`${student.student_name} — ${lesson.lesson_date}`} onClose={onClose}>
      <div className="space-y-4">
        <ErrorMessage message={error} />

        {isLoadingDetail && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        )}

        <div>
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  status === opt.value
                    ? opt.value === "present"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : opt.value === "excused"
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                        : "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Test natijasi</p>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              className="w-20 text-center"
              disabled={status !== "present"}
              value={correctCount}
              onChange={(e) => setCorrectCount(e.target.value)}
            />
            <span className="text-slate-400">/</span>
            <Input
              type="number"
              min={1}
              className="w-20 text-center"
              disabled={status !== "present"}
              value={totalCount}
              onChange={(e) => setTotalCount(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={isTrial}
            onChange={(e) => setIsTrial(e.target.checked)}
          />
          Sinov darsi
        </label>

        <Button className="w-full" onClick={handleSave} disabled={isSaving || isLoadingDetail}>
          {isSaving ? "Saqlanmoqda..." : "Saqlash"}
        </Button>
      </div>
    </Modal>
  );
}
