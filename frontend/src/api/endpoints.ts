import { apiClient } from "./client";
import type {
  Attendance,
  AttendanceStatus,
  GroupDetail,
  GroupListItem,
  Lesson,
  StatsOverview,
  StudentAttendanceHistoryItem,
  Subject,
  TeacherTransaction,
  Transaction,
  TransactionListItem,
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
  const { data } = await apiClient.get<User[]>("/api/v1/admin/users", {
    params: role ? { role } : undefined,
  });
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

export async function listStudents(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/api/v1/students");
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

export async function getStudentTransactions(studentId: number): Promise<Transaction[]> {
  const { data } = await apiClient.get<Transaction[]>(
    `/api/v1/students/${studentId}/transactions`,
  );
  return data;
}

export async function getStudentAttendanceHistory(
  studentId: number,
): Promise<StudentAttendanceHistoryItem[]> {
  const { data } = await apiClient.get<StudentAttendanceHistoryItem[]>(
    `/api/v1/students/${studentId}/attendance`,
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
}): Promise<TransactionListItem[]> {
  const { data } = await apiClient.get<TransactionListItem[]>("/api/v1/transactions", {
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

export async function addStudentToGroup(groupId: number, studentId: number) {
  const { data } = await apiClient.post(`/api/v1/groups/${groupId}/students`, {
    student_id: studentId,
  });
  return data;
}

export async function updateGroupStudentStatus(
  groupId: number,
  studentId: number,
  status: "active" | "frozen" | "dropped",
) {
  const { data } = await apiClient.put(
    `/api/v1/groups/${groupId}/students/${studentId}`,
    { status },
  );
  return data;
}

export async function listGroupLessons(groupId: number): Promise<Lesson[]> {
  const { data } = await apiClient.get<Lesson[]>(`/api/v1/groups/${groupId}/lessons`);
  return data;
}

export async function createLesson(groupId: number, lessonDate: string): Promise<Lesson> {
  const { data } = await apiClient.post<Lesson>("/api/v1/lessons", {
    group_id: groupId,
    lesson_date: lessonDate,
  });
  return data;
}

export async function getLessonAttendance(lessonId: number): Promise<Attendance[]> {
  const { data } = await apiClient.get<Attendance[]>(
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
