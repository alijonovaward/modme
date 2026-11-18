import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createGroup,
  createSubject,
  deleteSubject,
  listGroups,
  listStaffUsers,
  listSubjects,
  updateSubject,
} from "../../api/endpoints";
import { downloadXlsx } from "../../utils/download";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ConfirmModal,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Pagination,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { GroupListItem, Subject, User } from "../../types";
import { Layout } from "../../components/Layout";
import { formatSchedule, WEEKDAYS } from "../../utils/weekdays";

const STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  archived: "slate",
} as const;

export function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [lessonPrice, setLessonPrice] = useState("");
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [draftSubjectFilter, setDraftSubjectFilter] = useState("");
  const [draftTeacherFilter, setDraftTeacherFilter] = useState("");

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectSuccess, setSubjectSuccess] = useState<string | null>(null);
  const [isSubjectSubmitting, setIsSubjectSubmitting] = useState(false);

  const reloadSubjects = async () => {
    try {
      const data = await listSubjects();
      setSubjects(data);
    } catch {
      // ignore
    }
  };

  const handleCreateSubjectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim() || isSubjectSubmitting) return;
    setSubjectError(null);
    setSubjectSuccess(null);
    setIsSubjectSubmitting(true);
    try {
      await createSubject(newSubjectName.trim());
      setSubjectSuccess("Yangi fan qo'shildi");
      setNewSubjectName("");
      await reloadSubjects();
    } catch (err) {
      setSubjectError(extractErrorMessage(err));
    } finally {
      setIsSubjectSubmitting(false);
    }
  };

  const handleUpdateSubjectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSubjectId || !editingSubjectName.trim() || isSubjectSubmitting) return;
    setSubjectError(null);
    setSubjectSuccess(null);
    setIsSubjectSubmitting(true);
    try {
      await updateSubject(editingSubjectId, editingSubjectName.trim());
      setSubjectSuccess("Fan nomi yangilandi");
      setEditingSubjectId(null);
      await reloadSubjects();
    } catch (err) {
      setSubjectError(extractErrorMessage(err));
    } finally {
      setIsSubjectSubmitting(false);
    }
  };

  const [deleteTargetSubject, setDeleteTargetSubject] = useState<Subject | null>(null);

  const confirmDeleteSubject = async () => {
    if (!deleteTargetSubject || isSubjectSubmitting) return;
    setSubjectError(null);
    setSubjectSuccess(null);
    setIsSubjectSubmitting(true);
    try {
      await deleteSubject(deleteTargetSubject.id);
      setSubjectSuccess("Fan o'chirildi");
      setDeleteTargetSubject(null);
      await reloadSubjects();
    } catch (err) {
      setSubjectError(extractErrorMessage(err));
    } finally {
      setIsSubjectSubmitting(false);
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [groupsData, subjectsData, teachersData] = await Promise.all([
        listGroups(),
        listSubjects(),
        listStaffUsers("teacher"),
      ]);
      setGroups(groupsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      const matchesSearch =
        !term ||
        g.name.toLowerCase().includes(term) ||
        g.subject_name.toLowerCase().includes(term) ||
        g.teacher_name.toLowerCase().includes(term);
      const matchesSubject = !subjectFilter || String(g.subject_id) === subjectFilter;
      const matchesTeacher = !teacherFilter || String(g.teacher_id) === teacherFilter;
      return matchesSearch && matchesSubject && matchesTeacher;
    });
  }, [groups, search, subjectFilter, teacherFilter]);

  const { page, setPage, pageCount, pageItems, total } = usePagination<GroupListItem>(filteredGroups);

  const resetForm = () => {
    setName("");
    setSubjectId("");
    setTeacherId("");
    setLessonPrice("");
    setScheduleDays([]);
    setStartTime("");
    setEndTime("");
    setError(null);
  };

  const toggleScheduleDay = (weekday: number) => {
    setScheduleDays((prev) =>
      prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday],
    );
  };

  const openFilterModal = () => {
    setDraftSubjectFilter(subjectFilter);
    setDraftTeacherFilter(teacherFilter);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setSubjectFilter(draftSubjectFilter);
    setTeacherFilter(draftTeacherFilter);
    setIsFilterModalOpen(false);
  };

  const clearFilters = () => {
    setDraftSubjectFilter("");
    setDraftTeacherFilter("");
    setSubjectFilter("");
    setTeacherFilter("");
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = [subjectFilter, teacherFilter].filter(Boolean).length;

  const filterTeacherOptions = draftSubjectFilter
    ? teachers.filter((t) =>
        groups.some((g) => String(g.subject_id) === draftSubjectFilter && g.teacher_id === t.id),
      )
    : teachers;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!subjectId || !teacherId) {
      setError("Fan va o'qituvchini tanlang");
      return;
    }
    if (scheduleDays.length > 0 && (!startTime || !endTime)) {
      setError("Dars kunlarini tanlagan bo'lsangiz, boshlanish va tugash vaqtini kiriting");
      return;
    }
    setIsSubmitting(true);
    try {
      await createGroup({
        name,
        subject_id: Number(subjectId),
        teacher_id: Number(teacherId),
        lesson_price: Number(lessonPrice),
        schedule: scheduleDays.map((weekday) => ({
          weekday,
          start_time: startTime,
          end_time: endTime,
        })),
      });
      setIsModalOpen(false);
      resetForm();
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Card
        title="Guruhlar ro'yxati"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setSubjectError(null);
                setSubjectSuccess(null);
                setIsSubjectModalOpen(true);
              }}
            >
              Fanlar ({subjects.length})
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
            >
              + Yangi guruh
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Guruh, fan yoki o'qituvchi nomi bo'yicha qidirish"
            className="flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" onClick={openFilterModal}>
            Filterlar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadXlsx(
                "/api/v1/groups/export",
                { teacher_id: teacherFilter ? Number(teacherFilter) : undefined },
                "guruhlar.xlsx",
              )
            }
          >
            Excel'ga chiqarish
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Nomi", "Fan", "O'qituvchi", "Dars narxi", "Jadval", "Holat"]}>
            {pageItems.map((g: GroupListItem) => (
              <tr
                key={g.id}
                onClick={() => navigate(`/admin/groups/${g.id}`)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{g.name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{g.subject_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{g.teacher_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {g.lesson_price.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{formatSchedule(g.schedule)}</td>
                <td className="px-3.5 py-2.5">
                  <Badge color={STATUS_COLOR[g.status]}>{g.status}</Badge>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isFilterModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsFilterModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Fan bo'yicha filter</Label>
              <Combobox
                value={draftSubjectFilter}
                onChange={(value) => {
                  setDraftSubjectFilter(value);
                  setDraftTeacherFilter("");
                }}
                placeholder="Barcha fanlar"
                options={[
                  { value: "", label: "Barcha fanlar" },
                  ...subjects.map((s) => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
            <div>
              <Label>O'qituvchi bo'yicha filter</Label>
              <Combobox
                value={draftTeacherFilter}
                onChange={setDraftTeacherFilter}
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...filterTeacherOptions.map((t) => ({ value: String(t.id), label: t.full_name })),
                ]}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={clearFilters}>
                Tozalash
              </Button>
              <Button onClick={applyFilters}>Qo'llash</Button>
            </div>
          </div>
        </Modal>
      )}

      {isModalOpen && (
        <Modal title="Yangi guruh ochish" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Guruh nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Fan</Label>
              <Combobox
                value={subjectId}
                onChange={setSubjectId}
                placeholder="Fan qidirish..."
                options={subjects.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Combobox
                value={teacherId}
                onChange={setTeacherId}
                placeholder="O'qituvchi qidirish..."
                options={teachers
                  .filter((t) => t.is_active)
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
                value={lessonPrice}
                onChange={(e) => setLessonPrice(e.target.value)}
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
                    onClick={() => toggleScheduleDay(day.value)}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      scheduleDays.includes(day.value)
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            {scheduleDays.length > 0 && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Boshlanish vaqti</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <div className="flex-1">
                  <Label>Tugash vaqti</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
            )}
            <ErrorMessage message={error} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Yaratish"}
            </Button>
          </form>
        </Modal>
      )}

      {isSubjectModalOpen && (
        <Modal
          title="Fanlarni boshqarish"
          onClose={() => {
            setIsSubjectModalOpen(false);
            setEditingSubjectId(null);
            setSubjectError(null);
            setSubjectSuccess(null);
          }}
        >
          <div className="space-y-4">
            <ErrorMessage message={subjectError} />
            <SuccessMessage message={subjectSuccess} />

            <form onSubmit={handleCreateSubjectSubmit} className="flex gap-2">
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Yangi fan nomi..."
                required
                className="flex-1"
              />
              <Button type="submit" disabled={isSubjectSubmitting}>
                Qo'shish
              </Button>
            </form>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200/80 divide-y divide-slate-100 p-1 dark:border-slate-800 dark:divide-slate-800">
              {subjects.length === 0 ? (
                <p className="p-3 text-center text-xs text-slate-400">Hali fanlar yo'q</p>
              ) : (
                subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2">
                    {editingSubjectId === s.id ? (
                      <form onSubmit={handleUpdateSubjectSubmit} className="flex flex-1 items-center gap-2 pr-1">
                        <Input
                          value={editingSubjectName}
                          onChange={(e) => setEditingSubjectName(e.target.value)}
                          required
                          className="flex-1 py-1 text-xs"
                        />
                        <Button type="submit" disabled={isSubjectSubmitting} className="px-2.5 py-1 text-xs">
                          Saqlash
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingSubjectId(null)}
                          className="px-2.5 py-1 text-xs"
                        >
                          ✕
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubjectId(s.id);
                              setEditingSubjectName(s.name);
                            }}
                            className="rounded-lg p-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="Tahrirlash"
                          >
                            ✏️ Tahrirlash
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetSubject(s)}
                            className="rounded-lg p-1.5 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            title="O'chirish"
                          >
                            🗑️ O'chirish
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={deleteTargetSubject !== null}
        title="Fanni o'chirish"
        message={
          deleteTargetSubject ? `'${deleteTargetSubject.name}' fanini o'chirishni tasdiqlaysizmi?` : ""
        }
        confirmLabel="O'chirish"
        isLoading={isSubjectSubmitting}
        onConfirm={confirmDeleteSubject}
        onClose={() => setDeleteTargetSubject(null)}
      />
    </Layout>
  );
}
