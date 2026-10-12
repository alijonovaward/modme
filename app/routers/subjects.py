from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.subject import SubjectCreate, SubjectOut

router = APIRouter(prefix="/api/v1/subjects", tags=["subjects"])


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    subject = Subject(name=payload.name)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Subject).all()
