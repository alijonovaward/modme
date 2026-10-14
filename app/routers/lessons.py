from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.lesson import Lesson, LessonStatus
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import AttendanceCreate, AttendanceOut
from app.schemas.lesson import LessonCreate, LessonOut

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])


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


@router.get("/{lesson_id}/attendance", response_model=list[AttendanceOut])
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

    return db.query(Attendance).filter(Attendance.lesson_id == lesson.id).all()


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
                    comment=f"Dars uchun yechim (lesson_id={lesson.id})",
                    created_by_id=current_user.id,
                )
            )

            teacher_share = group.lesson_price * (teacher_percentage / 100)
            current_user.balance += teacher_share
            db.add(
                TeacherTransaction(
                    teacher_id=current_user.id,
                    lesson_id=lesson.id,
                    amount=teacher_share,
                    type=TeacherTransactionType.lesson_earning,
                )
            )

    lesson.status = LessonStatus.completed
    db.commit()
    for record in created_records:
        db.refresh(record)
    return created_records
