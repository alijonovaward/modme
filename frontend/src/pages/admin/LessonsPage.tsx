import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createLesson,
  deleteLesson,
  generateGroupLessons,
  getLessonAttendance,
  listAllLessons,
  listGroups,
  listStaffUsers,
  listSubjects,
} from "../../api/endpoints";
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
  PAGE_SIZE,
  Pagination,
  Select,
  StatTile,
  SuccessMessage,
  Table,
} from "../../components/ui";
import type { AttendanceDetail, GroupListItem, LessonListItem, Subject, User } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange, getWeekDays, toLocalISODate } from "../../utils/date";
import { downloadXlsx } from "../../utils/download";

const WEEKDAY_SHORT = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];
const MONTH_NAMES_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

interface Filters {
  dateFrom: string;
  dateTo: string;
  groupId: string;
  teacherId: string;
  subjectId: string;
  status: string;
}

const DEFAULT_FILTERS: Filters = {
  ...currentMonthRange(),
  groupId: "",
  teacherId: "",
  subjectId: "",
  status: "",
};

export function LessonsPage() {
  const [searchParams] = useSearchParams();
  const groupIdFromUrl = searchParams.get("group_id");
  const initialFilters: Filters = groupIdFromUrl
    ? { dateFrom: "", dateTo: "", groupId: groupIdFromUrl, teacherId: "", subjectId: "", status: "" }
    : DEFAULT_FILTERS;

  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  const [newLessonDate, setNewLessonDate] = useState(() => toLocalISODate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateGroupId, setGenerateGroupId] = useState("");
  const [generateFrom, setGenerateFrom] = useState(() => currentMonthRange().dateFrom);
  const [generateTo, setGenerateTo] = useState(() => currentMonthRange().dateTo);
  const [isGenerating, setIsGenerating] = useState(false);

  const [detailLesson, setDetailLesson] = useState<LessonListItem | null>(null);
  const [detailAttendance, setDetailAttendance] = useState<AttendanceDetail[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ completed: 0, planned: 0 });

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [weekBaseDate, setWeekBaseDate] = useState<Date>(() => new Date());

  const weekDays = useMemo(() => getWeekDays(weekBaseDate), [weekBaseDate]);
  const weekStartStr = useMemo(() => toLocalISODate(weekDays[0]), [weekDays]);
  const weekEndStr = useMemo(() => toLocalISODate(weekDays[6]), [weekDays]);
  const todayStr = useMemo(() => toLocalISODate(new Date()), []);

  const [weeklyLessons, setWeeklyLessons] = useState<LessonListItem[]>([]);

  const loadWeeklyLessons = async (filters: Filters) => {
    setIsLoading(true);
    try {
      const data = await listAllLessons({
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        date_from: weekStartStr,
        date_to: weekEndStr,
        status: filters.status ? (filters.status as "planned" | "completed") : undefined,
        page: 1,
        page_size: 100,
      });
      setWeeklyLessons(data.items);
      setSummary({ completed: data.completed_count, planned: data.planned_count });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevWeek = () => {
    setWeekBaseDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setWeekBaseDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  const handleTodayWeek = () => {
    setWeekBaseDate(new Date());
  };

  const load = async (filters: Filters, pageArg: number) => {
    setIsLoading(true);
    try {
      const data = await listAllLessons({
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        status: filters.status ? (filters.status as "planned" | "completed") : undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setLessons(data.items);
      setTotal(data.total);
      setSummary({ completed: data.completed_count, planned: data.planned_count });
      setPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "calendar") {
      loadWeeklyLessons(appliedFilters);
    } else {
      load(appliedFilters, 1);
    }
    listGroups().then(setGroups).catch(() => undefined);
    listStaffUsers("teacher").then(setTeachers).catch(() => undefined);
    listSubjects().then(setSubjects).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekStartStr, weekEndStr]);

  const openModal = () => {
    setDraft(appliedFilters);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draft);
    setIsModalOpen(false);
    if (viewMode === "calendar") {
      loadWeeklyLessons(draft);
    } else {
      load(draft, 1);
    }
  };

  const clearFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setIsModalOpen(false);
    if (viewMode === "calendar") {
      loadWeeklyLessons(DEFAULT_FILTERS);
    } else {
      load(DEFAULT_FILTERS, 1);
    }
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
      await load(appliedFilters, page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateLessons = async () => {
    if (!generateGroupId) return;
    setError(null);
    setSuccess(null);
    setIsGenerating(true);
    try {
      const result = await generateGroupLessons(Number(generateGroupId), generateFrom, generateTo);
      setSuccess(
        `${result.created_count} ta dars yaratildi, ${result.skipped_count} ta allaqachon mavjud edi`,
      );
      setIsGenerateModalOpen(false);
      await load(appliedFilters, page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const [deleteTargetLesson, setDeleteTargetLesson] = useState<LessonListItem | null>(null);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);

  const confirmDeleteLesson = async () => {
    if (!deleteTargetLesson || isDeletingLesson) return;
    setError(null);
    setSuccess(null);
    setIsDeletingLesson(true);
    try {
      await deleteLesson(deleteTargetLesson.id);
      setSuccess("Dars o'chirildi");
      setDetailLesson(null);
      setDeleteTargetLesson(null);
      if (viewMode === "calendar") {
        await loadWeeklyLessons(appliedFilters);
      } else {
        await load(appliedFilters, page);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsDeletingLesson(false);
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

  const activeCount = [appliedFilters.groupId, appliedFilters.teacherId, appliedFilters.status].filter(
    Boolean,
  ).length;

  const filterTeacherOptions = draft.subjectId
    ? teachers.filter((t) =>
        groups.some((g) => String(g.subject_id) === draft.subjectId && g.teacher_id === t.id),
      )
    : teachers;

  const filterGroupOptions = groups.filter(
    (g) =>
      (!draft.subjectId || String(g.subject_id) === draft.subjectId) &&
      (!draft.teacherId || String(g.teacher_id) === draft.teacherId),
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const handlePageChange = (nextPage: number) => {
    load(appliedFilters, nextPage);
  };

  return (
    <Layout>
      <Card
        title="Darslar"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setNewGroupId("");
                setNewLessonDate(toLocalISODate(new Date()));
                setIsCreateModalOpen(true);
              }}
            >
              + Dars qo'shish
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setGenerateGroupId("");
                setGenerateFrom(currentMonthRange().dateFrom);
                setGenerateTo(currentMonthRange().dateTo);
                setIsGenerateModalOpen(true);
              }}
            >
              Darslarni generatsiya qilish
            </Button>
            <Button onClick={openModal}>
              Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadXlsx(
                  "/api/v1/lessons/export",
                  {
                    group_id: appliedFilters.groupId ? Number(appliedFilters.groupId) : undefined,
                    teacher_id: appliedFilters.teacherId ? Number(appliedFilters.teacherId) : undefined,
                    date_from: appliedFilters.dateFrom || undefined,
                    date_to: appliedFilters.dateTo || undefined,
                    status: appliedFilters.status || undefined,
                  },
                  "darslar.xlsx",
                )
              }
            >
              Excel'ga chiqarish
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />
        {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {appliedFilters.dateFrom || "..."} — {appliedFilters.dateTo || "..."}
          </p>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Jami darslar" value={String(total)} color="indigo" />
          <StatTile label="O'tilgan" value={String(summary.completed)} color="green" />
          <StatTile label="Rejalashtirilgan" value={String(summary.planned)} color="amber" />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex select-none rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "calendar"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              📅 Haftalik jadval
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              📋 Ro'yxat
            </button>
          </div>

          {viewMode === "calendar" && (
            <div className="flex select-none items-center gap-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                title="O'tgan hafta"
              >
                ◀
              </button>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {weekDays[0].getDate()}-{MONTH_NAMES_UZ[weekDays[0].getMonth()]} – {weekDays[6].getDate()}-{MONTH_NAMES_UZ[weekDays[6].getMonth()]}, {weekDays[0].getFullYear()}
              </span>
              <button
                type="button"
                onClick={handleNextWeek}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Keyingi hafta"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={handleTodayWeek}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-95 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300"
              >
                Joriy hafta
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : viewMode === "calendar" ? (
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <th className="sticky left-0 z-20 w-16 min-w-[64px] bg-slate-50/95 px-2 py-3 text-center shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-900/95">
                    Vaqt
                  </th>
                  {weekDays.map((dayDate: Date, idx: number) => {
                    const dayStr = toLocalISODate(dayDate);
                    const isToday = dayStr === todayStr;
                    return (
                      <th
                        key={dayStr}
                        className={`min-w-[130px] px-3 py-2.5 text-center ${
                          isToday ? "bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                            {WEEKDAY_SHORT[idx]}
                          </span>
                          <span className={`text-xs font-bold ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"}`}>
                            {dayDate.getDate()} {MONTH_NAMES_UZ[dayDate.getMonth()].slice(0, 3)}
                          </span>
                          {isToday && (
                            <span className="mt-0.5 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-sm">
                              Bugun
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {HOURS.map((hour) => {
                  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
                  return (
                    <tr key={hour} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="sticky left-0 z-10 w-16 min-w-[64px] bg-slate-50/95 px-2 py-3 text-center text-[11px] font-bold text-slate-400 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:bg-slate-900/95 dark:text-slate-500">
                        {hourLabel}
                      </td>
                      {weekDays.map((dayDate: Date) => {
                        const dayStr = toLocalISODate(dayDate);
                        const isToday = dayStr === todayStr;
                        const slotLessons = weeklyLessons.filter((l) => {
                          if (l.lesson_date !== dayStr) return false;
                          if (!l.start_time) return false;
                          const startHour = parseInt(l.start_time.split(":")[0], 10);
                          return startHour === hour;
                        });

                        return (
                          <td
                            key={dayStr}
                            className={`min-w-[130px] p-1.5 align-top border-l border-slate-100 dark:border-slate-800/40 ${
                              isToday ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                            }`}
                          >
                            {slotLessons.map((l) => {
                              const isCompleted = l.status === "completed";
                              return (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => openDetail(l)}
                                  className={`mb-1 flex w-full flex-col rounded-xl border p-2 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${
                                    isCompleted
                                      ? "border-emerald-200 bg-emerald-50/90 hover:bg-emerald-100/90 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50"
                                      : "border-indigo-200 bg-white hover:bg-indigo-50/80 dark:border-indigo-900/60 dark:bg-slate-900 dark:hover:bg-indigo-950/50"
                                  }`}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                      ⏰ {l.start_time ? l.start_time.slice(0, 5) : "--:--"}–{l.end_time ? l.end_time.slice(0, 5) : "--:--"}
                                    </span>
                                    <span
                                      className={`inline-block h-2 w-2 rounded-full ${
                                        isCompleted ? "bg-emerald-500" : "bg-amber-400"
                                      }`}
                                      title={isCompleted ? "O'tildi" : "Rejada"}
                                    />
                                  </div>
                                  <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                                    {l.group_name}
                                  </p>
                                  <p className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                    {l.subject_name}
                                  </p>
                                  {l.teacher_name && (
                                    <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                                      👤 {l.teacher_name}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
          <Table headers={["Sana", "Guruh", "Fan", "O'qituvchi", "Holat"]}>
            {lessons.map((l) => (
              <tr
                key={l.id}
                onClick={() => openDetail(l)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{l.lesson_date}</td>
                <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{l.group_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{l.subject_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{l.teacher_name}</td>
                <td className="px-3.5 py-2.5">
                  <Badge color={l.status === "completed" ? "green" : "slate"}>
                    {l.status === "completed" ? "O'tildi" : "Rejada"}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={handlePageChange} />
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
              <Label>Fan</Label>
              <Combobox
                value={draft.subjectId}
                onChange={(value) =>
                  setDraft((prev) => ({ ...prev, subjectId: value, teacherId: "", groupId: "" }))
                }
                placeholder="Barcha fanlar"
                options={[
                  { value: "", label: "Barcha fanlar" },
                  ...subjects.map((s) => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Combobox
                value={draft.teacherId}
                onChange={(value) => setDraft((prev) => ({ ...prev, teacherId: value, groupId: "" }))}
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...filterTeacherOptions.map((t) => ({ value: String(t.id), label: t.full_name })),
                ]}
              />
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={draft.groupId}
                onChange={(value) => setDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...filterGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2">
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

      {isGenerateModalOpen && (
        <Modal title="Darslarni generatsiya qilish" onClose={() => setIsGenerateModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={generateGroupId}
                onChange={setGenerateGroupId}
                placeholder="Guruh qidirish..."
                options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
              />
            </div>
            <div>
              <Label>Boshlanish sanasi</Label>
              <Input
                type="date"
                value={generateFrom}
                onChange={(e) => setGenerateFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Tugash sanasi</Label>
              <Input
                type="date"
                value={generateTo}
                onChange={(e) => setGenerateTo(e.target.value)}
                required
              />
            </div>
            <Button
              className="w-full"
              disabled={!generateGroupId || isGenerating}
              onClick={handleGenerateLessons}
            >
              {isGenerating ? "Yaratilmoqda..." : "Generatsiya qilish"}
            </Button>
          </div>
        </Modal>
      )}

      {detailLesson && (
        <Modal
          title={`${detailLesson.group_name} — ${detailLesson.lesson_date}`}
          onClose={() => setDetailLesson(null)}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {detailLesson.subject_name} · {detailLesson.teacher_name} ·{" "}
              <Badge color={detailLesson.status === "completed" ? "green" : "slate"}>
                {detailLesson.status === "completed" ? "O'tildi" : "Rejada"}
              </Badge>
            </p>
            {detailLesson.status === "planned" && (
              <Button variant="danger" onClick={() => setDeleteTargetLesson(detailLesson)}>
                O'chirish
              </Button>
            )}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Keldi</p>
              <p className="mt-0.5 text-base font-bold text-emerald-800 dark:text-emerald-300">🟢 {detailLesson.present_count}</p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Sababli</p>
              <p className="mt-0.5 text-base font-bold text-amber-800 dark:text-amber-300">🟡 {detailLesson.excused_count}</p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-2.5 dark:border-rose-900/60 dark:bg-rose-950/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Sababsiz</p>
              <p className="mt-0.5 text-base font-bold text-rose-800 dark:text-rose-300">🔴 {detailLesson.unexcused_count}</p>
            </div>
          </div>
          {isDetailLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
          ) : detailAttendance.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Hali davomat olinmagan.</p>
          ) : (
            <Table headers={["O'quvchi", "Holat", "Test natijasi"]}>
              {detailAttendance.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{a.student_name}</td>
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
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{a.total_count != null ? `${a.correct_count}/${a.total_count}` : "-"}</span>
                      {a.is_trial && <Badge color="amber">Sinov</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Modal>
      )}

      <ConfirmModal
        isOpen={deleteTargetLesson !== null}
        title="Darsni o'chirish"
        message={
          deleteTargetLesson
            ? `${deleteTargetLesson.lesson_date} dagi '${deleteTargetLesson.group_name}' darsini o'chirishni tasdiqlaysizmi?`
            : ""
        }
        confirmLabel="O'chirish"
        isLoading={isDeletingLesson}
        onConfirm={confirmDeleteLesson}
        onClose={() => setDeleteTargetLesson(null)}
      />
    </Layout>
  );
}
