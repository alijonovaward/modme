import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getGroupDetail,
  getLessonAttendance,
  submitAttendance,
  type AttendanceRecordInput,
} from "../../api/endpoints";
import { Button, Card, ErrorMessage, extractErrorMessage, Select, SuccessMessage, Table } from "../../components/ui";
import type { Attendance, AttendanceStatus, GroupDetail } from "../../types";
import { Layout } from "../../components/Layout";

interface RowState {
  status: AttendanceStatus;
  grade: string;
}

export function AttendancePage() {
  const { groupId, lessonId } = useParams<{ groupId: string; lessonId: string }>();
  const gId = Number(groupId);
  const lId = Number(lessonId);
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [existing, setExisting] = useState<Attendance[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getGroupDetail(gId), getLessonAttendance(lId)])
      .then(([groupData, attendanceData]) => {
        setGroup(groupData);
        setExisting(attendanceData);
        const initialRows: Record<number, RowState> = {};
        groupData.students
          .filter((s) => s.status !== "dropped")
          .forEach((s) => {
            const existingRecord = attendanceData.find((a) => a.student_id === s.student_id);
            initialRows[s.student_id] = {
              status: existingRecord?.status ?? "present",
              grade: existingRecord?.grade ? String(existingRecord.grade) : "",
            };
          });
        setRows(initialRows);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [gId, lId]);

  const isReadOnly = existing.length > 0;

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
            grade: row.status === "present" ? Number(row.grade) : null,
          };
        });
      await submitAttendance(lId, records);
      setSuccess("Davomat muvaffaqiyatli saqlandi");
      setTimeout(() => navigate(`/teacher/groups/${gId}`), 800);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !group) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  const activeStudents = group.students.filter((s) => s.status !== "dropped");

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{group.name} — Davomat</h1>
        {isReadOnly && (
          <p className="text-sm text-amber-600">
            Ushbu dars uchun davomat allaqachon qilingan, faqat ko'rish mumkin.
          </p>
        )}
      </div>
      <Card>
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />
        <Table headers={["O'quvchi", "Holat", "Baho"]}>
          {activeStudents.map((s) => {
            const row = rows[s.student_id];
            return (
              <tr key={s.student_id}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {s.student_name}
                  {s.status === "frozen" && (
                    <span className="ml-2 text-xs text-amber-600">(muzlatilgan)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Select
                    disabled={isReadOnly}
                    value={row?.status}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [s.student_id]: {
                          status: e.target.value as AttendanceStatus,
                          grade: e.target.value === "present" ? prev[s.student_id].grade : "",
                        },
                      }))
                    }
                  >
                    <option value="present">Keldi</option>
                    <option value="excused">Sababli kelmadi</option>
                    <option value="unexcused">Sababsiz kelmadi</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    disabled={isReadOnly || row?.status !== "present"}
                    value={row?.grade}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [s.student_id]: { ...prev[s.student_id], grade: e.target.value },
                      }))
                    }
                  >
                    <option value="">-</option>
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            );
          })}
        </Table>
        {!isReadOnly && (
          <div className="mt-4">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Davomatni saqlash"}
            </Button>
          </div>
        )}
      </Card>
    </Layout>
  );
}
