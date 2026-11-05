from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.db.session import get_db
from app.models.group import Group, GroupStatus
from app.models.group_schedule import GroupSchedule
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.lesson import Lesson
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.group import (
    GroupCreate,
    GroupDetailOut,
    GroupListItemOut,
    GroupOut,
    GroupRosterItemOut,
    GroupScheduleItem,
    GroupStatusUpdate,
    GroupStudentCreate,
    GroupStudentOut,
    GroupStudentStatusUpdate,
)
from app.schemas.lesson import LessonGenerateRequest, LessonGenerateResult, LessonOut

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])

WEEKDAY_NAMES = ("Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba")


def _get_group_schedule(db: Session, group_id: int) -> list[GroupScheduleItem]:
    rows = db.query(GroupSchedule).filter(GroupSchedule.group_id == group_id).all()
    return [
        GroupScheduleItem(weekday=row.weekday, start_time=row.start_time, end_time=row.end_time)
        for row in rows
    ]


def _to_list_item(group: Group, db: Session) -> GroupListItemOut:
    subject = db.get(Subject, group.subject_id)
    teacher = db.get(User, group.teacher_id)
    return GroupListItemOut(
        id=group.id,
        name=group.name,
        subject_id=group.subject_id,
        subject_name=subject.name if subject else "",
        teacher_id=group.teacher_id,
        teacher_name=teacher.full_name if teacher else "",
        lesson_price=group.lesson_price,
        status=group.status,
        schedule=_get_group_schedule(db, group.id),
    )


