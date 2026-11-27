import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createStaffUser, listStaffUsersPage } from "../../api/endpoints";
import { downloadXlsx } from "../../utils/download";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  MobileList,
  MobileListRow,
  Modal,
  PAGE_SIZE,
  Pagination,
  Select,
  SuccessMessage,
  Table,
} from "../../components/ui";
import type { User, UserRole } from "../../types";
import { Layout } from "../../components/Layout";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Admin",
  admin: "Administrator",
  teacher: "O'qituvchi",
};

export function StaffPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "teacher">("teacher");
  const [percentage, setPercentage] = useState("40");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [showDeleted, setShowDeleted] = useState(false);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [draftRoleFilter, setDraftRoleFilter] = useState<UserRole | "">("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async (
    pageArg: number,
    searchArg: string,
    roleArg: UserRole | "",
    showDeletedArg: boolean,
  ) => {
    setIsLoading(true);
    try {
      const data = await listStaffUsersPage({
        search: searchArg || undefined,
        role: roleArg || undefined,
        show_deleted: showDeletedArg || undefined,
        page: pageArg,
        page_size: PAGE_SIZE,
      });
      setStaff(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1, debouncedSearch, roleFilter, showDeleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, roleFilter, showDeleted]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setPassword("");
    setRole("teacher");
    setPercentage("40");
    setError(null);
  };

  const openFilterModal = () => {
    setDraftRoleFilter(roleFilter);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setRoleFilter(draftRoleFilter);
    setIsFilterModalOpen(false);
  };

  const clearFilters = () => {
    setDraftRoleFilter("");
    setRoleFilter("");
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = roleFilter ? 1 : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await createStaffUser({
        full_name: fullName,
        phone,
        password,
        role,
        teacher_percentage: role === "teacher" ? Number(percentage) : undefined,
      });
      setSuccess("Xodim muvaffaqiyatli yaratildi");
      setIsModalOpen(false);
      resetForm();
      await load(page, debouncedSearch, roleFilter, showDeleted);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Card
        title="Xodimlar ro'yxati"
        action={
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            + Yangi xodim
          </Button>
        }
      >
        <SuccessMessage message={success} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="F.I.O yoki telefon raqam bo'yicha qidirish"
            className="flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" onClick={openFilterModal}>
            Filterlar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <button
            onClick={() => setShowDeleted((prev) => !prev)}
            className={`select-none rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
              showDeleted ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            O'chirilganlar
          </button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadXlsx(
                "/api/v1/admin/users/export",
                {
                  search: debouncedSearch || undefined,
                  role: roleFilter || undefined,
                  show_deleted: showDeleted || undefined,
                },
                "xodimlar.xlsx",
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
          <div className="hidden sm:block">
            <Table headers={["F.I.O", "Telefon", "Rol", "Foiz", "Balans"]}>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/superadmin/staff/${s.id}`)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
                >
                  <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{s.phone}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge color={s.role === "superadmin" ? "amber" : "slate"}>
                      {ROLE_LABEL[s.role] ?? s.role}
                    </Badge>
                    {s.deleted_at ? (
                      <span className="ml-1">
                        <Badge color="red">O'chirilgan</Badge>
                      </span>
                    ) : (
                      !s.is_active && (
                        <span className="ml-1">
                          <Badge color="red">Bloklangan</Badge>
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {s.teacher_percentage !== null ? `${s.teacher_percentage}%` : "-"}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                    {s.balance.toLocaleString("uz-UZ")} so'm
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <MobileList>
            {staff.map((s) => (
              <MobileListRow key={s.id} onClick={() => navigate(`/superadmin/staff/${s.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {s.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.phone}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1">
                    <Badge color={s.role === "superadmin" ? "amber" : "slate"}>
                      {ROLE_LABEL[s.role] ?? s.role}
                    </Badge>
                    {s.deleted_at ? (
                      <Badge color="red">O'chirilgan</Badge>
                    ) : (
                      !s.is_active && <Badge color="red">Bloklangan</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {s.teacher_percentage !== null ? `${s.teacher_percentage}% · ` : ""}
                    {s.balance.toLocaleString("uz-UZ")} so'm
                  </p>
                </div>
              </MobileListRow>
            ))}
          </MobileList>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={(next) => load(next, debouncedSearch, roleFilter, showDeleted)}
          />
          </>
        )}
      </Card>

      {isFilterModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsFilterModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <Label>Rol bo'yicha filter</Label>
              <Select
                value={draftRoleFilter}
                onChange={(e) => setDraftRoleFilter(e.target.value as UserRole | "")}
              >
                <option value="">Barcha rollar</option>
                <option value="superadmin">Bosh Admin</option>
                <option value="admin">Administrator</option>
                <option value="teacher">O'qituvchi</option>
              </Select>
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
        <Modal title="Yangi xodim qo'shish" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <Label>Rol</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as "admin" | "teacher")}>
                <option value="teacher">O'qituvchi</option>
                <option value="admin">Administrator</option>
              </Select>
            </div>
            {role === "teacher" && (
              <div>
                <Label>Foiz stavkasi (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  required
                />
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
