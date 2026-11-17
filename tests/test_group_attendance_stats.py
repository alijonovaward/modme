from datetime import date, timedelta

from tests.conftest import add_student_to_group, auth_headers, login, make_group, make_lesson, make_staff, make_student, make_subject


def test_attendance_stats_computes_overall_rate_and_respects_date_filter(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901000001")
    subject = make_subject(client, admin_headers, "Attendance-Stats")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    student = make_student(client, admin_headers, phone="+998901000002")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 500000},
    )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))

    today = date.today()
    older_dates = [today - timedelta(days=20), today - timedelta(days=16)]
    newer_dates = [today - timedelta(days=7), today - timedelta(days=2)]

    for lesson_date in older_dates:
        lesson = make_lesson(client, admin_headers, group_id=group["id"], lesson_date=lesson_date.isoformat())
        resp = client.post(
            f"/api/v1/lessons/{lesson['id']}/attendance",
            headers=teacher_headers,
            json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
        )
        assert resp.status_code == 201, resp.text

    for lesson_date in newer_dates:
        lesson = make_lesson(client, admin_headers, group_id=group["id"], lesson_date=lesson_date.isoformat())
        resp = client.post(
            f"/api/v1/lessons/{lesson['id']}/attendance",
            headers=teacher_headers,
            json={"records": [{"student_id": student["id"], "status": "unexcused"}]},
        )
        assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/v1/groups/{group['id']}/attendance-stats", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    stats = data[0]
    assert stats["student_id"] == student["id"]
    assert stats["total_lessons"] == 4
    assert stats["attendance_rate"] == 50.0

    resp = client.get(
        f"/api/v1/groups/{group['id']}/attendance-stats",
        headers=admin_headers,
        params={
            "date_from": older_dates[0].isoformat(),
            "date_to": older_dates[1].isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text
    filtered_stats = resp.json()[0]
    assert filtered_stats["total_lessons"] == 2
    assert filtered_stats["attendance_rate"] == 100.0


def test_attendance_stats_with_no_lessons(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901000003")
    subject = make_subject(client, admin_headers, "Attendance-Stats-Empty")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    student = make_student(client, admin_headers, phone="+998901000004")
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.get(f"/api/v1/groups/{group['id']}/attendance-stats", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert data[0]["total_lessons"] == 0
    assert data[0]["attendance_rate"] == 0.0
