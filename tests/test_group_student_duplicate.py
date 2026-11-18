from tests.conftest import add_student_to_group, make_group, make_staff, make_student, make_subject


def _setup(client, superadmin_headers, admin_headers, *, teacher_phone, student_phone):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone=teacher_phone, teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Dup-Enrollment-Subject")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )
    student = make_student(client, admin_headers, phone=student_phone)
    return group, student


def test_cannot_add_same_student_to_group_twice(client, superadmin_headers, admin_headers):
    group, student = _setup(
        client, superadmin_headers, admin_headers,
        teacher_phone="+998900970001", student_phone="+998900970002",
    )

    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.post(
        f"/api/v1/groups/{group['id']}/students",
        headers=admin_headers,
        json={"student_id": student["id"]},
    )
    assert resp.status_code == 400, resp.text
    assert "allaqachon" in resp.json()["detail"]


def test_dropped_student_can_be_re_enrolled(client, superadmin_headers, admin_headers):
    group, student = _setup(
        client, superadmin_headers, admin_headers,
        teacher_phone="+998900970003", student_phone="+998900970004",
    )

    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    drop_resp = client.put(
        f"/api/v1/groups/{group['id']}/students/{student['id']}",
        headers=admin_headers,
        json={"status": "dropped", "reason": "to'xtadi"},
    )
    assert drop_resp.status_code == 200, drop_resp.text

    # Re-enrolling after being dropped must succeed (a new, active row alongside
    # the old dropped one), not be blocked as a "duplicate".
    resp = client.post(
        f"/api/v1/groups/{group['id']}/students",
        headers=admin_headers,
        json={"student_id": student["id"]},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "active"
