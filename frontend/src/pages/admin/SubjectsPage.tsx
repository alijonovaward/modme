import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "../../api/endpoints";
import {
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  Modal,
  Table,
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

  const handleDelete = async (subject: Subject) => {
    if (!window.confirm(`"${subject.name}" fanini o'chirishni tasdiqlaysizmi?`)) return;
    setError(null);
    try {
      await deleteSubject(subject.id);
      await loadSubjects();
    } catch (err) {
      setError(extractErrorMessage(err));
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
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <Table headers={["Fan nomi", ""]}>
            {filteredSubjects.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button variant="secondary" onClick={() => openEditModal(s)}>
                      Tahrirlash
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(s)}>
                      O'chirish
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saqlanmoqda..." : editTarget ? "Saqlash" : "Qo'shish"}
            </Button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
