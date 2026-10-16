import { useEffect, useMemo, useState } from "react";
import {
  createLesson,
  deleteLesson,
  getLessonAttendance,
  listAllLessons,
  listGroups,
  listStaffUsers,
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
  Select,
  StatTile,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { AttendanceDetail, GroupListItem, LessonListItem, User } from "../../types";
import { Layout } from "../../components/Layout";

interface Filters {
  dateFrom: string;
  dateTo: string;
  groupId: string;
  teacherId: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  groupId: "",
  teacherId: "",
  status: "",
};

export function LessonsPage() {
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  const [newLessonDate, setNewLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailLesson, setDetailLesson] = useState<LessonListItem | null>(null);
  const [detailAttendance, setDetailAttendance] = useState<AttendanceDetail[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const load = async (filters: Filters) => {
    setIsLoading(true);
    try {
      const data = await listAllLessons({
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        status: filters.status ? (filters.status as "planned" | "completed") : undefined,
      });
      setLessons(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(appliedFilters);
    listGroups().then(setGroups).catch(() => undefined);
    listStaffUsers("teacher").then(setTeachers).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = () => {
    setDraft(appliedFilters);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draft);
    setIsModalOpen(false);
    load(draft);
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setIsModalOpen(false);
    load(EMPTY_FILTERS);
  };

  const handleCreateLesson = async () => {
    if (!newGroupId) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await createLesson(Number(newGroupId), newLessonDate);
      setSuccess("Dars qo'shildi");
      setIsCreateModalOpen(false);
      setNewGroupId("");
      await load(appliedFilters);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async (lesson: LessonListItem) => {
    if (!window.confirm(`${lesson.lesson_date} (${lesson.group_name}) darsini o'chirishni tasdiqlaysizmi?`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await deleteLesson(lesson.id);
      setSuccess("Dars o'chirildi");
      await load(appliedFilters);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const openDetail = async (lesson: LessonListItem) => {
    setDetailLesson(lesson);
    setIsDetailLoading(true);
    try {
      setDetailAttendance(await getLessonAttendance(lesson.id));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;

  const summary = useMemo(() => {
    const completed = lessons.filter((l) => l.status === "completed").length;
    const planned = lessons.filter((l) => l.status === "planned").length;
    return { total: lessons.length, completed, planned };
  }, [lessons]);

  const { page, setPage, pageCount, pageItems, total: pageTotal } = usePagination(lessons);

  return (
    <Layout>
      <Card
        title="Darslar"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setNewGroupId("");
                setNewLessonDate(new Date().toISOString().slice(0, 10));
                setIsCreateModalOpen(true);
              }}
            >
              + Dars qo'shish
            </Button>
            <Button onClick={openModal}>
              Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Jami darslar" value={String(summary.total)} color="indigo" />
          <StatTile label="O'tilgan" value={String(summary.completed)} color="green" />
          <StatTile label="Rejalashtirilgan" value={String(summary.planned)} color="amber" />
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Sana", "Guruh", "Fan", "O'qituvchi", "Holat", "Keldi", "Sababli", "Sababsiz", ""]}>
            {pageItems.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-slate-600">{l.lesson_date}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{l.group_name}</td>
                <td className="px-3 py-2 text-slate-600">{l.subject_name}</td>
                <td className="px-3 py-2 text-slate-600">{l.teacher_name}</td>
                <td className="px-3 py-2">
                  <Badge color={l.status === "completed" ? "green" : "slate"}>
                    {l.status === "completed" ? "O'tildi" : "Rejada"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-800">{l.present_count}</td>
                <td className="px-3 py-2 text-slate-600">{l.excused_count}</td>
                <td className="px-3 py-2 text-rose-600">{l.unexcused_count}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button variant="secondary" onClick={() => openDetail(l)}>
                      Batafsil
                    </Button>
                    {l.status === "planned" && (
                      <Button variant="danger" onClick={() => handleDeleteLesson(l)}>
                        O'chirish
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={pageTotal} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Holat</Label>
              <Select
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Barchasi</option>
                <option value="planned">Rejada</option>
                <option value="completed">O'tildi</option>
              </Select>
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={draft.groupId}
                onChange={(value) => setDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Combobox
                value={draft.teacherId}
                onChange={(value) => setDraft((prev) => ({ ...prev, teacherId: value }))}
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...teachers.map((t) => ({ value: String(t.id), label: t.full_name })),
                ]}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={applyFilters}>
                Qo'llash
              </Button>
              <Button variant="secondary" onClick={clearFilters}>
                Tozalash
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isCreateModalOpen && (
        <Modal title="Yangi dars qo'shish" onClose={() => setIsCreateModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={newGroupId}
                onChange={setNewGroupId}
                placeholder="Guruh qidirish..."
                options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
              />
            </div>
            <div>
              <Label>Sana</Label>
              <Input
                type="date"
                value={newLessonDate}
                onChange={(e) => setNewLessonDate(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newGroupId || isSubmitting}
              onClick={handleCreateLesson}
            >
              {isSubmitting ? "Saqlanmoqda..." : "Yaratish"}
            </Button>
          </div>
        </Modal>
      )}

      {detailLesson && (
        <Modal
          title={`${detailLesson.group_name} — ${detailLesson.lesson_date}`}
          onClose={() => setDetailLesson(null)}
        >
          <p className="mb-4 text-sm text-slate-500">
            {detailLesson.subject_name} · {detailLesson.teacher_name} ·{" "}
            <Badge color={detailLesson.status === "completed" ? "green" : "slate"}>
              {detailLesson.status === "completed" ? "O'tildi" : "Rejada"}
            </Badge>
          </p>
          {isDetailLoading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : detailAttendance.length === 0 ? (
            <p className="text-sm text-slate-500">Hali davomat olinmagan.</p>
          ) : (
            <Table headers={["O'quvchi", "Holat", "Baho"]}>
              {detailAttendance.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{a.student_name}</td>
                  <td className="px-3 py-2">
                    <Badge
                      color={
                        a.status === "present" ? "green" : a.status === "excused" ? "slate" : "red"
                      }
                    >
                      {a.status === "present"
                        ? "Keldi"
                        : a.status === "excused"
                          ? "Sababli"
                          : "Sababsiz"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{a.grade ?? "-"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Modal>
      )}
    </Layout>
  );
}
