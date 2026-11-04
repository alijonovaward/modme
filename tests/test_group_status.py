from tests.conftest import make_group, make_lesson, make_staff, make_student, make_subject


def test_frozen_group_blocks_new_lessons_and_new_students(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900300001")
    subject = make_subject(client, admin_headers, "Biology")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
    )
    student = make_student(client, admin_headers, phone="+998900300002")

    resp = client.put(
        f"/api/v1/groups/{group['id']}/status",
        headers=admin_headers,
        json={"status": "frozen"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "frozen"

    resp = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group["id"], "lesson_date": "2026-11-01"},
    )
    assert resp.status_code == 400, resp.text

    resp = client.post(
        f"/api/v1/groups/{group['id']}/students",
        headers=admin_headers,
        json={"student_id": student["id"]},
    )
    assert resp.status_code == 400, resp.text


def test_archived_group_can_be_reactivated(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900300003")
    subject = make_subject(client, admin_headers, "History")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
    )

    resp = client.put(
        f"/api/v1/groups/{group['id']}/status",
        headers=admin_headers,
        json={"status": "archived"},
    )
    assert resp.status_code == 200 and resp.json()["status"] == "archived"

    resp = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group["id"], "lesson_date": "2026-11-01"},
    )
    assert resp.status_code == 400, resp.text

    resp = client.put(
        f"/api/v1/groups/{group['id']}/status",
        headers=admin_headers,
        json={"status": "active"},
    )
    assert resp.status_code == 200 and resp.json()["status"] == "active"

    lesson = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-11-02")
    assert lesson["status"] == "planned"
