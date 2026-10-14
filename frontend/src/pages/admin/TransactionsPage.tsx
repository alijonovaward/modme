import { useEffect, useState } from "react";
import { listGroups, listStaffUsers, listStudents, listTransactions } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import { Badge, Button, Card, Combobox, ErrorMessage, extractErrorMessage, Input, Label, Select, Table } from "../../components/ui";
import type { GroupListItem, TransactionListItem, User } from "../../types";
import { Layout } from "../../components/Layout";

export function TransactionsPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  const [adminFilter, setAdminFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await listTransactions({
        created_by_id: adminFilter ? Number(adminFilter) : undefined,
        group_id: groupFilter ? Number(groupFilter) : undefined,
        student_id: studentFilter ? Number(studentFilter) : undefined,
        type: typeFilter ? (typeFilter as "deposit" | "deduction") : undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
      });
      setTransactions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    listGroups().then(setGroups).catch(() => undefined);
    listStudents().then(setStudents).catch(() => undefined);
    if (isSuperadmin) {
      listStaffUsers().then(setAdmins).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <Card title="Tranzaksiyalar tarixi">
        <ErrorMessage message={error} />
        {!isSuperadmin && (
          <p className="mb-4 text-sm text-slate-500">
            Faqat o'zingiz amalga oshirgan tranzaksiyalar ko'rsatilmoqda.
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>Dan</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Gacha</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label>Turi</Label>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
              <option value="">Barchasi</option>
              <option value="deposit">To'ldirish</option>
              <option value="deduction">Yechim</option>
            </Select>
          </div>
          <div>
            <Label>O'quvchi</Label>
            <Combobox
              className="w-48"
              value={studentFilter}
              onChange={setStudentFilter}
              placeholder="Barcha o'quvchilar"
              options={[
                { value: "", label: "Barcha o'quvchilar" },
                ...students.map((s) => ({ value: String(s.id), label: s.full_name })),
              ]}
            />
          </div>
          <div>
            <Label>Guruh</Label>
            <Combobox
              className="w-48"
              value={groupFilter}
              onChange={setGroupFilter}
              placeholder="Barcha guruhlar"
              options={[
                { value: "", label: "Barcha guruhlar" },
                ...groups.map((g) => ({ value: String(g.id), label: g.name })),
              ]}
            />
          </div>
          {isSuperadmin && (
            <div>
              <Label>Kim tomonidan</Label>
              <Combobox
                className="w-48"
                value={adminFilter}
                onChange={setAdminFilter}
                placeholder="Barcha xodimlar"
                options={[
                  { value: "", label: "Barcha xodimlar" },
                  ...admins
                    .filter((a) => a.role === "admin" || a.role === "superadmin")
                    .map((a) => ({ value: String(a.id), label: a.full_name })),
                ]}
              />
            </div>
          )}
          <Button onClick={load}>Filtrlash</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <Table headers={["Sana", "O'quvchi", "Guruh", "Turi", "Summa", "Kim tomonidan", "Izoh"]}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(t.created_at).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{t.student_name}</td>
                <td className="px-3 py-2 text-slate-600">{t.group_name ?? "-"}</td>
                <td className="px-3 py-2">
                  <Badge color={t.type === "deposit" ? "green" : "red"}>
                    {t.type === "deposit" ? "To'ldirish" : "Yechim"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {t.amount.toLocaleString("uz-UZ")} so'm
                </td>
                <td className="px-3 py-2 text-slate-600">{t.created_by_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{t.comment ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Layout>
  );
}
