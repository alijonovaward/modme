import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.db.session import Base, get_db
from app.main import app
from app.models.user import User, UserRole

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def superadmin(db_session):
    user = User(
        full_name="Super Admin",
        phone="+998900000001",
        hashed_password=hash_password("admin123"),
        role=UserRole.superadmin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login(client, phone: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": phone, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def superadmin_headers(client, superadmin):
    return auth_headers(login(client, superadmin.phone, "admin123"))


@pytest.fixture()
def admin_headers(client, superadmin_headers):
    staff = make_staff(client, superadmin_headers, role="admin", full_name="Admin", phone="+998900100001")
    return auth_headers(login(client, staff["phone"], "pass123"))


def make_staff(
    client,
    headers: dict,
    *,
    role: str = "teacher",
    full_name: str = "Teacher",
    phone: str,
    password: str = "pass123",
    teacher_percentage: float | None = 40,
) -> dict:
    payload = {"full_name": full_name, "phone": phone, "password": password, "role": role}
    if role == "teacher":
        payload["teacher_percentage"] = teacher_percentage
    response = client.post("/api/v1/admin/users", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def make_student(
    client,
    headers: dict,
    *,
    full_name: str = "Student",
    phone: str,
    password: str = "pass123",
) -> dict:
    response = client.post(
        "/api/v1/students",
        headers=headers,
        json={"full_name": full_name, "phone": phone, "password": password, "role": "student"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_subject(client, headers: dict, name: str = "Math") -> dict:
    response = client.post("/api/v1/subjects", headers=headers, json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def make_group(
    client,
    headers: dict,
    *,
    name: str = "Group-1",
    subject_id: int,
    teacher_id: int,
    lesson_price: float = 30000,
) -> dict:
    response = client.post(
        "/api/v1/groups",
        headers=headers,
        json={
            "name": name,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "lesson_price": lesson_price,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_lesson(client, headers: dict, *, group_id: int, lesson_date: str = "2026-10-09") -> dict:
    response = client.post(
        "/api/v1/lessons",
        headers=headers,
        json={"group_id": group_id, "lesson_date": lesson_date},
    )
    assert response.status_code == 201, response.text
    return response.json()


def add_student_to_group(client, headers: dict, *, group_id: int, student_id: int) -> dict:
    response = client.post(
        f"/api/v1/groups/{group_id}/students",
        headers=headers,
        json={"student_id": student_id},
    )
    assert response.status_code == 201, response.text
    return response.json()
