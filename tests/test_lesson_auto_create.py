from datetime import date, timedelta

from app.models.app_state import AppState
from app.models.lesson import Lesson
from tests.conftest import make_group, make_staff, make_subject


def test_lessons_are_auto_created_for_active_group_schedule(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900500001")
    subject = make_subject(client, admin_headers, "Auto-create")
    today = date.today()
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": today.weekday(), "start_time": "10:00:00", "end_time": "11:00:00"}],
    )

    resp = client.get(
        "/api/v1/lessons", headers=admin_headers, params={"group_id": group["id"]}
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert any(item["lesson_date"] == today.isoformat() for item in items)
    todays_lesson = next(item for item in items if item["lesson_date"] == today.isoformat())
    assert todays_lesson["start_time"] == "10:00:00"
    assert todays_lesson["end_time"] == "11:00:00"

    in_three_weeks = today + timedelta(days=21)
    assert any(item["lesson_date"] == in_three_weeks.isoformat() for item in items)

    resp2 = client.get(
        "/api/v1/lessons", headers=admin_headers, params={"group_id": group["id"]}
    )
    assert resp2.status_code == 200, resp2.text
    assert len(resp2.json()["items"]) == len(items)


def test_auto_create_only_scans_once_per_day(client, superadmin_headers, admin_headers, db_session):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900500006")
    subject = make_subject(client, admin_headers, "Auto-create-once")
    today = date.today()
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": today.weekday(), "start_time": "10:00:00", "end_time": "11:00:00"}],
    )

    resp = client.get("/api/v1/lessons", headers=admin_headers, params={"group_id": group["id"]})
    assert len(resp.json()["items"]) > 0

    db_session.expire_all()
    assert db_session.get(AppState, "lesson_auto_create_last_run").value == today.isoformat()

    db_session.query(Lesson).filter(Lesson.group_id == group["id"]).delete()
    db_session.commit()

    resp2 = client.get("/api/v1/lessons", headers=admin_headers, params={"group_id": group["id"]})
    assert resp2.json()["items"] == []


def test_lessons_are_not_auto_created_for_frozen_group(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900500002")
    subject = make_subject(client, admin_headers, "Auto-create-frozen")
    today = date.today()
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[{"weekday": today.weekday(), "start_time": "10:00:00", "end_time": "11:00:00"}],
    )

    resp = client.put(
        f"/api/v1/groups/{group['id']}/status",
        headers=admin_headers,
        json={"status": "frozen"},
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(
        "/api/v1/lessons", headers=admin_headers, params={"group_id": group["id"]}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
