import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupDetail } from "../../types";
import { GroupDetailPage } from "./GroupDetailPage";

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../api/endpoints", () => ({
  addStudentToGroup: vi.fn(),
  getGroupDetail: vi.fn(),
  listStaffUsers: vi.fn(),
  listStudents: vi.fn(),
  listSubjects: vi.fn(),
  updateGroup: vi.fn(),
  updateGroupStatus: vi.fn(),
  updateGroupStudentStatus: vi.fn(),
}));

import {
  getGroupDetail,
  listStaffUsers,
  listStudents,
  listSubjects,
  updateGroupStatus,
} from "../../api/endpoints";

function makeGroup(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: 1,
    name: "Math-101",
    subject_id: 1,
    subject_name: "Matematika",
    teacher_id: 2,
    teacher_name: "O'qituvchi",
    lesson_price: 30000,
    status: "active",
    students: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/groups/1"]}>
      <Routes>
        <Route path="/admin/groups/:groupId" element={<GroupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(getGroupDetail).mockReset();
  vi.mocked(listStudents).mockReset().mockResolvedValue([]);
  vi.mocked(listSubjects).mockReset().mockResolvedValue([]);
  vi.mocked(listStaffUsers).mockReset().mockResolvedValue([]);
  vi.mocked(updateGroupStatus).mockReset();
});

describe("GroupDetailPage status controls", () => {
  it("offers Muzlatish/Arxivlash but not Faollashtirish for an active group", async () => {
    vi.mocked(getGroupDetail).mockResolvedValue(makeGroup({ status: "active" }));

    renderPage();

    await screen.findByText("Math-101");
    expect(screen.queryByRole("button", { name: "Faollashtirish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muzlatish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arxivlash" })).toBeInTheDocument();
  });

  it("offers Faollashtirish but not Muzlatish for a frozen group", async () => {
    vi.mocked(getGroupDetail).mockResolvedValue(makeGroup({ status: "frozen" }));

    renderPage();

    await screen.findByText("Math-101");
    expect(screen.getByRole("button", { name: "Faollashtirish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Muzlatish" })).not.toBeInTheDocument();
  });

  it("calls updateGroupStatus with 'frozen' when Muzlatish is clicked, then reloads", async () => {
    vi.mocked(getGroupDetail).mockResolvedValue(makeGroup({ status: "active" }));
    vi.mocked(updateGroupStatus).mockResolvedValue(makeGroup({ status: "frozen" }));

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Math-101");

    await user.click(screen.getByRole("button", { name: "Muzlatish" }));

    expect(updateGroupStatus).toHaveBeenCalledWith(1, "frozen");
    await waitFor(() => expect(getGroupDetail).toHaveBeenCalledTimes(2));
  });
});
