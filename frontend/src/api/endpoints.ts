import { apiClient } from "./client";
import type {
  Attendance,
  AttendanceDetail,
  AttendanceStatus,
  GroupDetail,
  GroupListItem,
  Lesson,
  LessonListPage,
  LessonStatus,
  StaffListPage,
  StatsOverview,
  StudentAttendanceHistoryItem,
  StudentListPage,
  StudentTransactionListItem,
  Subject,
  TeacherTransaction,
  TeacherTransactionListPage,
  Transaction,
  TransactionListPage,
  User,
  UserRole,
} from "../types";

export async function login(phone: string, password: string): Promise<string> {
  const form = new URLSearchParams();
  form.set("username", phone);
  form.set("password", password);
  const { data } = await apiClient.post<{ access_token: string }>(
    "/api/v1/auth/login",
    form,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return data.access_token;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/api/v1/auth/me");
  return data;
}

export async function listStaffUsers(role?: UserRole): Promise<User[]> {
  const { data } = await apiClient.get<StaffListPage>("/api/v1/admin/users", {
    params: { role, page_size: 500 },
  });
  return data.items;
}

export async function listStaffUsersPage(params: {
  role?: UserRole;
  search?: string;
  page: number;
  page_size: number;
}): Promise<StaffListPage> {
  const { data } = await apiClient.get<StaffListPage>("/api/v1/admin/users", { params });
  return data;
}

export async function createStaffUser(payload: {
  full_name: string;
  phone: string;
  password: string;
  role: "admin" | "teacher";
  teacher_percentage?: number;
}): Promise<User> {
  const { data } = await apiClient.post<User>("/api/v1/admin/users", payload);
  return data;
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<User> {
  const { data } = await apiClient.put<User>(`/api/v1/admin/users/${userId}/password`, {
    new_password: newPassword,
  });
  return data;
}

export async function updateStaffUser(
  userId: number,
  payload: { full_name: string; phone: string; teacher_percentage?: number | null },
): Promise<User> {
  const { data } = await apiClient.put<User>(`/api/v1/admin/users/${userId}`, payload);
  return data;
}

export async function updateStaffStatus(userId: number, isActive: boolean): Promise<User> {
  const { data } = await apiClient.put<User>(`/api/v1/admin/users/${userId}/status`, {
    is_active: isActive,
  });
  return data;
}

export async function listStudents(): Promise<User[]> {
  const { data } = await apiClient.get<StudentListPage>("/api/v1/students", {
    params: { page_size: 500 },
  });
  return data.items;
}

export async function listStudentsPage(params: {
  search?: string;
  debtors_only?: boolean;
  page: number;
  page_size: number;
}): Promise<StudentListPage> {
  const { data } = await apiClient.get<StudentListPage>("/api/v1/students", { params });
  return data;
}

export async function createStudent(payload: {
  full_name: string;
  phone: string;
  password: string;
}): Promise<User> {
  const { data } = await apiClient.post<User>("/api/v1/students", {
    ...payload,
    role: "student",
  });
  return data;
}

export async function updateStudent(
  studentId: number,
  payload: { full_name: string; phone: string },
): Promise<User> {
  const { data } = await apiClient.put<User>(`/api/v1/students/${studentId}`, payload);
  return data;
}

export async function updateStudentStatus(studentId: number, isActive: boolean): Promise<User> {
  const { data } = await apiClient.put<User>(`/api/v1/students/${studentId}/status`, {
    is_active: isActive,
  });
  return data;
}

export async function depositToStudent(
  studentId: number,
  amount: number,
  comment?: string,
): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>(
    `/api/v1/students/${studentId}/deposit`,
    { amount, comment },
  );
  return data;
}

export async function getStudentTransactions(
  studentId: number,
  params?: {
    group_id?: number;
    type?: "deposit" | "deduction";
    date_from?: string;
    date_to?: string;
  },
): Promise<StudentTransactionListItem[]> {
  const { data } = await apiClient.get<StudentTransactionListItem[]>(
    `/api/v1/students/${studentId}/transactions`,
    { params },
  );
  return data;
}

export async function getStudentAttendanceHistory(
  studentId: number,
  params?: {
    group_id?: number;
    status?: AttendanceStatus;
    date_from?: string;
    date_to?: string;
  },
): Promise<StudentAttendanceHistoryItem[]> {
  const { data } = await apiClient.get<StudentAttendanceHistoryItem[]>(
    `/api/v1/students/${studentId}/attendance`,
    { params },
  );
  return data;
}

export async function listTransactions(params?: {
  student_id?: number;
  created_by_id?: number;
  group_id?: number;
  type?: "deposit" | "deduction";
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}): Promise<TransactionListPage> {
  const { data } = await apiClient.get<TransactionListPage>("/api/v1/transactions", {
    params,
  });
  return data;
}

export async function getStatsOverview(params?: {
  date_from?: string;
  date_to?: string;
  group_id?: number;
  teacher_id?: number;
  student_id?: number;
}): Promise<StatsOverview> {
  const { data } = await apiClient.get<StatsOverview>("/api/v1/stats/overview", { params });
  return data;
}

export async function listSubjects(): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>("/api/v1/subjects");
  return data;
}

export async function createSubject(name: string): Promise<Subject> {
  const { data } = await apiClient.post<Subject>("/api/v1/subjects", { name });
  return data;
}

