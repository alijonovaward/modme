import { useAuth } from "../../auth/AuthContext";
import { Layout } from "../../components/Layout";

export function StudentDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Layout>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm text-emerald-700">Joriy balans</p>
        <p className="text-2xl font-semibold text-emerald-800">
          {user.balance.toLocaleString("uz-UZ")} so'm
        </p>
      </div>
    </Layout>
  );
}
