import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../types";
import { StudentsPage } from "./StudentsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentsPage />
    </MemoryRouter>,
  );
}

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../api/endpoints", () => ({
  listStudentsPage: vi.fn(),
  createStudent: vi.fn(),
}));

import { listStudentsPage } from "../../api/endpoints";

function makeStudent(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    full_name: "Ali Valiyev",
    phone: "+998901234567",
    role: "student",
    teacher_percentage: null,
    balance: 10000,
    is_active: true,
    created_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listStudentsPage).mockReset();
});

describe("StudentsPage", () => {
  it("renders students returned from the server and requests page 1 by default", async () => {
    vi.mocked(listStudentsPage).mockResolvedValue({
      items: [makeStudent()],
      total: 1,
      page: 1,
      page_size: 10,
      debtor_count: 0,
    });

    renderPage();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    expect(listStudentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 10 }),
    );
  });

  it("refetches with debtors_only when the debtor filter is toggled", async () => {
    vi.mocked(listStudentsPage).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      debtor_count: 2,
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listStudentsPage).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Qarzdorlar/ }));

    await waitFor(() =>
      expect(listStudentsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ debtors_only: true, page: 1 }),
      ),
    );
  });

  it("debounces search input before refetching", async () => {
    vi.mocked(listStudentsPage).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      debtor_count: 0,
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listStudentsPage).toHaveBeenCalledTimes(1));

    await user.type(screen.getByPlaceholderText(/qidirish/i), "Ali");

    expect(listStudentsPage).toHaveBeenCalledTimes(1);

    await waitFor(
      () =>
        expect(listStudentsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "Ali", page: 1 }),
        ),
      { timeout: 1000 },
    );
  });

  it("requests the next page when pagination is clicked", async () => {
    vi.mocked(listStudentsPage).mockResolvedValue({
      items: [makeStudent()],
      total: 25,
      page: 1,
      page_size: 10,
      debtor_count: 0,
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ali Valiyev");

    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));

    await waitFor(() =>
      expect(listStudentsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
  });
});
