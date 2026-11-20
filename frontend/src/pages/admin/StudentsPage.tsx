import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createStudent,
  listGroups,
  listStaffUsers,
  listStudentsPage,
  listSubjects,
} from "../../api/endpoints";
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
  MobileList,
  MobileListRow,
  Modal,
  PAGE_SIZE,
  Pagination,
  SuccessMessage,
  Table,
} from "../../components/ui";
import type { GroupListItem, Subject, User } from "../../types";
import { Layout } from "../../components/Layout";

export function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debtorsOnly, setDebtorsOnly] = useState(false);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [draftSubjectId, setDraftSubjectId] = useState("");
  const [draftTeacherId, setDraftTeacherId] = useState("");
  const [draftGroupId, setDraftGroupId] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [debtorCount, setDebtorCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async (
    pageArg: number,
    searchArg: string,
    debtorsOnlyArg: boolean,
    groupIdArg: string,
  ) => {
    setIsLoading(true);
    try {
      const data = await listStudentsPage({
        search: searchArg || undefined,
        debtors_only: debtorsOnlyArg || undefined,
        group_id: groupIdArg ? Number(groupIdArg) : undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setStudents(data.items);
      setTotal(data.total);
      setDebtorCount(data.debtor_count);
      setPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1, debouncedSearch, debtorsOnly, groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debtorsOnly, groupId]);

  useEffect(() => {
    listGroups().then(setGroups).catch(() => undefined);
    listStaffUsers("teacher").then(setTeachers).catch(() => undefined);
    listSubjects().then(setSubjects).catch(() => undefined);
  }, []);

  const openFilterModal = () => {
    setDraftSubjectId(subjectId);
    setDraftTeacherId(teacherId);
    setDraftGroupId(groupId);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setSubjectId(draftSubjectId);
    setTeacherId(draftTeacherId);
    setGroupId(draftGroupId);
    setIsFilterModalOpen(false);
  };

  const clearFilters = () => {
    setDraftSubjectId("");
    setDraftTeacherId("");
    setDraftGroupId("");
    setSubjectId("");
    setTeacherId("");
    setGroupId("");
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = [subjectId, teacherId, groupId].filter(Boolean).length;

  const filterTeacherOptions = draftSubjectId
    ? teachers.filter((t) =>
        groups.some((g) => String(g.subject_id) === draftSubjectId && g.teacher_id === t.id),
      )
    : teachers;

  const filterGroupOptions = groups.filter(
    (g) =>
      (!draftSubjectId || String(g.subject_id) === draftSubjectId) &&
      (!draftTeacherId || String(g.teacher_id) === draftTeacherId),
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setPassword("");
    setError(null);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await createStudent({ full_name: fullName, phone, password });
      setSuccess("O'quvchi muvaffaqiyatli qo'shildi ✨");
      setIsModalOpen(false);
      resetForm();
      await load(page, debouncedSearch, debtorsOnly, groupId);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Card
        title="O'quvchilar ro'yxati"
        action={
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            + Yangi o'quvchi
          </Button>
        }
      >
        <SuccessMessage message={success} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="F.I.O yoki telefon raqam bo'yicha qidirish"
            className="max-w-md flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setDebtorsOnly((prev) => !prev)}
            className={`flex select-none items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
              debtorsOnly ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            Qarzdorlar
            {debtorCount > 0 && (
              <Badge color={debtorsOnly ? "slate" : "red"}>{debtorCount}</Badge>
            )}
          </button>
          <Button variant="secondary" onClick={openFilterModal}>
            Filterlar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadXlsx(
                "/api/v1/students/export",
                {
                  search: debouncedSearch || undefined,
                  debtors_only: debtorsOnly || undefined,
                  group_id: groupId ? Number(groupId) : undefined,
                },
                "oquvchilar.xlsx",
              )
            }
          >
            Excel'ga chiqarish
          </Button>
        </div>
        {isLoading ? (
          <div className="flex animate-pulse flex-col gap-3 py-4">
            <div className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : (
          <>
          <div className="hidden sm:block">
            <Table headers={["F.I.O", "Telefon", "Balans", "Holat"]}>
              {students.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/admin/students/${s.id}`)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
                >
                  <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{s.phone}</td>
                  <td className={`px-3.5 py-2.5 ${s.balance < 0 ? "font-medium text-rose-600" : "text-slate-600 dark:text-slate-400"}`}>
                    {s.balance.toLocaleString("uz-UZ")} so'm
                  </td>
                  <td className="px-3.5 py-2.5">
                    {s.is_active ? (
                      <Badge color="green">Faol</Badge>
                    ) : (
                      <Badge color="red">Bloklangan</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <MobileList>
            {students.map((s) => (
              <MobileListRow key={s.id} onClick={() => navigate(`/admin/students/${s.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {s.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.phone}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <p
                    className={`text-sm font-semibold ${
                      s.balance < 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {s.balance.toLocaleString("uz-UZ")} so'm
                  </p>
                  {s.is_active ? (
                    <Badge color="green">Faol</Badge>
                  ) : (
                    <Badge color="red">Bloklangan</Badge>
                  )}
                </div>
              </MobileListRow>
            ))}
          </MobileList>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={(next) => load(next, debouncedSearch, debtorsOnly, groupId)}
          />
          </>
        )}
      </Card>

      {isFilterModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsFilterModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Fan</Label>
              <Combobox
                value={draftSubjectId}
                onChange={(value) => {
                  setDraftSubjectId(value);
                  setDraftTeacherId("");
                  setDraftGroupId("");
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
                value={draftTeacherId}
                onChange={(value) => {
                  setDraftTeacherId(value);
                  setDraftGroupId("");
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
                value={draftGroupId}
                onChange={setDraftGroupId}
                placeholder="Barcha guruhlar"
                options={[
                  { value: "", label: "Barcha guruhlar" },
                  ...filterGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
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

      {isModalOpen && (
        <Modal title="Yangi o'quvchi qo'shish" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>F.I.O</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Telefon raqam</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998901234567"
                required
              />
            </div>
            <div>
              <Label>Parol</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <ErrorMessage message={error} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : "Qo'shish"}
            </Button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
