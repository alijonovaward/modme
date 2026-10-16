import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createStaffUser, listStaffUsers } from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Pagination,
  Select,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { User, UserRole } from "../../types";
import { Layout } from "../../components/Layout";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Admin",
  admin: "Administrator",
  teacher: "O'qituvchi",
};

export function StaffPage() {
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
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await listStaffUsers();
      setStaff(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((s) => {
      const matchesRole = !roleFilter || s.role === roleFilter;
      const matchesSearch =
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.phone.toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [staff, search, roleFilter]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredStaff);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setPassword("");
    setRole("teacher");
    setPercentage("40");
    setError(null);
  };

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
      await loadStaff();
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
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="F.I.O yoki telefon raqam bo'yicha qidirish"
            className="flex-1 min-w-[260px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            className="w-48"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
          >
            <option value="">Barcha rollar</option>
            <option value="superadmin">Bosh Admin</option>
            <option value="admin">Administrator</option>
            <option value="teacher">O'qituvchi</option>
          </Select>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["F.I.O", "Telefon", "Rol", "Foiz", "Balans", ""]}>
            {pageItems.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.phone}</td>
                <td className="px-3 py-2">
                  <Badge color={s.role === "superadmin" ? "amber" : "slate"}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {s.teacher_percentage !== null ? `${s.teacher_percentage}%` : "-"}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {s.balance.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/superadmin/staff/${s.id}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
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
