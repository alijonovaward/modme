from tests.conftest import add_student_to_group, make_group, make_staff, make_student, make_subject


def test_students_list_can_be_filtered_by_group(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901300001")
    subject = make_subject(client, admin_headers, "Students-Group-Filter")
    group_a = make_group(client, admin_headers, name="Group-A", subject_id=subject["id"], teacher_id=teacher["id"])
    group_b = make_group(client, admin_headers, name="Group-B", subject_id=subject["id"], teacher_id=teacher["id"])

    student_a = make_student(client, admin_headers, phone="+998901300002")
    student_b = make_student(client, admin_headers, phone="+998901300003")
    add_student_to_group(client, admin_headers, group_id=group_a["id"], student_id=student_a["id"])
    add_student_to_group(client, admin_headers, group_id=group_b["id"], student_id=student_b["id"])

    resp = client.get("/api/v1/students", headers=admin_headers, params={"group_id": group_a["id"]})
    assert resp.status_code == 200, resp.text
    ids = {item["id"] for item in resp.json()["items"]}
    assert student_a["id"] in ids
    assert student_b["id"] not in ids

    resp = client.get("/api/v1/students", headers=admin_headers, params={"group_id": group_b["id"]})
    assert resp.status_code == 200, resp.text
    ids = {item["id"] for item in resp.json()["items"]}
    assert student_b["id"] in ids
    assert student_a["id"] not in ids
