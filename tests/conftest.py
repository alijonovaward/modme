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
