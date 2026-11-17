import { useEffect, useState } from "react";
import {
  getStatsOverview,
  listGroups,
  listStaffUsers,
  listStudents,
  listSubjects,
} from "../../api/endpoints";
import {
  Button,
  Card,
  Combobox,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  PrivacyToggle,
  StatTile,
  usePrivacyMode,
} from "../../components/ui";
import type { GroupListItem, StatsOverview, Subject, User } from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";

function formatSom(amount: number): string {
  return `${amount.toLocaleString("uz-UZ")} so'm`;
}

const DEFAULT_FILTERS = {
  ...currentMonthRange(),
  subjectId: "",
  groupId: "",
  teacherId: "",
  studentId: "",
};

export function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState(DEFAULT_FILTERS.dateFrom);
  const [dateTo, setDateTo] = useState(DEFAULT_FILTERS.dateTo);
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  const load = async (filters: typeof appliedFilters) => {
    setIsLoading(true);
    try {
      const data = await getStatsOverview({
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        student_id: filters.studentId ? Number(filters.studentId) : undefined,
      });
      setStats(data);
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
    listStudents().then(setStudents).catch(() => undefined);
    listSubjects().then(setSubjects).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = () => {
    setDateFrom(appliedFilters.dateFrom);
    setDateTo(appliedFilters.dateTo);
    setSubjectId(appliedFilters.subjectId);
    setGroupId(appliedFilters.groupId);
    setTeacherId(appliedFilters.teacherId);
    setStudentId(appliedFilters.studentId);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    const next = { dateFrom, dateTo, subjectId, groupId, teacherId, studentId };
    setAppliedFilters(next);
    setIsModalOpen(false);
    load(next);
  };

  const clearFilters = () => {
    setDateFrom(DEFAULT_FILTERS.dateFrom);
    setDateTo(DEFAULT_FILTERS.dateTo);
    setSubjectId("");
    setGroupId("");
    setTeacherId("");
    setStudentId("");
    setAppliedFilters(DEFAULT_FILTERS);
    setIsModalOpen(false);
    load(DEFAULT_FILTERS);
  };

  const filterTeacherOptions = subjectId
    ? teachers.filter((t) =>
        groups.some((g) => String(g.subject_id) === subjectId && g.teacher_id === t.id),
      )
    : teachers;

  const filterGroupOptions = groups.filter(
    (g) =>
      (!subjectId || String(g.subject_id) === subjectId) &&
      (!teacherId || String(g.teacher_id) === teacherId),
  );

  const activeCount = [appliedFilters.groupId, appliedFilters.teacherId, appliedFilters.studentId].filter(
    Boolean,
  ).length;

  const { isPrivate, togglePrivacy } = usePrivacyMode();

  return (
    <Layout>
      <Card
        title="Statistika"
        action={
          <div className="flex items-center gap-2">
            <PrivacyToggle isPrivate={isPrivate} onToggle={togglePrivacy} />
            <Button onClick={openModal}>
              Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {appliedFilters.dateFrom || "..."} — {appliedFilters.dateTo || "..."}
          </p>
        )}
        {isLoading || !stats ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="O'quvchilardan jami tushgani"
                value={formatSom(stats.total_deposits)}
                color="green"
                isPrivate={isPrivate}
              />
              <StatTile
                label="O'quvchilar balansida qolgani"
                value={formatSom(stats.total_student_balance)}
                color="indigo"
                isPrivate={isPrivate}
              />
              <StatTile
                label="Darslar uchun yechilgani"
                value={formatSom(stats.total_deductions)}
                color="red"
                isPrivate={isPrivate}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="O'qituvchilarga jami tushgani"
                value={formatSom(stats.total_teacher_earnings)}
                color="green"
                isPrivate={isPrivate}
              />
              <StatTile
                label="O'qituvchilarga qolgani"
                value={formatSom(stats.total_teacher_earnings - stats.total_teacher_payouts)}
                color="indigo"
                isPrivate={isPrivate}
              />
              <StatTile
                label="O'qituvchilarga berib yuborilgani"
                value={formatSom(stats.total_teacher_payouts)}
                color="red"
                isPrivate={isPrivate}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="Markazga qolgan pul"
                value={formatSom(stats.total_center_revenue)}
                color="violet"
                isPrivate={isPrivate}
              />
            </div>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Fan</Label>
              <Combobox
                value={subjectId}
                onChange={(value) => {
                  setSubjectId(value);
                  setTeacherId("");
                  setGroupId("");
                }}
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
                value={teacherId}
                onChange={(value) => {
                  setTeacherId(value);
                  setGroupId("");
                }}
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
                value={groupId}
                onChange={setGroupId}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...filterGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            <div>
              <Label>O'quvchi</Label>
              <Combobox
                value={studentId}
                onChange={setStudentId}
                placeholder="Barcha o'quvchilar"
                options={[
                  { value: "", label: "Barcha o'quvchilar" },
                  ...students.map((s) => ({ value: String(s.id), label: s.full_name })),
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
    </Layout>
  );
}
