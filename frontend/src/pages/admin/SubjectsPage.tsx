import { useEffect, useState, type FormEvent } from "react";
import { createSubject, listSubjects } from "../../api/endpoints";
import { Button, Card, ErrorMessage, extractErrorMessage, Input, Label, Table } from "../../components/ui";
import type { Subject } from "../../types";
import { Layout } from "../../components/Layout";

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createSubject(name);
      setName("");
      await loadSubjects();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Yangi fan qo'shish">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Fan nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <ErrorMessage message={error} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Qo'shish
            </Button>
          </form>
        </Card>
        <div className="lg:col-span-2">
          <Card title="Fanlar ro'yxati">
            {isLoading ? (
              <p className="text-sm text-slate-500">Yuklanmoqda...</p>
            ) : (
              <Table headers={["Fan nomi"]}>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
