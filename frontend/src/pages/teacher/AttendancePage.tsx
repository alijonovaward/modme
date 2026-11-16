import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getGroupDetail,
  getLessonAttendance,
  submitAttendance,
  updateAttendance,
  type AttendanceRecordInput,
} from "../../api/endpoints";
import {
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  SuccessMessage,
  Table,
} from "../../components/ui";
import type { Attendance, AttendanceStatus, GroupDetail } from "../../types";
import { Layout } from "../../components/Layout";

interface RowState {
  status: AttendanceStatus;
  correctCount: string;
  totalCount: string;
  isTrial: boolean;
}

export function AttendancePage() {
  const { groupId, lessonId } = useParams<{ groupId: string; lessonId: string }>();
  const gId = Number(groupId);
  const lId = Number(lessonId);
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [existing, setExisting] = useState<Attendance[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [initialRows, setInitialRows] = useState<Record<number, RowState>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    setIsLoading(true);
    return Promise.all([getGroupDetail(gId), getLessonAttendance(lId)])
      .then(([groupData, attendanceData]) => {
        setGroup(groupData);
        setExisting(attendanceData);
        const nextRows: Record<number, RowState> = {};
        groupData.students
          .filter((s) => s.status !== "dropped")
          .forEach((s) => {
            const existingRecord = attendanceData.find((a) => a.student_id === s.student_id);
            nextRows[s.student_id] = {
              status: existingRecord?.status ?? "present",
              correctCount:
                existingRecord?.correct_count != null ? String(existingRecord.correct_count) : "",
              totalCount:
                existingRecord?.total_count != null ? String(existingRecord.total_count) : "",
              isTrial: existingRecord?.is_trial ?? false,
            };
          });
        setRows(nextRows);
        setInitialRows(nextRows);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gId, lId]);

  const isEditMode = existing.length > 0;

  const markAllPresent = () => {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const id = Number(k);
        next[id] = { ...next[id], status: "present" };
      });
      return next;
    });
  };

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        correctCount: status === "present" ? prev[studentId].correctCount : "",
        totalCount: status === "present" ? prev[studentId].totalCount : "",
      },
    }));
  };

  const handleSubmit = async () => {
    if (!group) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const records: AttendanceRecordInput[] = group.students
        .filter((s) => s.status !== "dropped")
        .map((s) => {
          const row = rows[s.student_id];
          return {
            student_id: s.student_id,
            status: row.status,
            correct_count: row.status === "present" ? Number(row.correctCount) : null,
            total_count: row.status === "present" ? Number(row.totalCount) : null,
            is_trial: row.isTrial,
          };
        });
      await submitAttendance(lId, records);
      setSuccess("Davomat muvaffaqiyatli saqlandi ✨");
      setTimeout(() => navigate(`/teacher/groups/${gId}`), 800);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCorrections = async () => {
    if (!group) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const changedStudentIds = Object.keys(rows)
        .map(Number)
        .filter((studentId) => {
          const row = rows[studentId];
          const initial = initialRows[studentId];
          return (
            row.status !== initial.status ||
            row.correctCount !== initial.correctCount ||
            row.totalCount !== initial.totalCount ||
            row.isTrial !== initial.isTrial
          );
        });

      if (changedStudentIds.length === 0) {
        setIsSubmitting(false);
        return;
      }

      await Promise.all(
        changedStudentIds.map((studentId) => {
          const row = rows[studentId];
          return updateAttendance(lId, studentId, {
            status: row.status,
            correct_count: row.status === "present" ? Number(row.correctCount) : null,
            total_count: row.status === "present" ? Number(row.totalCount) : null,
            is_trial: row.isTrial,
          });
        }),
      );
      setSuccess("Tuzatishlar saqlandi ✨");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges = Object.keys(rows).some((key) => {
    const studentId = Number(key);
    const row = rows[studentId];
    const initial = initialRows[studentId];
    return (
      initial &&
      (row.status !== initial.status ||
        row.correctCount !== initial.correctCount ||
        row.totalCount !== initial.totalCount ||
        row.isTrial !== initial.isTrial)
    );
  });

  if (isLoading || !group) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <div className="flex animate-pulse flex-col gap-4">
          <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </Layout>
    );
  }

  const activeStudents = group.students.filter((s) => s.status !== "dropped");

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {group.name} — Davomat
          </h1>
          {isEditMode && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Ushbu dars uchun davomat belgilangan. 24 soat ichida tuzatish kiritishingiz mumkin.
            </p>
          )}
        </div>
        <button
          onClick={markAllPresent}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
        >
          <span>✓</span> Barchasini "Keldi" qilish
        </button>
      </div>

      <Card>
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />

        <Table headers={["O'quvchi", "Holat", "Test natijasi", "Sinov darsi"]}>
          {activeStudents.map((s) => {
            const row = rows[s.student_id];
            return (
              <tr key={s.student_id}>
                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                  {s.student_name}
                  {s.status === "frozen" && (
                    <span className="ml-2 text-xs text-amber-600 font-medium">(muzlatilgan)</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setStatus(s.student_id, "present")}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        row?.status === "present"
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      🟢 Keldi
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(s.student_id, "excused")}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        row?.status === "excused"
                          ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      🟡 Sababli
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(s.student_id, "unexcused")}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        row?.status === "unexcused"
                          ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      🔴 Sababsiz
                    </button>
                  </div>
                  {/* Hidden select for test compatibility and accessibility */}
                  <select
                    aria-label="Holat"
                    value={row?.status}
                    onChange={(e) => setStatus(s.student_id, e.target.value as AttendanceStatus)}
                    className="sr-only"
                  >
                    <option value="present">Keldi</option>
                    <option value="excused">Sababli kelmadi</option>
                    <option value="unexcused">Sababsiz kelmadi</option>
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="w-16 py-1 text-center text-xs"
                      disabled={row?.status !== "present"}
                      value={row?.correctCount}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [s.student_id]: { ...prev[s.student_id], correctCount: e.target.value },
                        }))
                      }
                    />
                    <span className="text-slate-400">/</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-16 py-1 text-center text-xs"
                      disabled={row?.status !== "present"}
                      value={row?.totalCount}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [s.student_id]: { ...prev[s.student_id], totalCount: e.target.value },
                        }))
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={row?.isTrial ?? false}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [s.student_id]: { ...prev[s.student_id], isTrial: e.target.checked },
                      }))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </Table>

        <div className="mt-6 flex justify-end">
          {isEditMode ? (
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveCorrections}
              disabled={isSubmitting || !hasChanges}
            >
              {isSubmitting ? "Saqlanmoqda..." : "Tuzatishlarni saqlash"}
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Davomatni saqlash"}
            </Button>
          )}
        </div>
      </Card>
    </Layout>
  );
}