export async function updateSubject(subjectId: number, name: string): Promise<Subject> {
  const { data } = await apiClient.put<Subject>(`/api/v1/subjects/${subjectId}`, { name });
  return data;
}

export async function deleteSubject(subjectId: number): Promise<void> {
  await apiClient.delete(`/api/v1/subjects/${subjectId}`);
}

export async function listGroups(teacherId?: number): Promise<GroupListItem[]> {
  const { data } = await apiClient.get<GroupListItem[]>("/api/v1/groups", {
    params: teacherId ? { teacher_id: teacherId } : undefined,
  });
  return data;
}

export async function getGroupDetail(groupId: number): Promise<GroupDetail> {
  const { data } = await apiClient.get<GroupDetail>(`/api/v1/groups/${groupId}`);
  return data;
}

export async function createGroup(payload: {
  name: string;
  subject_id: number;
  teacher_id: number;
  lesson_price: number;
}): Promise<GroupListItem> {
  const { data } = await apiClient.post<GroupListItem>("/api/v1/groups", payload);
  return data;
}

export async function updateGroup(
  groupId: number,
  payload: {
    name: string;
    subject_id: number;
    teacher_id: number;
    lesson_price: number;
  },
): Promise<GroupListItem> {
  const { data } = await apiClient.put<GroupListItem>(`/api/v1/groups/${groupId}`, payload);
  return data;
}

export async function addStudentToGroup(groupId: number, studentId: number) {
  const { data } = await apiClient.post(`/api/v1/groups/${groupId}/students`, {
    student_id: studentId,
  });
  return data;
}

export async function updateGroupStatus(
  groupId: number,
  status: "active" | "frozen" | "archived",
): Promise<GroupListItem> {
  const { data } = await apiClient.put<GroupListItem>(`/api/v1/groups/${groupId}/status`, {
    status,
  });
  return data;
}

export async function updateGroupStudentStatus(
  groupId: number,
  studentId: number,
  status: "active" | "frozen" | "dropped",
  reason?: string,
) {
  const { data } = await apiClient.put(
    `/api/v1/groups/${groupId}/students/${studentId}`,
    { status, reason },
  );
  return data;
}

export async function listGroupLessons(groupId: number): Promise<Lesson[]> {
  const { data } = await apiClient.get<Lesson[]>(`/api/v1/groups/${groupId}/lessons`);
  return data;
}

export async function listAllLessons(params?: {
  group_id?: number;
  teacher_id?: number;
  date_from?: string;
  date_to?: string;
  status?: LessonStatus;
  page?: number;
  page_size?: number;
}): Promise<LessonListPage> {
  const { data } = await apiClient.get<LessonListPage>("/api/v1/lessons", { params });
  return data;
}

export async function createLesson(groupId: number, lessonDate: string): Promise<Lesson> {
  const { data } = await apiClient.post<Lesson>("/api/v1/lessons", {
    group_id: groupId,
    lesson_date: lessonDate,
  });
  return data;
}

export async function deleteLesson(lessonId: number): Promise<void> {
  await apiClient.delete(`/api/v1/lessons/${lessonId}`);
}

export async function getLessonAttendance(lessonId: number): Promise<AttendanceDetail[]> {
  const { data } = await apiClient.get<AttendanceDetail[]>(
    `/api/v1/lessons/${lessonId}/attendance`,
  );
  return data;
}

export interface AttendanceRecordInput {
  student_id: number;
  status: AttendanceStatus;
  grade?: number | null;
}

export async function submitAttendance(
  lessonId: number,
  records: AttendanceRecordInput[],
): Promise<Attendance[]> {
  const { data } = await apiClient.post<Attendance[]>(
    `/api/v1/lessons/${lessonId}/attendance`,
    { records },
  );
  return data;
}

export async function updateAttendance(
  lessonId: number,
  studentId: number,
  payload: { status: AttendanceStatus; grade?: number | null },
): Promise<Attendance> {
  const { data } = await apiClient.put<Attendance>(
    `/api/v1/lessons/${lessonId}/attendance/${studentId}`,
    payload,
  );
  return data;
}

export async function getTeacherFinance(params?: {
  date_from?: string;
  date_to?: string;
  group_id?: number;
}): Promise<TeacherTransaction[]> {
  const { data } = await apiClient.get<TeacherTransaction[]>("/api/v1/teachers/finance", {
    params,
  });
  return data;
}

export async function getTeacherFinanceById(
  teacherId: number,
  params?: {
    date_from?: string;
    date_to?: string;
    group_id?: number;
  },
): Promise<TeacherTransaction[]> {
  const { data } = await apiClient.get<TeacherTransaction[]>(
    `/api/v1/teachers/${teacherId}/finance`,
    { params },
  );
  return data;
}

export async function listAllTeacherTransactions(params?: {
  teacher_id?: number;
  created_by_id?: number;
  group_id?: number;
  type?: "lesson_earning" | "payout";
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}): Promise<TeacherTransactionListPage> {
  const { data } = await apiClient.get<TeacherTransactionListPage>(
    "/api/v1/teachers/transactions",
    { params },
  );
  return data;
}

export async function payoutTeacher(
  teacherId: number,
  amount: number,
  comment?: string,
): Promise<TeacherTransaction> {
  const { data } = await apiClient.post<TeacherTransaction>(
    `/api/v1/teachers/${teacherId}/payout`,
    { amount, comment },
  );
  return data;
}
