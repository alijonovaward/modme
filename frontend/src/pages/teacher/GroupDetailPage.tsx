import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGroupDetail, listGroupLessons } from "../../api/endpoints";
import {
  Badge,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Pagination,
  Table,
  usePagination,
} from "../../components/ui";
import type { GroupDetail, GroupStudentStatus, Lesson } from "../../types";
import { Layout } from "../../components/Layout";

const ROSTER_STATUS_COLOR = {
  active: "green",
  frozen: "amber",
  dropped: "red",
} as const;

const STATUS_TABS: { value: GroupStudentStatus | ""; label: string }[] = [
  { value: "", label: "Hammasi" },
  { value: "active", label: "Faol" },
  { value: "frozen", label: "Muzlatilgan" },
  { value: "dropped", label: "Arxiv" },
];

export function TeacherGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GroupStudentStatus | "">("");

  useEffect(() => {
    Promise.all([getGroupDetail(id), listGroupLessons(id)])
      .then(([groupData, lessonsData]) => {
        setGroup(groupData);
        setLessons(lessonsData);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  const filteredStudents = useMemo(() => {
    if (!group) return [];
    if (!statusFilter) return group.students;
    return group.students.filter((s) => s.status === statusFilter);
  }, [group, statusFilter]);

  const studentPagination = usePagination(filteredStudents);
  const lessonPagination = usePagination(lessons);

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
          <div className="mb-3 flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Table headers={["F.I.O", "Holat"]}>
            {studentPagination.pageItems.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{s.student_name}</td>
                <td className="px-3 py-2">
                  <Badge color={ROSTER_STATUS_COLOR[s.status]}>{s.status}</Badge>
                  {s.status === "dropped" && s.status_reason && (
                    <p className="mt-1 text-xs text-slate-500">Sababi: {s.status_reason}</p>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={studentPagination.page}
            pageCount={studentPagination.pageCount}
            total={studentPagination.total}
            onPageChange={studentPagination.setPage}
          />
        </Card>
        <Card title="Darslar">
          <Table headers={["Sana", "Holat", ""]}>
            {lessonPagination.pageItems.map((l) => (
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
          <Pagination
            page={lessonPagination.page}
            pageCount={lessonPagination.pageCount}
            total={lessonPagination.total}
            onPageChange={lessonPagination.setPage}
          />
        </Card>
      </div>
    </Layout>
  );
}
