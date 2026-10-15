import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addStudentToGroup,
  getGroupDetail,
  listStudents,
  updateGroupStudentStatus,
} from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  SuccessMessage,
  Table,
} from "../../components/ui";
import type { GroupDetail, GroupRosterItem, GroupStudentStatus, User } from "../../types";
import { Layout } from "../../components/Layout";

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

const STATUS_TABS: { value: GroupStudentStatus | ""; label: string }[] = [
  { value: "", label: "Hammasi" },
  { value: "active", label: "Faol" },
  { value: "frozen", label: "Muzlatilgan" },
  { value: "dropped", label: "Arxiv" },
];

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<GroupStudentStatus | "">("");
  const [dropTarget, setDropTarget] = useState<GroupRosterItem | null>(null);
  const [dropReason, setDropReason] = useState("");

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [groupData, studentsData] = await Promise.all([
        getGroupDetail(id),
        listStudents(),
      ]);
      setGroup(groupData);
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

  const handleConfirmDrop = async () => {
    if (!dropTarget || !dropReason.trim()) return;
    setError(null);
    setSuccess(null);
    try {
      await updateGroupStudentStatus(id, dropTarget.student_id, "dropped", dropReason.trim());
      setSuccess("O'quvchi arxivga o'tkazildi");
      setDropTarget(null);
      setDropReason("");
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const filteredStudents = useMemo(() => {
    if (!group) return [];
    if (!statusFilter) return group.students;
    return group.students.filter((s) => s.status === statusFilter);
  }, [group, statusFilter]);

  if (isLoading || !group) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Layout>
    );
  }

  const activeRosterStudentIds = new Set(
    group.students.filter((s) => s.status !== "dropped").map((s) => s.student_id),
  );
  const addableStudents = allStudents.filter((s) => !activeRosterStudentIds.has(s.id));

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

      <div>
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

          <div className="mb-3 flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Table headers={["F.I.O", "Telefon", "Holat", ""]}>
            {filteredStudents.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{s.student_phone}</td>
                <td className="px-3 py-2">
                  <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                  {s.status === "dropped" && s.status_reason && (
                    <p className="mt-1 text-xs text-slate-500">Sababi: {s.status_reason}</p>
                  )}
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
                      <Button
                        variant="danger"
                        onClick={() => {
                          setDropTarget(s);
                          setDropReason("");
                        }}
                      >
                        Chiqarish
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {dropTarget && (
        <Modal title={`${dropTarget.student_name} ni guruhdan chiqarish`} onClose={() => setDropTarget(null)}>
          <div className="space-y-4">
            <div>
              <Label>Sabab</Label>
              <Input
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="Masalan: oilaviy sabablarga ko'ra"
                required
              />
            </div>
            <Button className="w-full" variant="danger" disabled={!dropReason.trim()} onClick={handleConfirmDrop}>
              Chiqarish
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
