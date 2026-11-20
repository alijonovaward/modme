import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  listAllTeacherTransactions,
  listGroups,
  listStaffUsers,
  listStudents,
  listSubjects,
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
  PAGE_SIZE,
  Pagination,
  PrivacyToggle,
  Select,
  StatTile,
  Table,
  usePrivacyMode,
} from "../../components/ui";
import type {
  GroupListItem,
  Subject,
  TeacherTransactionGlobalListItem,
  TransactionListItem,
  User,
} from "../../types";
import { Layout } from "../../components/Layout";
import { currentMonthRange } from "../../utils/date";
import { downloadXlsx } from "../../utils/download";

interface StudentFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  studentId: string;
  subjectId: string;
  groupId: string;
  adminId: string;
}

interface TeacherFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  teacherId: string;
  subjectId: string;
  groupId: string;
  adminId: string;
}

const DEFAULT_STUDENT_FILTERS: StudentFilters = {
  ...currentMonthRange(),
  type: "",
  studentId: "",
  subjectId: "",
  groupId: "",
  adminId: "",
};

const DEFAULT_TEACHER_FILTERS: TeacherFilters = {
  ...currentMonthRange(),
  type: "",
  teacherId: "",
  subjectId: "",
  groupId: "",
  adminId: "",
};

export function TransactionsPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const location = useLocation();
  const incomingStudentId = (location.state as { studentId?: number } | null)?.studentId;

  const initialStudentFilters: StudentFilters = incomingStudentId
    ? { ...DEFAULT_STUDENT_FILTERS, dateFrom: "", dateTo: "", studentId: String(incomingStudentId) }
    : DEFAULT_STUDENT_FILTERS;

  const [tab, setTab] = useState<"student" | "teacher">("student");

  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [teacherTransactions, setTeacherTransactions] = useState<TeacherTransactionGlobalListItem[]>([]);

  const [admins, setAdmins] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentDraft, setStudentDraft] = useState<StudentFilters>(initialStudentFilters);
  const [studentFilters, setStudentFilters] = useState<StudentFilters>(initialStudentFilters);
  const [teacherDraft, setTeacherDraft] = useState<TeacherFilters>(DEFAULT_TEACHER_FILTERS);
  const [teacherFilters, setTeacherFilters] = useState<TeacherFilters>(DEFAULT_TEACHER_FILTERS);

  const [selectedStudentTx, setSelectedStudentTx] = useState<TransactionListItem | null>(null);
  const [selectedTeacherTx, setSelectedTeacherTx] = useState<TeacherTransactionGlobalListItem | null>(null);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentSums, setStudentSums] = useState({ deposits: 0, deductions: 0 });

  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherTotal, setTeacherTotal] = useState(0);
  const [teacherSums, setTeacherSums] = useState({ earnings: 0, payouts: 0 });
  const [hasLoadedTeacherTab, setHasLoadedTeacherTab] = useState(false);

  const loadStudentTransactions = async (filters: StudentFilters, pageArg: number) => {
    setIsLoading(true);
    try {
      const data = await listTransactions({
        created_by_id: filters.adminId ? Number(filters.adminId) : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        student_id: filters.studentId ? Number(filters.studentId) : undefined,
        type: filters.type ? (filters.type as "deposit" | "deduction") : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setTransactions(data.items);
      setStudentTotal(data.total);
      setStudentSums({ deposits: data.total_deposits, deductions: data.total_deductions });
      setStudentPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeacherTransactions = async (filters: TeacherFilters, pageArg: number) => {
    setIsLoading(true);
    try {
      const data = await listAllTeacherTransactions({
        created_by_id: filters.adminId ? Number(filters.adminId) : undefined,
        group_id: filters.groupId ? Number(filters.groupId) : undefined,
        teacher_id: filters.teacherId ? Number(filters.teacherId) : undefined,
        type: filters.type ? (filters.type as "lesson_earning" | "payout") : undefined,
        date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
        date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setTeacherTransactions(data.items);
      setTeacherTotal(data.total);
      setTeacherSums({ earnings: data.total_earnings, payouts: data.total_payouts });
      setTeacherPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentTransactions(studentFilters, 1);
    listGroups().then(setGroups).catch(() => undefined);
    listStudents().then(setStudents).catch(() => undefined);
    listStaffUsers("teacher").then(setTeachers).catch(() => undefined);
    listSubjects().then(setSubjects).catch(() => undefined);
    if (isSuperadmin) {
      listStaffUsers().then(setAdmins).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (next: "student" | "teacher") => {
    setTab(next);
    setError(null);
    if (next === "teacher" && !hasLoadedTeacherTab) {
      setHasLoadedTeacherTab(true);
      loadTeacherTransactions(teacherFilters, 1);
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
      loadStudentTransactions(studentDraft, 1);
    } else {
      setTeacherFilters(teacherDraft);
      loadTeacherTransactions(teacherDraft, 1);
    }
  };

  const clearFilters = () => {
    setIsModalOpen(false);
    if (tab === "student") {
      setStudentDraft(DEFAULT_STUDENT_FILTERS);
      setStudentFilters(DEFAULT_STUDENT_FILTERS);
      loadStudentTransactions(DEFAULT_STUDENT_FILTERS, 1);
    } else {
      setTeacherDraft(DEFAULT_TEACHER_FILTERS);
      setTeacherFilters(DEFAULT_TEACHER_FILTERS);
      loadTeacherTransactions(DEFAULT_TEACHER_FILTERS, 1);
    }
  };

  const activeCount =
    tab === "student"
      ? [studentFilters.type, studentFilters.studentId, studentFilters.groupId, studentFilters.adminId].filter(
          Boolean,
        ).length
      : [teacherFilters.type, teacherFilters.teacherId, teacherFilters.groupId, teacherFilters.adminId].filter(
          Boolean,
        ).length;

  const totalDeposits = studentSums.deposits;
  const totalDeductions = studentSums.deductions;
  const totalStudentRemaining = totalDeposits - totalDeductions;
  const totalEarnings = teacherSums.earnings;
  const totalPayouts = teacherSums.payouts;
  const totalTeacherRemaining = totalEarnings - totalPayouts;

  const studentPageCount = Math.max(1, Math.ceil(studentTotal / PAGE_SIZE));
  const teacherPageCount = Math.max(1, Math.ceil(teacherTotal / PAGE_SIZE));

  const studentTabGroupOptions = groups.filter(
    (g) => !studentDraft.subjectId || String(g.subject_id) === studentDraft.subjectId,
  );

  const teacherTabTeacherOptions = teacherDraft.subjectId
    ? teachers.filter((t) =>
        groups.some((g) => String(g.subject_id) === teacherDraft.subjectId && g.teacher_id === t.id),
      )
    : teachers;

  const teacherTabGroupOptions = groups.filter(
    (g) =>
      (!teacherDraft.subjectId || String(g.subject_id) === teacherDraft.subjectId) &&
      (!teacherDraft.teacherId || String(g.teacher_id) === teacherDraft.teacherId),
  );

  const handleExport = () => {
    if (tab === "student") {
      downloadXlsx(
        "/api/v1/transactions/export",
        {
          created_by_id: studentFilters.adminId ? Number(studentFilters.adminId) : undefined,
          group_id: studentFilters.groupId ? Number(studentFilters.groupId) : undefined,
          student_id: studentFilters.studentId ? Number(studentFilters.studentId) : undefined,
          type: studentFilters.type || undefined,
          date_from: studentFilters.dateFrom ? `${studentFilters.dateFrom}T00:00:00` : undefined,
          date_to: studentFilters.dateTo ? `${studentFilters.dateTo}T23:59:59` : undefined,
        },
        "tranzaksiyalar.xlsx",
      );
    } else {
      downloadXlsx(
        "/api/v1/teachers/transactions/export",
        {
          created_by_id: teacherFilters.adminId ? Number(teacherFilters.adminId) : undefined,
          group_id: teacherFilters.groupId ? Number(teacherFilters.groupId) : undefined,
          teacher_id: teacherFilters.teacherId ? Number(teacherFilters.teacherId) : undefined,
          type: teacherFilters.type || undefined,
          date_from: teacherFilters.dateFrom ? `${teacherFilters.dateFrom}T00:00:00` : undefined,
          date_to: teacherFilters.dateTo ? `${teacherFilters.dateTo}T23:59:59` : undefined,
        },
        "oqituvchi_hisob_kitobi.xlsx",
      );
    }
  };

  const { isPrivate, togglePrivacy } = usePrivacyMode();

  return (
    <Layout>
      <Card
        title="Tranzaksiyalar tarixi"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PrivacyToggle isPrivate={isPrivate} onToggle={togglePrivacy} />
            <Button variant="secondary" onClick={handleExport}>
              Excel'ga chiqarish
            </Button>
            <Button onClick={openModal}>
              Filterlar{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        {((tab === "student" && (studentFilters.dateFrom || studentFilters.dateTo)) ||
          (tab === "teacher" && (teacherFilters.dateFrom || teacherFilters.dateTo))) && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Davr: {(tab === "student" ? studentFilters.dateFrom : teacherFilters.dateFrom) || "..."} —{" "}
            {(tab === "student" ? studentFilters.dateTo : teacherFilters.dateTo) || "..."}
          </p>
        )}
        {!isSuperadmin && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Faqat o'zingiz amalga oshirgan tranzaksiyalar ko'rsatilmoqda.
          </p>
        )}

        <div className="mb-4 flex gap-1">
          <button
            onClick={() => switchTab("student")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "student" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            O'quvchilar
          </button>
          <button
            onClick={() => switchTab("teacher")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "teacher" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            O'qituvchilar
          </button>
        </div>

        {!isLoading && tab === "student" && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Jami to'ldirilgan"
              value={`${totalDeposits.toLocaleString("uz-UZ")} so'm`}
              color="green"
              isPrivate={isPrivate}
            />
            <StatTile
              label="Jami qolgan"
              value={`${totalStudentRemaining.toLocaleString("uz-UZ")} so'm`}
              color="indigo"
              isPrivate={isPrivate}
            />
            <StatTile
              label="Jami yechilgan"
              value={`${totalDeductions.toLocaleString("uz-UZ")} so'm`}
              color="red"
              isPrivate={isPrivate}
            />
          </div>
        )}
        {!isLoading && tab === "teacher" && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Jami dars daromadi"
              value={`${totalEarnings.toLocaleString("uz-UZ")} so'm`}
              color="green"
              isPrivate={isPrivate}
            />
            <StatTile
              label="Jami qolgan"
              value={`${totalTeacherRemaining.toLocaleString("uz-UZ")} so'm`}
              color="indigo"
              isPrivate={isPrivate}
            />
            <StatTile
              label="Jami pul berilgan"
              value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
              color="red"
              isPrivate={isPrivate}
            />
          </div>
        )}

        {!isLoading && tab === "student" ? (
          <>
          <Table headers={["Sana", "O'quvchi", "Guruh", "Turi", "Summa"]}>
            {transactions.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelectedStudentTx(t)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                </td>
                <td className="px-2.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{t.student_name}</td>
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-2.5 py-2.5">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-2.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={studentPage}
            pageCount={studentPageCount}
            total={studentTotal}
            onPageChange={(next) => loadStudentTransactions(studentFilters, next)}
          />
          </>
        ) : !isLoading && tab === "teacher" ? (
          <>
          <Table headers={["Sana", "O'qituvchi", "Guruh", "Turi", "Summa"]}>
            {teacherTransactions.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelectedTeacherTx(t)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                </td>
                <td className="px-2.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{t.teacher_name}</td>
                <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                <td className="px-2.5 py-2.5">
                  <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                    {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                  </Badge>
                </td>
                <td className="px-2.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={teacherPage}
            pageCount={teacherPageCount}
            total={teacherTotal}
            onPageChange={(next) => loadTeacherTransactions(teacherFilters, next)}
          />
          </>
        ) : null}
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
              <Label>Fan</Label>
              <Combobox
                value={studentDraft.subjectId}
                onChange={(value) =>
                  setStudentDraft((prev) => ({ ...prev, subjectId: value, groupId: "" }))
                }
                placeholder="Barcha fanlar"
                options={[
                  { value: "", label: "Barcha fanlar" },
                  ...subjects.map((s) => ({ value: String(s.id), label: s.name })),
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
                  ...studentTabGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
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
              <Label>Fan</Label>
              <Combobox
                value={teacherDraft.subjectId}
                onChange={(value) =>
                  setTeacherDraft((prev) => ({ ...prev, subjectId: value, teacherId: "", groupId: "" }))
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
                value={teacherDraft.teacherId}
                onChange={(value) =>
                  setTeacherDraft((prev) => ({ ...prev, teacherId: value, groupId: "" }))
                }
                placeholder="Barcha o'qituvchilar"
                options={[
                  { value: "", label: "Barcha o'qituvchilar" },
                  ...teacherTabTeacherOptions.map((t) => ({ value: String(t.id), label: t.full_name })),
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
                  ...teacherTabGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
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

      {selectedStudentTx && (
        <Modal title="Tranzaksiya tafsilotlari" onClose={() => setSelectedStudentTx(null)}>
          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Turi:</span>
              <Badge color={selectedStudentTx.type === "deposit" ? "green" : "red"}>
                {selectedStudentTx.type === "deposit" ? "To'ldirish" : "Yechim"}
              </Badge>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Summa:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {selectedStudentTx.amount.toLocaleString("uz-UZ")} so'm
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">O'quvchi:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedStudentTx.student_name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Guruh:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedStudentTx.group_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Kim kiritgan:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedStudentTx.created_by_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Sana va vaqt:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {new Date(selectedStudentTx.created_at).toLocaleString("uz-UZ")}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 mb-1 dark:text-slate-400">To'liq izoh:</span>
              <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {selectedStudentTx.comment || "Izoh mavjud emas"}
              </p>
            </div>
            <Button className="w-full mt-2" onClick={() => setSelectedStudentTx(null)}>
              Yopish
            </Button>
          </div>
        </Modal>
      )}

      {selectedTeacherTx && (
        <Modal title="Tranzaksiya tafsilotlari" onClose={() => setSelectedTeacherTx(null)}>
          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Turi:</span>
              <Badge color={selectedTeacherTx.type === "lesson_earning" ? "green" : "red"}>
                {selectedTeacherTx.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
              </Badge>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Summa:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {selectedTeacherTx.amount.toLocaleString("uz-UZ")} so'm
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">O'qituvchi:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTeacherTx.teacher_name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Guruh:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTeacherTx.group_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Kim bergan:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTeacherTx.created_by_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Sana va vaqt:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {new Date(selectedTeacherTx.created_at).toLocaleString("uz-UZ")}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 mb-1 dark:text-slate-400">To'liq izoh:</span>
              <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {selectedTeacherTx.comment || "Izoh mavjud emas"}
              </p>
            </div>
            <Button className="w-full mt-2" onClick={() => setSelectedTeacherTx(null)}>
              Yopish
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
