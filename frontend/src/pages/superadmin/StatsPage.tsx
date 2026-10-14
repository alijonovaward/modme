import { useEffect, useState } from "react";
import { getStatsOverview } from "../../api/endpoints";
import { Card, ErrorMessage, extractErrorMessage, Input, Label, StatTile } from "../../components/ui";
import type { StatsOverview } from "../../types";
import { Layout } from "../../components/Layout";

function formatSom(amount: number): string {
  return `${amount.toLocaleString("uz-UZ")} so'm`;
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (from?: string, to?: string) => {
    setIsLoading(true);
    try {
      const data = await getStatsOverview({
        date_from: from ? `${from}T00:00:00` : undefined,
        date_to: to ? `${to}T23:59:59` : undefined,
      });
      setStats(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = () => {
    load(dateFrom || undefined, dateTo || undefined);
  };

  return (
    <Layout>
      <Card
        title="Statistika"
        action={
          <div className="flex items-end gap-2">
            <div>
              <Label>Dan</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Gacha</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <button
              onClick={handleFilter}
              className="h-[38px] rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Filtrlash
            </button>
          </div>
        }
      >
        <ErrorMessage message={error} />
        {isLoading || !stats ? (
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Jami kiritilgan pul"
              value={formatSom(stats.total_deposits)}
              color="green"
            />
            <StatTile
              label="Darslar uchun yechilgan pul"
              value={formatSom(stats.total_deductions)}
              color="red"
            />
            <StatTile
              label="O'qituvchilarga tushum"
              value={formatSom(stats.total_teacher_earnings)}
              color="indigo"
            />
            <StatTile
              label="O'qituvchilarga berilgan pul"
              value={formatSom(stats.total_teacher_payouts)}
              color="amber"
            />
          </div>
        )}
      </Card>
    </Layout>
  );
}
