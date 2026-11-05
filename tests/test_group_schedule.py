from tests.conftest import make_group, make_staff, make_subject


def test_group_schedule_is_saved_and_returned(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400001")
    subject = make_subject(client, admin_headers, "Physics")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": 0, "start_time": "14:00:00", "end_time": "15:30:00"}],
    )
    assert group["schedule"] == [
        {"weekday": 0, "start_time": "14:00:00", "end_time": "15:30:00"}
    ]

    resp = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["schedule"] == group["schedule"]


def test_overlapping_schedule_for_same_teacher_is_rejected(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400002")
    subject = make_subject(client, admin_headers, "Chemistry")
    make_group(
        client,
        admin_headers,
        name="Group-A",
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": 0, "start_time": "14:00:00", "end_time": "15:30:00"}],
    )

    result = make_group(
        client,
        admin_headers,
        name="Group-B",
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": 0, "start_time": "15:00:00", "end_time": "16:00:00"}],
        expected_status=400,
    )
    assert "band" in result["detail"]


def test_non_overlapping_schedule_for_same_teacher_is_allowed(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400003")
    subject = make_subject(client, admin_headers, "Geometry")
    make_group(
        client,
        admin_headers,
        name="Group-A",
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": 0, "start_time": "14:00:00", "end_time": "15:30:00"}],
    )

    make_group(
        client,
        admin_headers,
        name="Group-B",
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": 0, "start_time": "15:30:00", "end_time": "16:30:00"}],
    )


def test_generate_lessons_from_schedule_is_idempotent(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400004")
    subject = make_subject(client, admin_headers, "Algebra")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        # 2026-11-02 is a Monday
        schedule=[{"weekday": 0, "start_time": "14:00:00", "end_time": "15:30:00"}],
    )

    resp = client.post(
        f"/api/v1/groups/{group['id']}/lessons/generate",
        headers=admin_headers,
        json={"date_from": "2026-11-02", "date_to": "2026-11-15"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["created_count"] == 2
    assert data["skipped_count"] == 0
    for lesson in data["lessons"]:
        assert lesson["start_time"] == "14:00:00"
        assert lesson["end_time"] == "15:30:00"

    resp = client.post(
        f"/api/v1/groups/{group['id']}/lessons/generate",
        headers=admin_headers,
        json={"date_from": "2026-11-02", "date_to": "2026-11-15"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["created_count"] == 0
    assert data["skipped_count"] == 2


def test_generate_lessons_without_schedule_is_rejected(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400005")
    subject = make_subject(client, admin_headers, "Literature")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
    )

    resp = client.post(
        f"/api/v1/groups/{group['id']}/lessons/generate",
        headers=admin_headers,
        json={"date_from": "2026-11-02", "date_to": "2026-11-15"},
    )
    assert resp.status_code == 400, resp.text
