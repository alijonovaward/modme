import { useEffect, useState } from "react";
import {
  getStatsOverview,
  listGroups,
  listStaffUsers,
  listStudents,
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
  StatTile,
} from "../../components/ui";
import type { GroupListItem, StatsOverview, User } from "../../types";
import { Layout } from "../../components/Layout";

function formatSom(amount: number): string {
  return `${amount.toLocaleString("uz-UZ")} so'm`;
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
    groupId: "",
    teacherId: "",
    studentId: "",
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = () => {
    setDateFrom(appliedFilters.dateFrom);
    setDateTo(appliedFilters.dateTo);
    setGroupId(appliedFilters.groupId);
    setTeacherId(appliedFilters.teacherId);
    setStudentId(appliedFilters.studentId);
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    const next = { dateFrom, dateTo, groupId, teacherId, studentId };
    setAppliedFilters(next);
    setIsModalOpen(false);
    load(next);
  };

  const clearFilters = () => {
    const next = { dateFrom: "", dateTo: "", groupId: "", teacherId: "", studentId: "" };
    setDateFrom("");
    setDateTo("");
    setGroupId("");
    setTeacherId("");
    setStudentId("");
    setAppliedFilters(next);
    setIsModalOpen(false);
    load(next);
  };

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;

  return (
    <Layout>
      <Card
        title="Statistika"
        action={
          <Button onClick={openModal}>
            Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      >
        <ErrorMessage message={error} />
        {isLoading || !stats ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Jami kiritilgan pul"
              value={formatSom(stats.total_deposits)}
              color="green"
            />
            <StatTile
              label="Darslar uchun yechilgan pul"
              value={formatSom(stats.total_deductions)}
              color="red"
            />
            <StatTile
              label="O'qituvchilarga tushum"
              value={formatSom(stats.total_teacher_earnings)}
              color="indigo"
            />
            <StatTile
              label="O'qituvchilarga berilgan pul"
              value={formatSom(stats.total_teacher_payouts)}
              color="amber"
            />
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
              <Label>Guruh</Label>
              <Combobox
                value={groupId}
                onChange={setGroupId}
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
                value={teacherId}
                onChange={setTeacherId}
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...teachers.map((t) => ({ value: String(t.id), label: t.full_name })),
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
