import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceDetail, GroupDetail } from "../../types";
import { AttendancePage } from "./AttendancePage";

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../api/endpoints", () => ({
  getGroupDetail: vi.fn(),
  getLessonAttendance: vi.fn(),
  submitAttendance: vi.fn(),
  updateAttendance: vi.fn(),
}));

import {
  getGroupDetail,
  getLessonAttendance,
  submitAttendance,
  updateAttendance,
} from "../../api/endpoints";

function makeGroup(): GroupDetail {
  return {
    id: 1,
    name: "Math-101",
    subject_id: 1,
    subject_name: "Matematika",
    teacher_id: 2,
    teacher_name: "O'qituvchi",
    lesson_price: 30000,
    status: "active",
    students: [
      { id: 1, student_id: 10, student_name: "Student A", student_phone: "+1", status: "active", status_reason: null },
      { id: 2, student_id: 11, student_name: "Student B", student_phone: "+2", status: "active", status_reason: null },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/teacher/groups/1/lessons/5"]}>
      <Routes>
        <Route path="/teacher/groups/:groupId/lessons/:lessonId" element={<AttendancePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(getGroupDetail).mockReset().mockResolvedValue(makeGroup());
  vi.mocked(getLessonAttendance).mockReset();
  vi.mocked(submitAttendance).mockReset();
  vi.mocked(updateAttendance).mockReset();
});

describe("AttendancePage - first-time submission", () => {
  it("submits records for every active student when no attendance exists yet", async () => {
    vi.mocked(getLessonAttendance).mockResolvedValue([]);
    vi.mocked(submitAttendance).mockResolvedValue([]);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Student A");
    expect(screen.getByRole("button", { name: "Davomatni saqlash" })).toBeInTheDocument();

    for (const name of ["Student A", "Student B"]) {
      const row = screen.getByText(name).closest("tr");
      if (!row) throw new Error("row not found");
      const gradeSelect = within(row).getAllByRole("combobox")[1];
      await user.selectOptions(gradeSelect, "5");
    }

    await user.click(screen.getByRole("button", { name: "Davomatni saqlash" }));

    await waitFor(() => expect(submitAttendance).toHaveBeenCalledTimes(1));
    const [, records] = vi.mocked(submitAttendance).mock.calls[0];
    expect(records).toEqual([
      { student_id: 10, status: "present", grade: 5 },
      { student_id: 11, status: "present", grade: 5 },
    ]);
  });
});

describe("AttendancePage - correcting existing attendance", () => {
  function existingAttendance(): AttendanceDetail[] {
    return [
      { id: 1, lesson_id: 5, student_id: 10, student_name: "Student A", status: "present", grade: 5 },
      { id: 2, lesson_id: 5, student_id: 11, student_name: "Student B", status: "present", grade: 4 },
    ];
  }

  it("disables the save button until a row is actually changed", async () => {
    vi.mocked(getLessonAttendance).mockResolvedValue(existingAttendance());

    renderPage();

    await screen.findByText("Student A");
    expect(screen.getByRole("button", { name: "Tuzatishlarni saqlash" })).toBeDisabled();
  });

  it("only calls updateAttendance for the student whose row actually changed", async () => {
    vi.mocked(getLessonAttendance).mockResolvedValue(existingAttendance());
    vi.mocked(updateAttendance).mockResolvedValue({ id: 2, lesson_id: 5, student_id: 11, status: "excused", grade: null });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Student A");
    const rowB = screen.getByText("Student B").closest("tr");
    if (!rowB) throw new Error("row not found");

    const statusSelect = within(rowB).getAllByRole("combobox")[0];
    await user.selectOptions(statusSelect, "excused");

    const saveButton = screen.getByRole("button", { name: "Tuzatishlarni saqlash" });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => expect(updateAttendance).toHaveBeenCalledTimes(1));
    expect(updateAttendance).toHaveBeenCalledWith(5, 11, { status: "excused", grade: null });
  });
});
