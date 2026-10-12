import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGroupDetail, listGroupLessons } from "../../api/endpoints";
import { Badge, Card, ErrorMessage, extractErrorMessage, Table } from "../../components/ui";
import type { GroupDetail, Lesson } from "../../types";
import { Layout } from "../../components/Layout";

export function TeacherGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGroupDetail(id), listGroupLessons(id)])
      .then(([groupData, lessonsData]) => {
        setGroup(groupData);
        setLessons(lessonsData);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading || !group) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{group.name}</h1>
        <p className="text-sm text-slate-500">
          {group.subject_name} · {group.lesson_price.toLocaleString("uz-UZ")} so'm/dars
        </p>
      </div>
      <ErrorMessage message={error} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="O'quvchilar">
          <Table headers={["F.I.O", "Holat"]}>
            {group.students.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.student_name}</td>
                <td className="px-3 py-2">
                  <Badge color={s.status === "active" ? "green" : s.status === "frozen" ? "amber" : "red"}>
                    {s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Darslar">
          <Table headers={["Sana", "Holat", ""]}>
            {lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-slate-800">{l.lesson_date}</td>
                <td className="px-3 py-2">
                  <Badge color={l.status === "completed" ? "green" : "slate"}>{l.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/teacher/groups/${id}/lessons/${l.id}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    {l.status === "completed" ? "Ko'rish" : "Davomat olish"}
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
