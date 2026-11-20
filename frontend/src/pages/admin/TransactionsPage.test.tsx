import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", full_name: "Admin", phone: "+1", balance: 0, is_active: true, teacher_percentage: null, created_at: "", telegram_linked: false },
  }),
}));

vi.mock("../../api/endpoints", () => ({
  listTransactions: vi.fn(),
  listAllTeacherTransactions: vi.fn(),
  listGroups: vi.fn(),
  listStudents: vi.fn(),
  listStaffUsers: vi.fn(),
  listSubjects: vi.fn(),
}));

import {
  listGroups,
  listStaffUsers,
  listStudents,
  listSubjects,
  listTransactions,
} from "../../api/endpoints";

function renderWithState(studentId?: number) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/admin/transactions", state: studentId ? { studentId } : undefined }]}
    >
      <Routes>
        <Route path="/admin/transactions" element={<TransactionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(listTransactions).mockReset().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_deposits: 0,
    total_deductions: 0,
  });
  vi.mocked(listGroups).mockReset().mockResolvedValue([]);
  vi.mocked(listStudents).mockReset().mockResolvedValue([]);
  vi.mocked(listStaffUsers).mockReset().mockResolvedValue([]);
  vi.mocked(listSubjects).mockReset().mockResolvedValue([]);
});

describe("TransactionsPage - deep link from a student profile", () => {
  it("defaults to the current month and no student filter when opened directly", async () => {
    renderWithState(undefined);

    await screen.findByText("Tranzaksiyalar tarixi");
    const call = vi.mocked(listTransactions).mock.calls[0][0];
    expect(call?.student_id).toBeUndefined();
    expect(call?.date_from).toBeTruthy();
  });

  it("pre-filters by student and clears the date range when navigated with a studentId", async () => {
    renderWithState(42);

    await screen.findByText("Tranzaksiyalar tarixi");
    const call = vi.mocked(listTransactions).mock.calls[0][0];
    expect(call?.student_id).toBe(42);
    expect(call?.date_from).toBeUndefined();
    expect(call?.date_to).toBeUndefined();
  });
});
