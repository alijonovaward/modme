from tests.conftest import make_group, make_lesson, make_staff, make_subject


def test_group_lessons_can_be_filtered_by_date_range(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901200001")
    subject = make_subject(client, admin_headers, "Group-Lessons-Filter")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    lesson1 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-01")
    lesson2 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-20")

    resp = client.get(f"/api/v1/groups/{group['id']}/lessons", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert {l["id"] for l in resp.json()} == {lesson1["id"], lesson2["id"]}

    resp = client.get(
        f"/api/v1/groups/{group['id']}/lessons",
        headers=admin_headers,
        params={"date_from": "2026-10-10", "date_to": "2026-10-31"},
    )
    assert resp.status_code == 200, resp.text
    assert {l["id"] for l in resp.json()} == {lesson2["id"]}
