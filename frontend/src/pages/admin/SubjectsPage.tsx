import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSubject, listSubjects } from "../../api/endpoints";
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createSubject(name);
      setName("");
      setIsModalOpen(false);
      await loadSubjects();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Card
        title="Fanlar ro'yxati"
        action={
          <Button
            onClick={() => {
              setName("");
              setError(null);
              setIsModalOpen(true);
            }}
          >
            + Yangi fan
          </Button>
        }
      >
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
          <Table headers={["Fan nomi"]}>
            {filteredSubjects.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {isModalOpen && (
        <Modal title="Yangi fan qo'shish" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Fan nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
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
