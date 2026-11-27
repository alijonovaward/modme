import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  deleteStaffUser,
  getStaffUser,
  getTeacherFinanceById,
  getTeacherStats,
  listGroups,
  listSubjects,
  payoutTeacher,
  restoreStaffUser,
  reverseTeacherTransaction,
  updateStaffStatus,
  updateStaffUser,
  updateUserPassword,
} from "../../api/endpoints";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ConfirmModal,
  ErrorMessage,
  extractErrorMessage,
  Input,
  Label,
  MobileList,
  MobileListRow,
  Modal,
  Pagination,
  StatTile,
  SuccessMessage,
  Table,
  usePagination,
} from "../../components/ui";
import type { GroupListItem, Subject, TeacherStats, TeacherTransaction, User } from "../../types";
import { Layout } from "../../components/Layout";
import { useAuth } from "../../auth/AuthContext";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { currentMonthRange } from "../../utils/date";
import { downloadXlsx } from "../../utils/download";

interface FinanceFilters {
  dateFrom: string;
  dateTo: string;
  subjectId: string;
  groupId: string;
}

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  ...currentMonthRange(),
  subjectId: "",
  groupId: "",
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Bosh Admin",
  admin: "Administrator",
  teacher: "O'qituvchi",
};

export function StaffDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);
  const { user: viewer } = useAuth();

  const [staffMember, setStaffMember] = useState<User | null>(null);
  const [finance, setFinance] = useState<TeacherTransaction[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FinanceFilters>(DEFAULT_FINANCE_FILTERS);
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>(DEFAULT_FINANCE_FILTERS);

  const [newPassword, setNewPassword] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutComment, setPayoutComment] = useState("");
  const payoutIdempotencyKey = useIdempotencyKey();
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isPayoutConfirmOpen, setIsPayoutConfirmOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleActiveConfirmOpen, setIsToggleActiveConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<TeacherTransaction | null>(null);
  const [isReversing, setIsReversing] = useState(false);
  const reverseIdempotencyKey = useIdempotencyKey();

  const load = async (filters: FinanceFilters = financeFilters) => {
    setIsLoading(true);
    try {
      const found = await getStaffUser(id);
      setStaffMember(found);
      setEditFullName(found.full_name);
      setEditPhone(found.phone);
      setEditPercentage(found.teacher_percentage != null ? String(found.teacher_percentage) : "");
      const isTeacherTarget = found?.role === "teacher";
      const canViewAdminFinance = found?.role === "admin" && viewer?.role === "superadmin";
      if (isTeacherTarget || canViewAdminFinance) {
        const params = {
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          group_id: filters.groupId ? Number(filters.groupId) : undefined,
        };
        if (isTeacherTarget) {
          const [financeData, statsData] = await Promise.all([
            getTeacherFinanceById(id, params),
            getTeacherStats(id, params),
          ]);
          setFinance(financeData);
          setStats(statsData);
        } else {
          setFinance(await getTeacherFinanceById(id, params));
          setStats(null);
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_FINANCE_FILTERS);
    listSubjects().then(setSubjects).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (staffMember?.role === "teacher") {
      listGroups(staffMember.id).then(setGroups).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffMember?.id]);

  const openFilterModal = () => {
    setFilterDraft(financeFilters);
    setIsFilterModalOpen(true);
  };

  const applyFinanceFilters = () => {
    setFinanceFilters(filterDraft);
    setIsFilterModalOpen(false);
    load(filterDraft);
  };

  const clearFinanceFilters = () => {
    setFilterDraft(DEFAULT_FINANCE_FILTERS);
    setFinanceFilters(DEFAULT_FINANCE_FILTERS);
    setIsFilterModalOpen(false);
    load(DEFAULT_FINANCE_FILTERS);
  };

  const financeFilterGroupOptions = groups.filter(
    (g) => !filterDraft.subjectId || String(g.subject_id) === filterDraft.subjectId,
  );
  const financeActiveFilterCount = [financeFilters.subjectId, financeFilters.groupId].filter(
    Boolean,
  ).length;

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await updateStaffUser(id, {
        full_name: editFullName,
        phone: editPhone,
        teacher_percentage: staffMember.role === "teacher" ? Number(editPercentage) : undefined,
      });
      if (newPassword.trim()) {
        await updateUserPassword(id, newPassword.trim());
      }
      setSuccess(newPassword.trim() ? "Ma'lumotlar va parol saqlandi" : "Ma'lumotlar saqlandi");
      setNewPassword("");
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    try {
      await updateStaffStatus(id, !staffMember.is_active);
      setSuccess(staffMember.is_active ? "Xodim bloklandi" : "Xodim faollashtirildi");
      setIsToggleActiveConfirmOpen(false);
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    try {
      await deleteStaffUser(id);
      setSuccess("Xodim o'chirildi");
      setIsDeleteConfirmOpen(false);
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleRestore = async () => {
    if (!staffMember) return;
    setError(null);
    setSuccess(null);
    try {
      await restoreStaffUser(id);
      setSuccess("Xodim tiklandi");
      setIsRestoreConfirmOpen(false);
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const requestPayout = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) return;
    setIsPayoutConfirmOpen(true);
  };

  const confirmPayout = async () => {
    if (!staffMember || isSubmitting) return;
    const amount = Number(payoutAmount);
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await payoutTeacher(id, amount, payoutComment || undefined, payoutIdempotencyKey.get());
      payoutIdempotencyKey.renew();
      setSuccess("Pul berildi");
      setPayoutAmount("");
      setPayoutComment("");
      setIsPayoutConfirmOpen(false);
      setIsPayoutModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget || isReversing) return;
    setError(null);
    setSuccess(null);
    setIsReversing(true);
    try {
      await reverseTeacherTransaction(reverseTarget.id, reverseIdempotencyKey.get());
      reverseIdempotencyKey.renew();
      setSuccess("To'lov bekor qilindi, summa balansga qaytarildi");
      setReverseTarget(null);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsReversing(false);
    }
  };

  const totalEarnings = finance
    .filter((t) => t.type === "lesson_earning")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayouts = Math.abs(
    finance.filter((t) => t.type === "payout").reduce((sum, t) => sum + t.amount, 0),
  );
  const totalRemaining = totalEarnings - totalPayouts;

  const { page, setPage, pageCount, pageItems, total } = usePagination(finance);

  if (isLoading || !staffMember) {
    return (
      <Layout>
        <ErrorMessage message={error} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda...</p>
      </Layout>
    );
  }

  const isTeacherTarget = staffMember.role === "teacher";
  const canPayout = isTeacherTarget || (staffMember.role === "admin" && viewer?.role === "superadmin");

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              {staffMember.full_name}
            </h1>
            <button
              onClick={() => {
                setNewPassword("");
                setIsEditModalOpen(true);
              }}
              aria-label="Tahrirlash"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125 16.862 4.487" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {staffMember.deleted_at ? (
              <Badge color="red">O'chirilgan</Badge>
            ) : (
              !staffMember.is_active && <Badge color="red">Bloklangan</Badge>
            )}
            <Badge color={staffMember.telegram_linked ? "green" : "slate"}>
              Telegram: {staffMember.telegram_linked ? "Ulangan" : "Ulanmagan"}
            </Badge>
            <Badge color={staffMember.role === "superadmin" ? "amber" : "slate"}>
              {ROLE_LABEL[staffMember.role] ?? staffMember.role}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {staffMember.phone}
            {staffMember.teacher_percentage !== null && (
              <span className="ml-2">· Foiz: {staffMember.teacher_percentage}%</span>
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-2.5 text-base text-slate-600 dark:text-slate-400">
            <span>
              Balans:{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {staffMember.balance.toLocaleString("uz-UZ")} so'm
              </span>
            </span>
            {canPayout && (
              <button
                onClick={() => setIsPayoutModalOpen(true)}
                aria-label="Pul berish"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition-colors hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
                  <path strokeLinecap="round" d="M5 12h14" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      {canPayout && (
        <div className="mt-6">
          <Card
            title="Moliya tarixi"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadXlsx(
                      `/api/v1/teachers/${id}/finance/export`,
                      {
                        date_from: financeFilters.dateFrom || undefined,
                        date_to: financeFilters.dateTo || undefined,
                        group_id: financeFilters.groupId ? Number(financeFilters.groupId) : undefined,
                      },
                      `${staffMember.full_name}_moliyasi.xlsx`,
                    )
                  }
                >
                  Excel'ga chiqarish
                </Button>
                <Button onClick={openFilterModal}>
                  Filterlar{financeActiveFilterCount > 0 ? ` (${financeActiveFilterCount})` : ""}
                </Button>
              </div>
            }
          >
            {(financeFilters.dateFrom || financeFilters.dateTo) && (
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Davr: {financeFilters.dateFrom || "..."} — {financeFilters.dateTo || "..."}
              </p>
            )}
            {isTeacherTarget ? (
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  label="Jami dars daromadi"
                  value={`${totalEarnings.toLocaleString("uz-UZ")} so'm`}
                  color="green"
                />
                <StatTile
                  label="Jami qolgan"
                  value={`${totalRemaining.toLocaleString("uz-UZ")} so'm`}
                  color="indigo"
                />
                <StatTile
                  label="Jami pul berilgan"
                  value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
                  color="red"
                />
              </div>
            ) : (
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatTile
                  label="Jami to'langan"
                  value={`${totalPayouts.toLocaleString("uz-UZ")} so'm`}
                  color="red"
                />
              </div>
            )}
            {isTeacherTarget && (
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  label="Faol o'quvchilar"
                  value={String(stats?.active_student_count ?? 0)}
                  color="slate"
                />
                <StatTile
                  label="O'tilgan darslar"
                  value={String(stats?.completed_lesson_count ?? 0)}
                  color="amber"
                />
                <StatTile
                  label="Davomat foizi"
                  value={`${(stats?.attendance_rate ?? 0).toLocaleString("uz-UZ")}%`}
                  color="violet"
                />
              </div>
            )}
            <div className="hidden sm:block">
              <Table headers={["Sana", "Turi", "O'quvchi", "Guruh", "Summa", "Izoh", ""]}>
                {pageItems.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {new Date(t.created_at).toLocaleString("uz-UZ")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                        {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.student_name ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{t.group_name ?? "-"}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {t.amount.toLocaleString("uz-UZ")} so'm
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{t.comment ?? "-"}</td>
                    <td className="px-3 py-2">
                      {viewer?.role === "superadmin" && t.type === "payout" && (
                        t.reversed_at ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Bekor qilingan</span>
                        ) : (
                          <button
                            onClick={() => setReverseTarget(t)}
                            className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                          >
                            Bekor qilish
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>

            <MobileList>
              {pageItems.map((t) => (
                <MobileListRow key={t.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {t.student_name ?? t.group_name ?? "-"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {t.group_name ?? "-"} · {new Date(t.created_at).toLocaleDateString("uz-UZ")}
                    </p>
                    {viewer?.role === "superadmin" && t.type === "payout" && (
                      t.reversed_at ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500">Bekor qilingan</p>
                      ) : (
                        <button
                          onClick={() => setReverseTarget(t)}
                          className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                        >
                          Bekor qilish
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {t.amount.toLocaleString("uz-UZ")} so'm
                    </p>
                    <Badge color={t.type === "lesson_earning" ? "green" : "red"}>
                      {t.type === "lesson_earning" ? "Dars daromadi" : "Pul berildi"}
                    </Badge>
                  </div>
                </MobileListRow>
              ))}
            </MobileList>

            <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          </Card>
        </div>
      )}

      {isFilterModalOpen && (
        <Modal title="Filterlar" onClose={() => setIsFilterModalOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dan</Label>
                <Input
                  type="date"
                  value={filterDraft.dateFrom}
                  onChange={(e) => setFilterDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Gacha</Label>
                <Input
                  type="date"
                  value={filterDraft.dateTo}
                  onChange={(e) => setFilterDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
            {isTeacherTarget && (
              <>
                <div>
                  <Label>Fan</Label>
                  <Combobox
                    value={filterDraft.subjectId}
                    onChange={(value) =>
                      setFilterDraft((prev) => ({ ...prev, subjectId: value, groupId: "" }))
                    }
                    placeholder="Barcha fanlar"
                    options={[
                      { value: "", label: "Barcha fanlar" },
                      ...subjects.map((s) => ({ value: String(s.id), label: s.name })),
                    ]}
                  />
                </div>
                <div>
                  <Label>Guruh</Label>
                  <Combobox
                    value={filterDraft.groupId}
                    onChange={(value) => setFilterDraft((prev) => ({ ...prev, groupId: value }))}
                    placeholder="Barcha guruhlar"
                    options={[
                      { value: "", label: "Barcha guruhlar" },
                      ...financeFilterGroupOptions.map((g) => ({ value: String(g.id), label: g.name })),
                    ]}
                  />
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={applyFinanceFilters}>
                Qo'llash
              </Button>
              <Button variant="secondary" onClick={clearFinanceFilters}>
                Tozalash
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isPayoutModalOpen && (
        <Modal title="Pul berish (balansdan yechish)" onClose={() => setIsPayoutModalOpen(false)}>
          <form onSubmit={requestPayout} className="space-y-4">
            <div>
              <Label>Summa</Label>
              <Input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Izoh (ixtiyoriy)</Label>
              <Input
                value={payoutComment}
                onChange={(e) => setPayoutComment(e.target.value)}
                placeholder="Masalan: Oylik to'lov"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Berish
            </Button>
          </form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={isPayoutConfirmOpen}
        title="Pul berishni tasdiqlang"
        message={`${staffMember.full_name}ga ${Number(payoutAmount || 0).toLocaleString("uz-UZ")} so'm berilsinmi? Summani diqqat bilan tekshiring.`}
        confirmLabel="Ha, berish"
        variant="danger"
        isLoading={isSubmitting}
        onConfirm={confirmPayout}
        onClose={() => setIsPayoutConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={reverseTarget !== null}
        title="To'lovni bekor qilish"
        message={
          reverseTarget
            ? `${Math.abs(reverseTarget.amount).toLocaleString("uz-UZ")} so'mlik to'lov bekor qilinsinmi? Summa balansga qaytariladi.`
            : ""
        }
        confirmLabel="Ha, bekor qilish"
        variant="danger"
        isLoading={isReversing}
        onConfirm={handleReverse}
        onClose={() => setReverseTarget(null)}
      />

      {isEditModalOpen && (
        <Modal title="Ma'lumotlarni tahrirlash" onClose={() => setIsEditModalOpen(false)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>F.I.O</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required />
            </div>
            {staffMember.role === "teacher" && (
              <div>
                <Label>Foiz stavkasi (%)</Label>
                <Input
                  type="number"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <Label>Yangi parol (ixtiyoriy)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Bo'sh qoldirilsa, parol eskiligicha qoladi.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Saqlash
            </Button>
          </form>

          {staffMember.role !== "superadmin" && (
            <>
              <div className="my-5 border-t border-slate-100 dark:border-slate-800" />

              {staffMember.deleted_at ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setIsRestoreConfirmOpen(true)}
                >
                  Tiklash
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant={staffMember.is_active ? "danger" : "secondary"}
                    className="w-full"
                    onClick={() => setIsToggleActiveConfirmOpen(true)}
                  >
                    {staffMember.is_active ? "Bloklash" : "Faollashtirish"}
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    O'chirish
                  </Button>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      <ConfirmModal
        isOpen={isToggleActiveConfirmOpen}
        title={staffMember.is_active ? "Bloklashni tasdiqlang" : "Faollashtirishni tasdiqlang"}
        message={
          staffMember.is_active
            ? isTeacherTarget
              ? `${staffMember.full_name} bloklansinmi? Uning dars o'tayotgan barcha faol guruhlari avtomatik muzlatiladi.`
              : `${staffMember.full_name} bloklansinmi?`
            : `${staffMember.full_name} faollashtirilsinmi?`
        }
        confirmLabel={staffMember.is_active ? "Ha, bloklash" : "Ha, faollashtirish"}
        variant="danger"
        onConfirm={handleToggleActive}
        onClose={() => setIsToggleActiveConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="O'chirishni tasdiqlang"
        message={
          isTeacherTarget
            ? `${staffMember.full_name} o'chirilsinmi? U ro'yxat va qidiruvdan butunlay yashiriladi, dars o'tayotgan barcha faol guruhlari muzlatiladi. Keyin "O'chirilganlar" filtri orqali topib tiklash mumkin.`
            : `${staffMember.full_name} o'chirilsinmi? U ro'yxat va qidiruvdan butunlay yashiriladi. Keyin "O'chirilganlar" filtri orqali topib tiklash mumkin.`
        }
        confirmLabel="Ha, o'chirish"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setIsDeleteConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isRestoreConfirmOpen}
        title="Tiklashni tasdiqlang"
        message={`${staffMember.full_name} tiklansinmi? U qaytadan ro'yxat va qidiruvda ko'rinadi.`}
        confirmLabel="Ha, tiklash"
        variant="primary"
        onConfirm={handleRestore}
        onClose={() => setIsRestoreConfirmOpen(false)}
      />
    </Layout>
  );
}
