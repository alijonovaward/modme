import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createGroup, listGroups, listStaffUsers, listSubjects } from "../../api/endpoints";
import { downloadXlsx } from "../../utils/download";
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

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredGroups);

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
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            + Yangi guruh
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Guruh, fan yoki o'qituvchi nomi bo'yicha qidirish"
            className="max-w-md flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Combobox
            className="w-56"
            value={subjectFilter}
            onChange={setSubjectFilter}
            placeholder="Barcha fanlar"
            options={[
              { value: "", label: "Barcha fanlar" },
              ...subjects.map((s) => ({ value: String(s.id), label: s.name })),
            ]}
          />
          <Combobox
            className="w-56"
            value={teacherFilter}
            onChange={setTeacherFilter}
            placeholder="Barcha o'qituvchilar"
            options={[
              { value: "", label: "Barcha o'qituvchilar" },
              ...teachers.map((t) => ({ value: String(t.id), label: t.full_name })),
            ]}
          />
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
          <Table headers={["Nomi", "Fan", "O'qituvchi", "Dars narxi", "Jadval", "Holat", ""]}>
            {pageItems.map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{g.name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.subject_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.teacher_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {g.lesson_price.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{formatSchedule(g.schedule)}</td>
                <td className="px-3 py-2">
                  <Badge color={STATUS_COLOR[g.status]}>{g.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Link to={`/admin/groups/${g.id}`} className="text-sm text-indigo-600 hover:underline">
                    Batafsil
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

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
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
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
    </Layout>
  );
}
