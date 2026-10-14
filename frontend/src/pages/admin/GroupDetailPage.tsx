import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addStudentToGroup,
  createLesson,
  getGroupDetail,
  listGroupLessons,
  listStudents,
  updateGroupStudentStatus,
} from "../../api/endpoints";
import { Badge, Button, Card, Combobox, ErrorMessage, extractErrorMessage, Input, SuccessMessage, Table } from "../../components/ui";
import type { GroupDetail, GroupStudentStatus, Lesson, User } from "../../types";
import { Layout } from "../../components/Layout";

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [lessonDate, setLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [groupData, lessonsData, studentsData] = await Promise.all([
        getGroupDetail(id),
        listGroupLessons(id),
        listStudents(),
      ]);
      setGroup(groupData);
      setLessons(lessonsData);
      setAllStudents(studentsData);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAddStudent = async () => {
    if (!selectedStudentId) return;
    setError(null);
    setSuccess(null);
    try {
      await addStudentToGroup(id, Number(selectedStudentId));
      setSuccess("O'quvchi guruhga qo'shildi");
      setSelectedStudentId("");
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleStatusChange = async (studentId: number, status: GroupStudentStatus) => {
    setError(null);
    setSuccess(null);
    try {
      await updateGroupStudentStatus(id, studentId, status);
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleCreateLesson = async () => {
    setError(null);
    setSuccess(null);
    try {
      await createLesson(id, lessonDate);
      setSuccess("Dars yaratildi");
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  if (isLoading || !group) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Layout>
    );
  }

  const rosterStudentIds = new Set(group.students.map((s) => s.student_id));
  const addableStudents = allStudents.filter((s) => !rosterStudentIds.has(s.id));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{group.name}</h1>
        <p className="text-sm text-slate-500">
          {group.subject_name} · {group.teacher_name} · {group.lesson_price.toLocaleString("uz-UZ")} so'm/dars
        </p>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="O'quvchilar ro'yxati">
          <div className="mb-4 flex gap-2">
            <Combobox
              className="flex-1"
              value={selectedStudentId}
              onChange={setSelectedStudentId}
              placeholder="O'quvchi qidirish..."
              options={addableStudents.map((s) => ({ value: String(s.id), label: s.full_name }))}
            />
            <Button onClick={handleAddStudent}>Qo'shish</Button>
          </div>
          <Table headers={["F.I.O", "Telefon", "Holat", ""]}>
            {group.students.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{s.student_phone}</td>
                <td className="px-3 py-2">
                  <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {s.status !== "active" && (
                      <Button variant="secondary" onClick={() => handleStatusChange(s.student_id, "active")}>
                        Aktiv
                      </Button>
                    )}
                    {s.status !== "frozen" && (
                      <Button variant="secondary" onClick={() => handleStatusChange(s.student_id, "frozen")}>
                        Freeze
                      </Button>
                    )}
                    {s.status !== "dropped" && (
                      <Button variant="danger" onClick={() => handleStatusChange(s.student_id, "dropped")}>
                        Chiqarish
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Darslar">
          <div className="mb-4 flex gap-2">
            <Input type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
            <Button onClick={handleCreateLesson}>Dars yaratish</Button>
          </div>
          <Table headers={["Sana", "Holat"]}>
            {lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-slate-800">{l.lesson_date}</td>
                <td className="px-3 py-2">
                  <Badge color={l.status === "completed" ? "green" : "slate"}>{l.status}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
