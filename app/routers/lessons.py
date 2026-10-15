from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.lesson import Lesson, LessonStatus
from app.models.subject import Subject
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import AttendanceCreate, AttendanceDetailOut, AttendanceOut
from app.schemas.lesson import LessonCreate, LessonListItemOut, LessonOut

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])


@router.get("", response_model=list[LessonListItemOut])
def list_all_lessons(
    group_id: Optional[int] = Query(default=None),
    teacher_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    lesson_status: Optional[LessonStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    query = (
        db.query(Lesson, Group, Subject)
        .join(Group, Group.id == Lesson.group_id)
        .join(Subject, Subject.id == Group.subject_id)
    )
    if group_id is not None:
        query = query.filter(Lesson.group_id == group_id)
    if teacher_id is not None:
        query = query.filter(Group.teacher_id == teacher_id)
    if date_from is not None:
        query = query.filter(Lesson.lesson_date >= date_from)
    if date_to is not None:
        query = query.filter(Lesson.lesson_date <= date_to)
    if lesson_status is not None:
        query = query.filter(Lesson.status == lesson_status)

    rows = query.order_by(Lesson.lesson_date.desc()).all()
    lesson_ids = [lesson.id for lesson, _, _ in rows]

    counts: dict[int, dict[AttendanceStatus, int]] = {}
    if lesson_ids:
        count_rows = (
            db.query(Attendance.lesson_id, Attendance.status, func.count(Attendance.id))
            .filter(Attendance.lesson_id.in_(lesson_ids))
            .group_by(Attendance.lesson_id, Attendance.status)
            .all()
        )
        for lesson_id, att_status, count in count_rows:
            counts.setdefault(lesson_id, {})[att_status] = count

    teacher_ids = {group.teacher_id for _, group, _ in rows}
    teachers = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(teacher_ids))} if teacher_ids else {}

    return [
        LessonListItemOut(
            id=lesson.id,
            group_id=group.id,
            group_name=group.name,
            subject_name=subject.name,
            teacher_id=group.teacher_id,
            teacher_name=teachers.get(group.teacher_id, ""),
            lesson_date=lesson.lesson_date,
            status=lesson.status,
            present_count=counts.get(lesson.id, {}).get(AttendanceStatus.present, 0),
            excused_count=counts.get(lesson.id, {}).get(AttendanceStatus.excused, 0),
            unexcused_count=counts.get(lesson.id, {}).get(AttendanceStatus.unexcused, 0),
        )
        for lesson, group, subject in rows
    ]


@router.post("", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = db.get(Group, payload.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")

    lesson = Lesson(group_id=payload.group_id, lesson_date=payload.lesson_date)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    has_attendance = (
        db.query(Attendance).filter(Attendance.lesson_id == lesson_id).first() is not None
    )
    if lesson.status != LessonStatus.planned or has_attendance:
        raise HTTPException(
            status_code=400,
            detail="Davomat olingan darsni o'chirib bo'lmaydi",
        )

    db.delete(lesson)
    db.commit()


@router.get("/{lesson_id}/attendance", response_model=list[AttendanceDetailOut])
def get_lesson_attendance(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    rows = (
        db.query(Attendance, User)
        .join(User, User.id == Attendance.student_id)
        .filter(Attendance.lesson_id == lesson.id)
        .all()
    )
    return [
        AttendanceDetailOut(
            id=att.id,
            lesson_id=att.lesson_id,
            student_id=att.student_id,
            student_name=student.full_name,
            status=att.status,
            grade=att.grade,
        )
        for att, student in rows
    ]


@router.post(
    "/{lesson_id}/attendance",
    response_model=list[AttendanceOut],
    status_code=status.HTTP_201_CREATED,
)
def mark_attendance(
    lesson_id: int,
    payload: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    existing_count = db.query(Attendance).filter(Attendance.lesson_id == lesson.id).count()
    if existing_count > 0:
        raise HTTPException(status_code=400, detail="Bu dars uchun davomat allaqachon qilingan")

    teacher_percentage = current_user.teacher_percentage or 0.0
    created_records: list[Attendance] = []

    for item in payload.records:
        group_student = (
            db.query(GroupStudent)
            .filter(
                GroupStudent.group_id == group.id,
                GroupStudent.student_id == item.student_id,
            )
            .first()
        )
        if group_student is None:
            raise HTTPException(
                status_code=404,
                detail=f"O'quvchi {item.student_id} ushbu guruhda topilmadi",
            )

        if item.status == AttendanceStatus.present and item.grade is None:
            raise HTTPException(status_code=400, detail="Kelgan o'quvchiga baho qo'yilishi shart")
        if item.status != AttendanceStatus.present and item.grade is not None:
            raise HTTPException(status_code=400, detail="Baho faqat kelgan o'quvchiga qo'yiladi")

        attendance = Attendance(
            lesson_id=lesson.id,
            student_id=item.student_id,
            status=item.status,
            grade=item.grade,
        )
        db.add(attendance)
        created_records.append(attendance)

        is_frozen = group_student.status == GroupStudentStatus.frozen
        should_charge = item.status in (AttendanceStatus.present, AttendanceStatus.unexcused) and not is_frozen

        if should_charge:
            student = db.get(User, item.student_id)

            student.balance -= group.lesson_price
            db.add(
                Transaction(
                    student_id=student.id,
                    amount=-group.lesson_price,
                    type=TransactionType.deduction,
                    comment=(
                        f"Dars uchun yechim ({group.name}, {lesson.lesson_date}, "
                        f"o'qituvchi: {current_user.full_name})"
                    ),
                    created_by_id=current_user.id,
                    lesson_id=lesson.id,
                )
            )

            teacher_share = group.lesson_price * (teacher_percentage / 100)
            current_user.balance += teacher_share
            db.add(
                TeacherTransaction(
                    teacher_id=current_user.id,
                    lesson_id=lesson.id,
                    student_id=item.student_id,
                    amount=teacher_share,
                    type=TeacherTransactionType.lesson_earning,
                )
            )

    lesson.status = LessonStatus.completed
    db.commit()
    for record in created_records:
        db.refresh(record)
    return created_records
