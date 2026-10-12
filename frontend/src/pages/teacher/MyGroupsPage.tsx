import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listGroups } from "../../api/endpoints";
import { Badge, Card, ErrorMessage, extractErrorMessage, Table } from "../../components/ui";
import type { GroupListItem } from "../../types";
import { Layout } from "../../components/Layout";

export function MyGroupsPage() {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Layout>
      <Card title="Mening guruhlarim">
        <ErrorMessage message={error} />
        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <Table headers={["Nomi", "Fan", "Dars narxi", "Holat", ""]}>
            {groups.map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{g.name}</td>
                <td className="px-3 py-2 text-slate-600">{g.subject_name}</td>
                <td className="px-3 py-2 text-slate-600">
                  {g.lesson_price.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2">
                  <Badge color={g.status === "active" ? "green" : "slate"}>{g.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Link to={`/teacher/groups/${g.id}`} className="text-sm text-indigo-600 hover:underline">
                    Davomat olish
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Layout>
  );
}
