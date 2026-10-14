export type UserRole = "superadmin" | "admin" | "teacher" | "student";

export interface User {
  id: number;
  full_name: string;
  phone: string;
  role: UserRole;
  teacher_percentage: number | null;
  balance: number;
  created_at: string;
}

export type TransactionType = "deposit" | "deduction";

export interface Transaction {
  id: number;
  student_id: number;
  amount: number;
  type: TransactionType;
  comment: string | null;
  created_at: string;
}

export interface TransactionListItem {
  id: number;
  student_id: number;
  student_name: string;
  amount: number;
  type: TransactionType;
  comment: string | null;
  created_at: string;
  created_by_id: number | null;
  created_by_name: string | null;
  group_id: number | null;
  group_name: string | null;
  lesson_date: string | null;
}

export type TeacherTransactionType = "lesson_earning" | "payout";

export interface TeacherTransaction {
  id: number;
  teacher_id: number;
  amount: number;
  type: TeacherTransactionType;
  comment: string | null;
  created_at: string;
  group_name: string | null;
  lesson_date: string | null;
}

export interface Subject {
  id: number;
  name: string;
}

export type GroupStatus = "active" | "frozen" | "archived";

export interface GroupListItem {
  id: number;
  name: string;
  subject_id: number;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  lesson_price: number;
  status: GroupStatus;
}

export type GroupStudentStatus = "active" | "frozen" | "dropped";

export interface GroupRosterItem {
  id: number;
  student_id: number;
  student_name: string;
  student_phone: string;
  status: GroupStudentStatus;
  status_reason: string | null;
}

export interface GroupDetail extends GroupListItem {
  students: GroupRosterItem[];
}

export type LessonStatus = "planned" | "completed";

export interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  status: LessonStatus;
}

export interface LessonListItem {
  id: number;
  group_id: number;
  group_name: string;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  lesson_date: string;
  status: LessonStatus;
  present_count: number;
  excused_count: number;
  unexcused_count: number;
}

export type AttendanceStatus = "present" | "excused" | "unexcused";

export interface Attendance {
  id: number;
  lesson_id: number;
  student_id: number;
  status: AttendanceStatus;
  grade: number | null;
}

export interface AttendanceDetail {
  id: number;
  lesson_id: number;
  student_id: number;
  student_name: string;
  status: AttendanceStatus;
  grade: number | null;
}

export interface StatsOverview {
  total_deposits: number;
  total_deductions: number;
  total_teacher_earnings: number;
  total_teacher_payouts: number;
  total_student_balance: number;
}

export interface StudentAttendanceHistoryItem {
  id: number;
  lesson_id: number;
  lesson_date: string;
  group_id: number;
  group_name: string;
  status: AttendanceStatus;
  grade: number | null;
}
