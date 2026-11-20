import { useMemo, useState, type ReactNode } from "react";
import { submitAttendance } from "../api/endpoints";
import { Badge, Button, ErrorMessage, Modal, SuccessMessage } from "./ui";
import type { AttendanceGrid, AttendanceStatus, GroupRosterItem, StudentAttendanceStats } from "../types";

function renderAttendanceStatusCircle(
  status: AttendanceStatus | undefined,
  isTrial?: boolean,
  isModified?: boolean,
) {
  if (!status) {
    return (
      <span
        className={`inline-block h-6 w-6 rounded-full border-2 border-slate-200 transition-all dark:border-slate-700 ${
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
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white transition-all ${color} ${
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

const ROW_TINT = {
  active: "",
  frozen: "bg-amber-50/40 dark:bg-amber-950/20",
  dropped: "bg-slate-100/50 dark:bg-slate-800/20",
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
  const [selectedStudent, setSelectedStudent] = useState<GroupRosterItem | null>(null);
  const [showAll, setShowAll] = useState(false);

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

      <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 sm:text-xs dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
              <th className="px-3 py-2.5 font-semibold sm:px-3.5 sm:py-3">O'quvchi</th>
              <th className="px-2 py-2.5 font-semibold sm:px-3.5 sm:py-3">Holat</th>
              <th className="px-2 py-2.5 text-center font-semibold sm:px-3.5 sm:py-3">Jami</th>
              <th className="px-2 py-2.5 text-center font-semibold sm:px-3.5 sm:py-3">Foiz</th>
              <th className="w-6 px-2 py-2.5 sm:px-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {visibleRows.map((row) => {
              if (row.kind === "header") {
                return (
                  <tr key={`header-${row.status}`}>
                    <td colSpan={5} className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider ${GROUP_HEADER_TINT[row.status]}`}>
                      {GROUP_HEADER_LABEL[row.status]}
                    </td>
                  </tr>
                );
              }

              const s = row.student;
              const stat = statsByStudent.get(s.student_id);
              const hasAttendanceData = activeStudentIds.has(s.student_id);

              return (
                <tr
                  key={s.student_id}
                  onClick={() => setSelectedStudent(s)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${ROW_TINT[s.status]}`}
                >
                  <td className="truncate px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                    {s.student_name}
                  </td>
                  <td className="px-2 py-2.5">
                    <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-400">
                    {hasAttendanceData ? stat?.total_lessons ?? 0 : "–"}
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-400">
                    {hasAttendanceData ? (stat ? `${stat.attendance_rate}%` : "-") : "–"}
                  </td>
                  <td className="px-2 py-2.5 text-slate-300 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <StudentAttendanceModal
          student={selectedStudent}
          grid={grid}
          hasAttendanceData={activeStudentIds.has(selectedStudent.student_id)}
          onClose={() => setSelectedStudent(null)}
          onReload={onReload}
          renderActions={renderActions}
        />
      )}
    </div>
  );
}

function StudentAttendanceModal({
  student,
  grid,
  hasAttendanceData,
  onClose,
  onReload,
  renderActions,
}: {
  student: GroupRosterItem;
  grid: AttendanceGrid | null;
  hasAttendanceData: boolean;
  onClose: () => void;
  onReload?: () => Promise<void>;
  renderActions?: (student: GroupRosterItem) => ReactNode;
}) {
  const [editedCells, setEditedCells] = useState<Record<number, AttendanceStatus | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = useMemo(() => getTodayStr(), []);
  const lessons = grid?.lessons ?? [];
  const modifiedLessonIds = Object.keys(editedCells).map(Number);

  const getCellStatus = (lessonId: number): AttendanceStatus | undefined => {
    if (lessonId in editedCells) {
      return editedCells[lessonId] ?? undefined;
    }
    const cell = grid?.cells.find((c) => c.student_id === student.student_id && c.lesson_id === lessonId);
    return cell?.status;
  };

  const handleCellClick = (lessonId: number) => {
    const currentStatus = getCellStatus(lessonId);
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
    setEditedCells((prev) => ({ ...prev, [lessonId]: nextStatus }));
  };

  const handleSave = async () => {
    if (modifiedLessonIds.length === 0 || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      for (const lessonId of modifiedLessonIds) {
        const status = getCellStatus(lessonId) ?? "present";
        await submitAttendance(lessonId, [{ student_id: student.student_id, status }]);
      }
      setSuccessMsg("Davomat saqlandi");
      setEditedCells({});
      if (onReload) await onReload();
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Davomatni saqlashda xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={student.student_name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={ROSTER_STATUS_COLOR[student.status]}>{student.status}</Badge>
          {student.status === "dropped" && student.status_reason && (
            <span className="text-xs text-slate-500 dark:text-slate-400">Sababi: {student.status_reason}</span>
          )}
        </div>

        {renderActions && <div className="border-b border-slate-100 pb-4 dark:border-slate-800">{renderActions(student)}</div>}

        <ErrorMessage message={errorMsg} />
        <SuccessMessage message={successMsg} />

        {!hasAttendanceData ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Bu o'quvchi uchun davomat ma'lumoti yo'q.</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Tanlangan davr uchun dars topilmadi.</p>
        ) : (
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800/60">
            {lessons.map((l) => {
              const originalCell = grid?.cells.find(
                (c) => c.student_id === student.student_id && c.lesson_id === l.id,
              );
              const currentStatus = getCellStatus(l.id);
              const isModified = l.id in editedCells;
              const isFutureLesson = l.lesson_date > todayStr;

              return (
                <div key={l.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{l.lesson_date}</span>
                  <button
                    type="button"
                    disabled={isFutureLesson}
                    onClick={() => !isFutureLesson && handleCellClick(l.id)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform ${
                      isFutureLesson ? "cursor-not-allowed opacity-40" : "active:scale-90"
                    }`}
                    title={isFutureLesson ? "Kelgusi kunlar uchun davomat belgilab bo'lmaydi" : "Bosib holatni almashtiring"}
                  >
                    {renderAttendanceStatusCircle(currentStatus, originalCell?.is_trial, isModified)}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {modifiedLessonIds.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-2 dark:border-indigo-900/80 dark:bg-indigo-950/60">
            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              O'zgartirilgan: {modifiedLessonIds.length} ta
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
      </div>
    </Modal>
  );
}
