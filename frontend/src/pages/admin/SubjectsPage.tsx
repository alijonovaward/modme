import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "../../api/endpoints";
import {
  Button,
  Card,
  ConfirmModal,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Pagination,
  Table,
  usePagination,
} from "../../components/ui";
import type { Subject } from "../../types";
import { Layout } from "../../components/Layout";

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      setSubjects(await listSubjects());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const filteredSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(term));
  }, [subjects, search]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredSubjects);

  const openCreateModal = () => {
    setEditTarget(null);
    setName("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (subject: Subject) => {
    setEditTarget(subject);
    setName(subject.name);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (editTarget) {
        await updateSubject(editTarget.id, name);
      } else {
        await createSubject(name);
      }
      setName("");
      setIsModalOpen(false);
      await loadSubjects();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteSubject = async () => {
    if (!deleteTarget || isDeleting) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteSubject(deleteTarget.id);
      setIsModalOpen(false);
      setDeleteTarget(null);
      await loadSubjects();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <Card
        title="Fanlar ro'yxati"
        action={<Button onClick={openCreateModal}>+ Yangi fan</Button>}
      >
        <ErrorMessage message={error} />
        <div className="mb-4">
          <Input
            placeholder="Fan nomi bo'yicha qidirish"
            className="max-w-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Fan nomi"]}>
            {pageItems.map((s) => (
              <tr
                key={s.id}
                onClick={() => openEditModal(s)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isModalOpen && (
        <Modal
          title={editTarget ? "Fan nomini tahrirlash" : "Yangi fan qo'shish"}
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Fan nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <ErrorMessage message={error} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Saqlanmoqda..." : editTarget ? "Saqlash" : "Qo'shish"}
              </Button>
              {editTarget && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setDeleteTarget(editTarget)}
                >
                  O'chirish
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Fanni o'chirish"
        message={
          deleteTarget ? `'${deleteTarget.name}' fanini o'chirishni tasdiqlaysizmi?` : ""
        }
        confirmLabel="O'chirish"
        isLoading={isDeleting}
        onConfirm={confirmDeleteSubject}
        onClose={() => setDeleteTarget(null)}
      />
    </Layout>
  );
}
