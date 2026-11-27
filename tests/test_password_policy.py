from tests.conftest import make_student


def test_creating_a_student_with_a_too_short_password_is_rejected(client, admin_headers):
    resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={"full_name": "Short Pass", "phone": "+998900800001", "password": "123", "role": "student"},
    )
    assert resp.status_code == 422, resp.text


def test_changing_a_password_to_a_too_short_one_is_rejected(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, phone="+998900800002")

    resp = client.put(
        f"/api/v1/admin/users/{student['id']}/password",
        headers=superadmin_headers,
        json={"new_password": "abc"},
    )
    assert resp.status_code == 422, resp.text


def test_a_six_character_password_is_accepted(client, admin_headers):
    resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={"full_name": "OK Pass", "phone": "+998900800003", "password": "abcdef", "role": "student"},
    )
    assert resp.status_code == 201, resp.text
