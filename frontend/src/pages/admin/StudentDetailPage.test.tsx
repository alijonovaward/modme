import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../types";
import { StudentDetailPage } from "./StudentDetailPage";

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../api/endpoints", () => ({
  depositToStudent: vi.fn(),
  withdrawFromStudent: vi.fn(),
  deleteStudent: vi.fn(),
  getStudent: vi.fn(),
  getStudentAttendanceHistory: vi.fn(),
  getStudentGroups: vi.fn(),
  getStudentPendingCharges: vi.fn(),
  restoreStudent: vi.fn(),
  updateStudent: vi.fn(),
  updateStudentStatus: vi.fn(),
  updateUserPassword: vi.fn(),
}));

import {
  depositToStudent,
  getStudent,
  getStudentAttendanceHistory,
  getStudentGroups,
  getStudentPendingCharges,
  withdrawFromStudent,
} from "../../api/endpoints";

function makeStudent(): User {
  return {
    id: 7,
    full_name: "Test O'quvchi",
    phone: "+998900000007",
    role: "student",
    teacher_percentage: null,
    balance: 50000,
    is_active: true,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00",
    telegram_linked: false,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/students/7"]}>
      <Routes>
        <Route path="/admin/students/:studentId" element={<StudentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(getStudent).mockReset().mockResolvedValue(makeStudent());
  vi.mocked(getStudentAttendanceHistory).mockReset().mockResolvedValue([]);
  vi.mocked(getStudentGroups).mockReset().mockResolvedValue([]);
  vi.mocked(getStudentPendingCharges).mockReset().mockResolvedValue([]);
  vi.mocked(depositToStudent).mockReset();
  vi.mocked(withdrawFromStudent).mockReset();
});

describe("StudentDetailPage - balance +/- buttons", () => {
  it("opens the deposit modal from the + button and the withdraw modal from the - button", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Test O'quvchi");

    await user.click(screen.getByRole("button", { name: "Balansni to'ldirish" }));
    expect(screen.getByRole("heading", { name: "Balansni to'ldirish" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yopish" }));

    await user.click(screen.getByRole("button", { name: "Pul qaytarish" }));
    expect(screen.getByRole("heading", { name: "Pulni qaytarib berish" })).toBeInTheDocument();
  });

  it("submits the entered amount through withdrawFromStudent", async () => {
    vi.mocked(withdrawFromStudent).mockResolvedValue({
      id: 1,
      student_id: 7,
      amount: -10000,
      type: "deduction",
      comment: null,
      created_at: "2026-01-01T00:00:00",
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Test O'quvchi");
    await user.click(screen.getByRole("button", { name: "Pul qaytarish" }));

    const modal = screen.getByRole("heading", { name: "Pulni qaytarib berish" }).closest("div");
    if (!modal?.parentElement) throw new Error("modal not found");
    const amountInput = modal.parentElement.querySelector("input[type='number']");
    if (!amountInput) throw new Error("amount input not found");
    await user.type(amountInput, "10000");

    await user.click(screen.getByRole("button", { name: "Qaytarib berish" }));

    expect(withdrawFromStudent).toHaveBeenCalledWith(7, 10000, undefined, expect.any(String));
  });
});
