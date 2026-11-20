import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGroupDetail, listGroups } from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Modal,
  Pagination,
  Table,
  usePagination,
} from "../../components/ui";
import type { GroupListItem } from "../../types";
import { Layout } from "../../components/Layout";
import { downloadXlsx } from "../../utils/download";
import { formatSchedule } from "../../utils/weekdays";
import { useAuth } from "../../auth/AuthContext";

export function MyGroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [statsGroup, setStatsGroup] = useState<GroupListItem | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const openStats = (g: GroupListItem) => {
    setStatsGroup(g);
    setStudentCount(null);
    setStatsLoading(true);
    getGroupDetail(g.id)
      .then((detail) =>
        setStudentCount(detail.students.filter((s) => s.status === "active").length),
      )
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(term) || g.subject_name.toLowerCase().includes(term),
    );
  }, [groups, search]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(filteredGroups);

  return (
    <Layout>
      <Card title="Mening guruhlarim">
        <ErrorMessage message={error} />
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Guruh yoki fan nomi bo'yicha qidirish"
            className="max-w-md flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => downloadXlsx("/api/v1/groups/export", undefined, "guruhlarim.xlsx")}
          >
            Excel'ga chiqarish
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
        ) : (
          <>
          <Table headers={["Nomi", "Fan", "Soati", "Holat"]}>
            {pageItems.map((g) => (
              <tr
                key={g.id}
                onClick={() => navigate(`/teacher/groups/${g.id}`)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/60 active:scale-[0.99] dark:hover:bg-indigo-950/40"
              >
                <td
                  onClick={(e) => {
                    e.stopPropagation();
                    openStats(g);
                  }}
                  className="px-3.5 py-2.5 font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
                >
                  {g.name}
                </td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{g.subject_name}</td>
                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                  {formatSchedule(g.schedule)}
                </td>
                <td className="px-3.5 py-2.5">
                  <Badge color={g.status === "active" ? "green" : "slate"}>{g.status}</Badge>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {statsGroup && (
        <Modal title={statsGroup.name} onClose={() => setStatsGroup(null)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mening foizim</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {user?.teacher_percentage ?? 0}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Faol o'quvchilar</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {statsLoading ? "..." : studentCount ?? 0}
              </p>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Dars narxi</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {statsGroup.lesson_price.toLocaleString("uz-UZ")} so'm
              </p>
            </div>
          </div>
          <Button
            className="mt-5 w-full"
            onClick={() => navigate(`/teacher/groups/${statsGroup.id}`)}
          >
            Guruhga kirish
          </Button>
        </Modal>
      )}
    </Layout>
  );
}
