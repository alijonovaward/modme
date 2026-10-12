import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createGroup, listGroups, listStaffUsers, listSubjects } from "../../api/endpoints";
import { Badge, Button, Card, ErrorMessage, extractErrorMessage, Input, Label, Select, Table } from "../../components/ui";
import type { GroupListItem, Subject, User } from "../../types";
import { Layout } from "../../components/Layout";

const STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  archived: "slate",
} as const;

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [lessonPrice, setLessonPrice] = useState("");

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [groupsData, subjectsData, teachersData] = await Promise.all([
        listGroups(),
        listSubjects(),
        listStaffUsers("teacher"),
      ]);
      setGroups(groupsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createGroup({
        name,
        subject_id: Number(subjectId),
        teacher_id: Number(teacherId),
        lesson_price: Number(lessonPrice),
      });
      setName("");
      setLessonPrice("");
      await loadAll();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Yangi guruh ochish">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Guruh nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Fan</Label>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                <option value="">Tanlang</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>O'qituvchi</Label>
              <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
                <option value="">Tanlang</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.teacher_percentage}%)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>1 dars narxi</Label>
              <Input
                type="number"
                value={lessonPrice}
                onChange={(e) => setLessonPrice(e.target.value)}
                required
              />
            </div>
            <ErrorMessage message={error} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Yaratish
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Guruhlar ro'yxati">
            {isLoading ? (
              <p className="text-sm text-slate-500">Yuklanmoqda...</p>
            ) : (
              <Table headers={["Nomi", "Fan", "O'qituvchi", "Dars narxi", "Holat", ""]}>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{g.name}</td>
                    <td className="px-3 py-2 text-slate-600">{g.subject_name}</td>
                    <td className="px-3 py-2 text-slate-600">{g.teacher_name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {g.lesson_price.toLocaleString("uz-UZ")} so'm
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={STATUS_COLOR[g.status]}>{g.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/admin/groups/${g.id}`} className="text-sm text-indigo-600 hover:underline">
                        Batafsil
                      </Link>
                    </td>
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
