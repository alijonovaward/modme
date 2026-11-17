import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addStudentToGroup,
  getGroupAttendanceGrid,
  getGroupAttendanceStats,
  getGroupDetail,
  listStaffUsers,
  listStudents,
  listSubjects,
  updateGroup,
  updateGroupStatus,
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
  Pagination,
  SuccessMessage,
  Table,
  TdAction,
  usePagination,
} from "../../components/ui";
import { AttendanceCombinedTable } from "../../components/AttendanceGridView";
import { DateRangeFilterModal } from "../../components/DateRangeFilterModal";
import { useDateRangeFilter, type DateRange } from "../../hooks/useDateRangeFilter";
import type {
  AttendanceGrid,
  GroupDetail,
  GroupRosterItem,
  GroupStatus,
  GroupStudentStatus,
  StudentAttendanceStats,
  Subject,
  User,
} from "../../types";
import { Layout } from "../../components/Layout";
import { formatSchedule, WEEKDAYS } from "../../utils/weekdays";

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

const GROUP_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  archived: "red",
} as const;

const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  active: "Faol",
  frozen: "Muzlatilgan",
  archived: "Arxivlangan",
};

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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats[]>([]);
  const [attendanceGrid, setAttendanceGrid] = useState<AttendanceGrid | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<GroupStudentStatus | "">("");
  const [dropTarget, setDropTarget] = useState<GroupRosterItem | null>(null);
  const [dropReason, setDropReason] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editLessonPrice, setEditLessonPrice] = useState("");
  const [editScheduleDays, setEditScheduleDays] = useState<number[]>([]);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const attendanceFilter = useDateRangeFilter((range) => reloadAttendance(range));

  const reloadAttendance = async (range: DateRange = attendanceFilter.filters) => {
    try {
      const params = {
        date_from: range.dateFrom || undefined,
        date_to: range.dateTo || undefined,
      };
      const [gridData, statsData] = await Promise.all([
        getGroupAttendanceGrid(id, params),
        getGroupAttendanceStats(id, params),
      ]);
      setAttendanceGrid(gridData);
      setAttendanceStats(statsData);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [groupData, studentsData, subjectsData, teachersData] = await Promise.all([
        getGroupDetail(id),
        listStudents(),
        listSubjects(),
        listStaffUsers("teacher"),
      ]);
      setGroup(groupData);
      setAllStudents(studentsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
      await reloadAttendance();
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

  const handleGroupStatusChange = async (status: GroupStatus) => {
    setError(null);
    setSuccess(null);
    try {
      await updateGroupStatus(id, status);
      setSuccess("Guruh holati o'zgartirildi");
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const openEditModal = () => {
    if (!group) return;
    setEditName(group.name);
    setEditSubjectId(String(group.subject_id));
    setEditTeacherId(String(group.teacher_id));
    setEditLessonPrice(String(group.lesson_price));
    setEditScheduleDays(group.schedule.map((s) => s.weekday));
    setEditStartTime(group.schedule[0]?.start_time.slice(0, 5) ?? "");
    setEditEndTime(group.schedule[0]?.end_time.slice(0, 5) ?? "");
    setIsEditModalOpen(true);
  };

  const toggleEditScheduleDay = (weekday: number) => {
    setEditScheduleDays((prev) =>
      prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday],
    );
  };

  const handleEditSubmit = async () => {
    if (!editSubjectId || !editTeacherId) {
      setError("Fan va o'qituvchini tanlang");
      return;
    }
    if (editScheduleDays.length > 0 && (!editStartTime || !editEndTime)) {
      setError("Dars kunlarini tanlagan bo'lsangiz, boshlanish va tugash vaqtini kiriting");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await updateGroup(id, {
        name: editName,
        subject_id: Number(editSubjectId),
        teacher_id: Number(editTeacherId),
        lesson_price: Number(editLessonPrice),
        schedule: editScheduleDays.map((weekday) => ({
          weekday,
          start_time: editStartTime,
          end_time: editEndTime,
        })),
      });
      setSuccess("Guruh ma'lumotlari saqlandi");
      setIsEditModalOpen(false);
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

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredStudents);

  if (isLoading || !group) {
    return (
      <Layout>
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  const activeRosterStudentIds = new Set(
    group.students.filter((s) => s.status !== "dropped").map((s) => s.student_id),
  );
  const addableStudents = allStudents.filter((s) => !activeRosterStudentIds.has(s.id) && s.is_active);

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">{group.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={GROUP_STATUS_COLOR[group.status]}>{GROUP_STATUS_LABEL[group.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {group.subject_name} · {group.teacher_name} · {group.lesson_price.toLocaleString("uz-UZ")} so'm/dars
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{formatSchedule(group.schedule)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={openEditModal}>
            Tahrirlash
          </Button>
          {group.status !== "active" && (
            <Button variant="secondary" onClick={() => handleGroupStatusChange("active")}>
              Faollashtirish
            </Button>
          )}
          {group.status !== "frozen" && (
            <Button variant="secondary" onClick={() => handleGroupStatusChange("frozen")}>
              Muzlatish
            </Button>
          )}
          {group.status !== "archived" && (
            <Button variant="danger" onClick={() => handleGroupStatusChange("archived")}>
              Arxivlash
            </Button>
          )}
        </div>
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
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Table headers={["F.I.O", "Telefon", "Holat", ""]}>
            {pageItems.map((s) => (
              <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.student_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{s.student_phone}</td>
                <td className="px-3.5 py-2.5">
                  <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                  {s.status === "dropped" && s.status_reason && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sababi: {s.status_reason}</p>
                  )}
                </td>
                <TdAction>
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
                </TdAction>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
        </Card>

        <div className="mt-6">
          <Card
            title="Davomat"
            action={
              <Button variant="secondary" onClick={attendanceFilter.open}>
                Filterlar
              </Button>
            }
          >
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Davr: {attendanceFilter.filters.dateFrom || "..."} — {attendanceFilter.filters.dateTo || "..."}
            </p>
            <AttendanceCombinedTable grid={attendanceGrid} stats={attendanceStats} />
          </Card>
        </div>
      </div>

      <DateRangeFilterModal
        title="Davomat uchun filter"
        isOpen={attendanceFilter.isOpen}
        draft={attendanceFilter.draft}
        onChangeDraft={attendanceFilter.setDraft}
        onApply={attendanceFilter.apply}
        onClear={attendanceFilter.clear}
        onClose={attendanceFilter.close}
      />

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

      {isEditModalOpen && (
        <Modal title="Guruh ma'lumotlarini tahrirlash" onClose={() => setIsEditModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Guruh nomi</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <Label>Fan</Label>
              <Combobox
                value={editSubjectId}
                onChange={setEditSubjectId}
                placeholder="Fan qidirish..."
                options={subjects.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Combobox
                value={editTeacherId}
                onChange={setEditTeacherId}
                placeholder="O'qituvchi qidirish..."
                options={teachers
                  .filter((t) => t.is_active || String(t.id) === editTeacherId)
                  .map((t) => ({
                    value: String(t.id),
                    label: `${t.full_name} (${t.teacher_percentage}%)`,
                  }))}
              />
            </div>
            <div>
              <Label>1 dars narxi</Label>
              <Input
                type="number"
                value={editLessonPrice}
                onChange={(e) => setEditLessonPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Dars kunlari (ixtiyoriy)</Label>
              <div className="flex gap-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleEditScheduleDay(day.value)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      editScheduleDays.includes(day.value)
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            {editScheduleDays.length > 0 && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Boshlanish vaqti</Label>
                  <Input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <Label>Tugash vaqti</Label>
                  <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} required />
                </div>
              </div>
            )}
            <ErrorMessage message={error} />
            <Button className="w-full" onClick={handleEditSubmit}>
              Saqlash
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
