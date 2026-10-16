import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createStudent, listStudents } from "../../api/endpoints";
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
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { User } from "../../types";
import { Layout } from "../../components/Layout";

export function StudentsPage() {
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
  const [debtorsOnly, setDebtorsOnly] = useState(false);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      setStudents(await listStudents());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const debtorCount = useMemo(() => students.filter((s) => s.balance < 0).length, [students]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.phone.toLowerCase().includes(term);
      const matchesDebtor = !debtorsOnly || s.balance < 0;
      return matchesSearch && matchesDebtor;
    });
  }, [students, search, debtorsOnly]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredStudents);

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
      setSuccess("O'quvchi muvaffaqiyatli qo'shildi");
      setIsModalOpen(false);
      resetForm();
      await loadStudents();
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
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
              debtorsOnly ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            Qarzdorlar
            {debtorCount > 0 && (
              <Badge color={debtorsOnly ? "slate" : "red"}>{debtorCount}</Badge>
            )}
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["F.I.O", "Telefon", "Balans", ""]}>
            {pageItems.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.phone}</td>
                <td className={`px-3 py-2 ${s.balance < 0 ? "font-medium text-rose-600" : "text-slate-600 dark:text-slate-400"}`}>
                  {s.balance.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/students/${s.id}`}
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
