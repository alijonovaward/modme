from tests.conftest import make_staff, make_student


def test_cannot_create_student_with_existing_phone(client, admin_headers):
    make_student(client, admin_headers, phone="+998900980001")

    resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={"full_name": "Another", "phone": "+998900980001", "password": "pass123", "role": "student"},
    )
    assert resp.status_code == 400, resp.text
    assert "allaqachon" in resp.json()["detail"]


def test_cannot_create_staff_with_existing_phone(client, superadmin_headers):
    make_staff(client, superadmin_headers, role="teacher", phone="+998900980002")

    resp = client.post(
        "/api/v1/admin/users",
        headers=superadmin_headers,
        json={
            "full_name": "Another",
            "phone": "+998900980002",
            "password": "pass123",
            "role": "teacher",
            "teacher_percentage": 30,
        },
    )
    assert resp.status_code == 400, resp.text
    assert "allaqachon" in resp.json()["detail"]
