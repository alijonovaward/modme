from tests.conftest import make_group, make_lesson, make_staff, make_subject


def test_cannot_create_two_lessons_for_same_group_and_date(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900960001", teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Dup-Lesson-Subject")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )

    first = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-11-20")
    assert first["lesson_date"] == "2026-11-20"

    resp = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group["id"], "lesson_date": "2026-11-20"},
    )
    assert resp.status_code == 400, resp.text
    assert "allaqachon mavjud" in resp.json()["detail"]


def test_different_dates_or_groups_are_not_blocked(client, superadmin_headers, admin_headers):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900960002", teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Dup-Lesson-Subject-2")
    group_a = make_group(
        client, admin_headers, name="Group-A", subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )
    group_b = make_group(
        client, admin_headers, name="Group-B", subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )

    make_lesson(client, admin_headers, group_id=group_a["id"], lesson_date="2026-11-21")
    # Same group, different date - allowed
    make_lesson(client, admin_headers, group_id=group_a["id"], lesson_date="2026-11-22")
    # Different group, same date - allowed
    make_lesson(client, admin_headers, group_id=group_b["id"], lesson_date="2026-11-21")
