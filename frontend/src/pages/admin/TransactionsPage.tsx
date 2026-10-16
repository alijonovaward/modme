import { useEffect, useState } from "react";
import {
  listAllTeacherTransactions,
  listGroups,
  listStaffUsers,
  listStudents,
  listTransactions,
} from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
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
  Select,
  StatTile,
  Table,
} from "../../components/ui";
import type {
  GroupListItem,
  TeacherTransactionGlobalListItem,
  TransactionListItem,
  User,
} from "../../types";
import { Layout } from "../../components/Layout";

interface StudentFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  studentId: string;
  groupId: string;
  adminId: string;
}

interface TeacherFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  teacherId: string;
  groupId: string;
  adminId: string;
}

const EMPTY_STUDENT_FILTERS: StudentFilters = {
  dateFrom: "",
  dateTo: "",
  type: "",
  studentId: "",
  groupId: "",
  adminId: "",
};

const EMPTY_TEACHER_FILTERS: TeacherFilters = {
  dateFrom: "",
  dateTo: "",
  type: "",
  teacherId: "",
  groupId: "",
  adminId: "",
};

export function TransactionsPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [tab, setTab] = useState<"student" | "teacher">("student");

  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [teacherTransactions, setTeacherTransactions] = useState<TeacherTransactionGlobalListItem[]>([]);

  const [admins, setAdmins] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentDraft, setStudentDraft] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [studentFilters, setStudentFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [teacherDraft, setTeacherDraft] = useState<TeacherFilters>(EMPTY_TEACHER_FILTERS);
  const [teacherFilters, setTeacherFilters] = useState<TeacherFilters>(EMPTY_TEACHER_FILTERS);

  const loadStudentTransactions = async (filters: StudentFilters) => {
    setIsLoading(true);
    try {
      const data = await listTransactions({
        created_by_id: filters.adminId ? Number(filters.adminId) : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        student_id: filters.studentId ? Number(filters.studentId) : undefined,
        type: filters.type ? (filters.type as "deposit" | "deduction") : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      });
      setTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeacherTransactions = async (filters: TeacherFilters) => {
    setIsLoading(true);
    try {
      const data = await listAllTeacherTransactions({
        created_by_id: filters.adminId ? Number(filters.adminId) : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        type: filters.type ? (filters.type as "lesson_earning" | "payout") : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      });
      setTeacherTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentTransactions(studentFilters);
    listGroups().then(setGroups).catch(() => undefined);
    listStudents().then(setStudents).catch(() => undefined);
    listStaffUsers("teacher").then(setTeachers).catch(() => undefined);
    if (isSuperadmin) {
      listStaffUsers().then(setAdmins).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (next: "student" | "teacher") => {
    setTab(next);
    setError(null);
    if (next === "teacher" && teacherTransactions.length === 0) {
      loadTeacherTransactions(teacherFilters);
    }
  };

  const openModal = () => {
    if (tab === "student") {
      setStudentDraft(studentFilters);
    } else {
      setTeacherDraft(teacherFilters);
    }
    setIsModalOpen(true);
  };

  const applyFilters = () => {
    setIsModalOpen(false);
    if (tab === "student") {
      setStudentFilters(studentDraft);
      loadStudentTransactions(studentDraft);
    } else {
      setTeacherFilters(teacherDraft);
      loadTeacherTransactions(teacherDraft);
    }
  };

  const clearFilters = () => {
    setIsModalOpen(false);
    if (tab === "student") {
      setStudentDraft(EMPTY_STUDENT_FILTERS);
      setStudentFilters(EMPTY_STUDENT_FILTERS);
      loadStudentTransactions(EMPTY_STUDENT_FILTERS);
    } else {
      setTeacherDraft(EMPTY_TEACHER_FILTERS);
      setTeacherFilters(EMPTY_TEACHER_FILTERS);
      loadTeacherTransactions(EMPTY_TEACHER_FILTERS);
    }
  };

  const activeCount = Object.values(tab === "student" ? studentFilters : teacherFilters).filter(
    Boolean,
  ).length;

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDeductions = Math.abs(
    transactions.filter((t) => t.type === "deduction").reduce((sum, t) => sum + t.amount, 0),
  );
  const totalEarnings = teacherTransactions
    .filter((t) => t.type === "lesson_earning")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayouts = Math.abs(
    teacherTransactions.filter((t) => t.type === "payout").reduce((sum, t) => sum + t.amount, 0),
  );

  return (
    <Layout>
      <Card
        title="Tranzaksiyalar tarixi"
        action={
          <Button onClick={openModal}>
            Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      >
        <ErrorMessage message={error} />
        {!isSuperadmin && (
          <p className="mb-4 text-sm text-slate-500">
            Faqat o'zingiz amalga oshirgan tranzaksiyalar ko'rsatilmoqda.
          </p>
        )}

        <div className="mb-4 flex gap-1">
          <button
            onClick={() => switchTab("student")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "student" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            O'quvchilar
          </button>
          <button
            onClick={() => switchTab("teacher")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "teacher" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            O'qituvchilar
          </button>
        </div>

        {!isLoading && tab === "student" && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label="Jami to'ldirilgan"
              value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
              color="green"
            />
            <StatTile
              label="Jami yechilgan"
              value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
              color="red"
            />
          </div>
        )}
        {!isLoading && tab === "teacher" && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label="Jami dars daromadi"
              value={`${totalEarnings.toLocaleString("uz-UZ")} so'm`}
              color="green"
            />
            <StatTile
              label="Jami pul berilgan"
              value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
              color="red"
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : tab === "student" ? (
          <Table headers={["Sana", "O'quvchi", "Guruh", "Turi", "Summa", "Kim tomonidan", "Izoh"]}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-600">{t.created_by_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table headers={["Sana", "O'qituvchi", "O'quvchi", "Guruh", "Turi", "Summa", "Kim bergan", "Izoh"]}>
            {teacherTransactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.teacher_name}</td>
                <td className="px-3 py-2 text-slate-600">{t.student_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                    {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-600">{t.created_by_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {isModalOpen && tab === "student" && (
        <Modal title="Filterlar" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={studentDraft.dateFrom}
                  onChange={(e) => setStudentDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={studentDraft.dateTo}
                  onChange={(e) => setStudentDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Turi</Label>
              <Select
                value={studentDraft.type}
                onChange={(e) => setStudentDraft((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="">Barchasi</option>
                <option value="deposit">To'ldirish</option>
                <option value="deduction">Yechim</option>
              </Select>
            </div>
            <div>
              <Label>O'quvchi</Label>
              <Combobox
                value={studentDraft.studentId}
                onChange={(value) => setStudentDraft((prev) => ({ ...prev, studentId: value }))}
                placeholder="Barcha o'quvchilar"
                options={[
                  { value: "", label: "Barcha o'quvchilar" },
                  ...students.map((s) => ({ value: String(s.id), label: s.full_name })),
                ]}
              />
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={studentDraft.groupId}
                onChange={(value) => setStudentDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            {isSuperadmin && (
              <div>
                <Label>Kim tomonidan</Label>
                <Combobox
                  value={studentDraft.adminId}
                  onChange={(value) => setStudentDraft((prev) => ({ ...prev, adminId: value }))}
                  placeholder="Barcha xodimlar"
                  options={[
                    { value: "", label: "Barcha xodimlar" },
                    ...admins
                      .filter((a) => a.role === "admin" || a.role === "superadmin")
                      .map((a) => ({ value: String(a.id), label: a.full_name })),
                  ]}
                />
              </div>
            )}
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

      {isModalOpen && tab === "teacher" && (
        <Modal title="Filterlar" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={teacherDraft.dateFrom}
                  onChange={(e) => setTeacherDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={teacherDraft.dateTo}
                  onChange={(e) => setTeacherDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Turi</Label>
              <Select
                value={teacherDraft.type}
                onChange={(e) => setTeacherDraft((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="">Barchasi</option>
                <option value="lesson_earning">Dars daromadi</option>
                <option value="payout">Pul berildi</option>
              </Select>
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Combobox
                value={teacherDraft.teacherId}
                onChange={(value) => setTeacherDraft((prev) => ({ ...prev, teacherId: value }))}
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...teachers.map((t) => ({ value: String(t.id), label: t.full_name })),
                ]}
              />
            </div>
            <div>
              <Label>Guruh</Label>
              <Combobox
                value={teacherDraft.groupId}
                onChange={(value) => setTeacherDraft((prev) => ({ ...prev, groupId: value }))}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            {isSuperadmin && (
              <div>
                <Label>Kim bergan (pul berish uchun)</Label>
                <Combobox
                  value={teacherDraft.adminId}
                  onChange={(value) => setTeacherDraft((prev) => ({ ...prev, adminId: value }))}
                  placeholder="Barcha xodimlar"
                  options={[
                    { value: "", label: "Barcha xodimlar" },
                    ...admins
                      .filter((a) => a.role === "admin" || a.role === "superadmin")
                      .map((a) => ({ value: String(a.id), label: a.full_name })),
                  ]}
                />
              </div>
            )}
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
