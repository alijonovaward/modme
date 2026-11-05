export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type UserRole = "superadmin" | "admin" | "teacher" | "student";

export interface User {
  id: number;
  full_name: string;
  phone: string;
  role: UserRole;
  teacher_percentage: number | null;
  balance: number;
  is_active: boolean;
  created_at: string;
  telegram_linked: boolean;
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
  student_name: string | null;
  group_name: string | null;
  lesson_date: string | null;
}

export interface TeacherTransactionGlobalListItem {
  id: number;
  teacher_id: number;
  teacher_name: string;
  student_id: number | null;
  student_name: string | null;
  amount: number;
  type: TeacherTransactionType;
  comment: string | null;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  lesson_date: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
}

export interface Subject {
  id: number;
  name: string;
}

export type GroupStatus = "active" | "frozen" | "archived";

export interface GroupScheduleItem {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface GroupListItem {
  id: number;
  name: string;
  subject_id: number;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  lesson_price: number;
  status: GroupStatus;
  schedule: GroupScheduleItem[];
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
  start_time: string | null;
  end_time: string | null;
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
  start_time: string | null;
  end_time: string | null;
  status: LessonStatus;
  present_count: number;
  excused_count: number;
  unexcused_count: number;
}

export interface LessonGenerateResult {
  created_count: number;
  skipped_count: number;
  lessons: Lesson[];
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
  total_center_revenue: number;
}

export interface StudentAttendanceHistoryItem {
  id: number;
  lesson_id: number;
  lesson_date: string;
  group_id: number;
  group_name: string;
  teacher_name: string;
  status: AttendanceStatus;
  grade: number | null;
}

export interface StudentListPage extends Page<User> {
  debtor_count: number;
}

export type StaffListPage = Page<User>;

export interface LessonListPage extends Page<LessonListItem> {
  completed_count: number;
  planned_count: number;
}

export interface TransactionListPage extends Page<TransactionListItem> {
  total_deposits: number;
  total_deductions: number;
}

export interface TeacherTransactionListPage extends Page<TeacherTransactionGlobalListItem> {
  total_earnings: number;
  total_payouts: number;
}

export interface StudentTransactionListItem {
  id: number;
  amount: number;
  type: TransactionType;
  comment: string | null;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  teacher_name: string | null;
  lesson_date: string | null;
}