def _times_overlap(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


def _find_schedule_conflict(
    db: Session,
    teacher_id: int,
    schedule_items: list[GroupScheduleItem],
    exclude_group_id: Optional[int] = None,
) -> Optional[tuple[Group, GroupSchedule]]:
    query = (
        db.query(GroupSchedule, Group)
        .join(Group, Group.id == GroupSchedule.group_id)
        .filter(Group.teacher_id == teacher_id, Group.status == GroupStatus.active)
    )
    if exclude_group_id is not None:
        query = query.filter(Group.id != exclude_group_id)
    existing_rows = query.all()

    for item in schedule_items:
        for sched, group in existing_rows:
            if sched.weekday == item.weekday and _times_overlap(
                item.start_time, item.end_time, sched.start_time, sched.end_time
            ):
                return group, sched
    return None


def _raise_if_schedule_conflict(
    db: Session,
    teacher_id: int,
    schedule_items: list[GroupScheduleItem],
    exclude_group_id: Optional[int] = None,
) -> None:
    conflict = _find_schedule_conflict(db, teacher_id, schedule_items, exclude_group_id)
    if conflict is not None:
        group, sched = conflict
        raise HTTPException(
            status_code=400,
            detail=(
                f"O'qituvchi {WEEKDAY_NAMES[sched.weekday]} kuni "
                f"{sched.start_time.strftime('%H:%M')}-{sched.end_time.strftime('%H:%M')} da "
                f"'{group.name}' guruhida band"
            ),
        )


def _replace_group_schedule(
    db: Session, group_id: int, schedule_items: list[GroupScheduleItem]
) -> None:
    db.query(GroupSchedule).filter(GroupSchedule.group_id == group_id).delete()
    for item in schedule_items:
        db.add(
            GroupSchedule(
                group_id=group_id,
                weekday=item.weekday,
                start_time=item.start_time,
                end_time=item.end_time,
            )
        )


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Fan topilmadi")

    teacher = db.get(User, payload.teacher_id)
    if teacher is None or teacher.role != UserRole.teacher:
        raise HTTPException(status_code=404, detail="O'qituvchi topilmadi")
    if not teacher.is_active:
        raise HTTPException(status_code=400, detail="Bloklangan o'qituvchini guruhga biriktirib bo'lmaydi")

    if payload.lesson_price <= 0:
        raise HTTPException(status_code=400, detail="Dars narxi musbat bo'lishi kerak")

    _raise_if_schedule_conflict(db, payload.teacher_id, payload.schedule)

    group = Group(
        name=payload.name,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        lesson_price=payload.lesson_price,
    )
    db.add(group)
    db.flush()
    _replace_group_schedule(db, group.id, payload.schedule)
    db.commit()
    db.refresh(group)
    group.schedule = payload.schedule
    return group


def _get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    return group


@router.put("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: int,
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = _get_group_or_404(db, group_id)

    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Fan topilmadi")

    teacher = db.get(User, payload.teacher_id)
    if teacher is None or teacher.role != UserRole.teacher:
        raise HTTPException(status_code=404, detail="O'qituvchi topilmadi")
    if not teacher.is_active:
        raise HTTPException(status_code=400, detail="Bloklangan o'qituvchini guruhga biriktirib bo'lmaydi")

    if payload.lesson_price <= 0:
        raise HTTPException(status_code=400, detail="Dars narxi musbat bo'lishi kerak")

    _raise_if_schedule_conflict(db, payload.teacher_id, payload.schedule, exclude_group_id=group.id)

    group.name = payload.name
    group.subject_id = payload.subject_id
    group.teacher_id = payload.teacher_id
    group.lesson_price = payload.lesson_price
    _replace_group_schedule(db, group.id, payload.schedule)
    db.commit()
    db.refresh(group)
    group.schedule = payload.schedule
    return group


def _build_groups_query(db: Session, current_user: User, teacher_id: Optional[int]):
    query = db.query(Group)
    if current_user.role == UserRole.teacher:
        query = query.filter(Group.teacher_id == current_user.id)
    elif teacher_id is not None:
        query = query.filter(Group.teacher_id == teacher_id)
    return query


@router.get("", response_model=list[GroupListItemOut])
def list_groups(
    teacher_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    query = _build_groups_query(db, current_user, teacher_id)
    return [_to_list_item(group, db) for group in query.all()]


GROUP_STATUS_LABELS = {
    GroupStatus.active: "Faol",
    GroupStatus.frozen: "Muzlatilgan",
    GroupStatus.archived: "Arxivlangan",
}

SHORT_WEEKDAY_NAMES = ("Dush", "Sesh", "Chor", "Pay", "Jum", "Shan", "Yak")


def _format_schedule_cell(schedule: list[GroupScheduleItem]) -> str:
    if not schedule:
        return ""
    days = ", ".join(SHORT_WEEKDAY_NAMES[item.weekday] for item in schedule)
    first = schedule[0]
    return f"{days} {first.start_time.strftime('%H:%M')}-{first.end_time.strftime('%H:%M')}"


@router.get("/export")
def export_groups(
    teacher_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    groups = _build_groups_query(db, current_user, teacher_id).all()
    rows = []
    for group in groups:
        item = _to_list_item(group, db)
        rows.append(
            [
                item.name,
                item.subject_name,
                item.teacher_name,
                item.lesson_price,
                GROUP_STATUS_LABELS.get(item.status, item.status.value),
                _format_schedule_cell(item.schedule),
            ]
        )
    return xlsx_response(
        "guruhlar.xlsx",
        ["Nomi", "Fan", "O'qituvchi", "Dars narxi", "Holat", "Jadval"],
        rows,
    )


@router.get("/{group_id}", response_model=GroupDetailOut)
def get_group_detail(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    group = _get_group_or_404(db, group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    roster = db.query(GroupStudent).filter(GroupStudent.group_id == group.id).all()
    students = []
    for gs in roster:
        student = db.get(User, gs.student_id)
        students.append(
            GroupRosterItemOut(
                id=gs.id,
                student_id=gs.student_id,
                student_name=student.full_name if student else "",
                student_phone=student.phone if student else "",
                status=gs.status,
                status_reason=gs.status_reason,
            )
        )

    base = _to_list_item(group, db)
    return GroupDetailOut(**base.model_dump(), students=students)


@router.get("/{group_id}/lessons", response_model=list[LessonOut])
def list_group_lessons(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    group = _get_group_or_404(db, group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    return (
        db.query(Lesson)
        .filter(Lesson.group_id == group_id)
        .order_by(Lesson.lesson_date.desc())
        .all()
    )


@router.post("/{group_id}/lessons/generate", response_model=LessonGenerateResult)
def generate_group_lessons(
    group_id: int,
    payload: LessonGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = _get_group_or_404(db, group_id)
    if group.status != GroupStatus.active:
        raise HTTPException(
            status_code=400, detail="Faol bo'lmagan guruh uchun dars generatsiya qilib bo'lmaydi"
        )

    schedule_rows = db.query(GroupSchedule).filter(GroupSchedule.group_id == group_id).all()
    if not schedule_rows:
        raise HTTPException(status_code=400, detail="Guruh uchun dars jadvali belgilanmagan")
    schedule_by_weekday = {row.weekday: row for row in schedule_rows}

    existing_dates = {
        lesson_date
        for (lesson_date,) in db.query(Lesson.lesson_date).filter(
            Lesson.group_id == group_id,
            Lesson.lesson_date >= payload.date_from,
            Lesson.lesson_date <= payload.date_to,
        )
    }

    created: list[Lesson] = []
    skipped_count = 0
    current_date = payload.date_from
    while current_date <= payload.date_to:
        sched = schedule_by_weekday.get(current_date.weekday())
        if sched is not None:
            if current_date in existing_dates:
                skipped_count += 1
            else:
                lesson = Lesson(
                    group_id=group_id,
                    lesson_date=current_date,
                    start_time=sched.start_time,
                    end_time=sched.end_time,
                )
                db.add(lesson)
                created.append(lesson)
        current_date += timedelta(days=1)

    db.commit()
    for lesson in created:
        db.refresh(lesson)

    return LessonGenerateResult(
        created_count=len(created),
        skipped_count=skipped_count,
        lessons=created,
    )


@router.post(
    "/{group_id}/students",
    response_model=GroupStudentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_student_to_group(
    group_id: int,
    payload: GroupStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = _get_group_or_404(db, group_id)
    if group.status != GroupStatus.active:
        raise HTTPException(
            status_code=400, detail="Faol bo'lmagan guruhga o'quvchi qo'shib bo'lmaydi"
        )

    student = db.get(User, payload.student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="O'quvchi topilmadi")
    if not student.is_active:
        raise HTTPException(status_code=400, detail="Bloklangan o'quvchini guruhga qo'shib bo'lmaydi")

    existing = (
        db.query(GroupStudent)
        .filter(
            GroupStudent.group_id == group.id,
            GroupStudent.student_id == student.id,
            GroupStudent.status != GroupStudentStatus.dropped,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="O'quvchi allaqachon ushbu guruhda")

    group_student = GroupStudent(group_id=group.id, student_id=student.id)
    db.add(group_student)
    db.commit()
    db.refresh(group_student)
    return group_student


@router.put(
    "/{group_id}/students/{student_id}",
    response_model=GroupStudentOut,
)
def update_group_student_status(
    group_id: int,
    student_id: int,
    payload: GroupStudentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    _get_group_or_404(db, group_id)

    group_student = (
        db.query(GroupStudent)
        .filter(GroupStudent.group_id == group_id, GroupStudent.student_id == student_id)
        .first()
    )
    if group_student is None:
        raise HTTPException(status_code=404, detail="O'quvchi ushbu guruhda topilmadi")

    if payload.status == GroupStudentStatus.dropped and not (payload.reason or "").strip():
        raise HTTPException(
            status_code=400, detail="O'quvchini chiqarish uchun sabab kiritilishi shart"
        )

    group_student.status = payload.status
    group_student.status_reason = payload.reason if payload.status == GroupStudentStatus.dropped else None
    db.commit()
    db.refresh(group_student)
    return group_student


@router.put("/{group_id}/status", response_model=GroupOut)
def update_group_status(
    group_id: int,
    payload: GroupStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = _get_group_or_404(db, group_id)
    group.status = payload.status
    db.commit()
    db.refresh(group)
    return group
