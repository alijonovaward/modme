import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonListItem } from "../../types";
import { toLocalISODate } from "../../utils/date";
import { LessonsPage } from "./LessonsPage";

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../api/endpoints", () => ({
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  generateGroupLessons: vi.fn(),
  getLessonAttendance: vi.fn(),
  listAllLessons: vi.fn(),
  listGroups: vi.fn(),
  listStaffUsers: vi.fn(),
  listSubjects: vi.fn(),
}));

import {
  listAllLessons,
  listGroups,
  listStaffUsers,
  listSubjects,
} from "../../api/endpoints";

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonsPage />
    </MemoryRouter>,
  );
}

function makeLesson(overrides: Partial<LessonListItem> = {}): LessonListItem {
  return {
    id: 1,
    group_id: 1,
    group_name: "Math-101",
    subject_name: "Matematika",
    teacher_id: 1,
    teacher_name: "O'qituvchi",
    lesson_date: toLocalISODate(new Date()),
    start_time: null,
    end_time: null,
    status: "planned",
    present_count: 0,
    excused_count: 0,
    unexcused_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listAllLessons).mockReset();
  vi.mocked(listGroups).mockReset().mockResolvedValue([]);
  vi.mocked(listStaffUsers).mockReset().mockResolvedValue([]);
  vi.mocked(listSubjects).mockReset().mockResolvedValue([]);
});

describe("LessonsPage - list view missed/completed/planned status", () => {
  it("flags a past lesson with no attendance as missed, distinct from completed and upcoming", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(listAllLessons).mockResolvedValue({
      items: [
        makeLesson({ id: 1, group_name: "Completed-Group", status: "completed", lesson_date: toLocalISODate(yesterday) }),
        makeLesson({ id: 2, group_name: "Missed-Group", status: "planned", lesson_date: toLocalISODate(yesterday) }),
        makeLesson({ id: 3, group_name: "Upcoming-Group", status: "planned", lesson_date: toLocalISODate(tomorrow) }),
      ],
      total: 3,
      page: 1,
      page_size: 20,
      completed_count: 1,
      planned_count: 2,
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("📋 Ro'yxat"));
    const table = await screen.findByRole("table");

    const completedRow = within(table).getByText("Completed-Group").closest("tr");
    const missedRow = within(table).getByText("Missed-Group").closest("tr");
    const upcomingRow = within(table).getByText("Upcoming-Group").closest("tr");
    if (!completedRow || !missedRow || !upcomingRow) throw new Error("rows not found");

    expect(within(completedRow).getByText("O'tildi")).toBeInTheDocument();
    expect(within(missedRow).getByText("Davomat olinmagan")).toBeInTheDocument();
    expect(within(upcomingRow).getByText("Rejada")).toBeInTheDocument();
  });
});
