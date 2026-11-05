from io import BytesIO

from openpyxl import load_workbook

from tests.conftest import make_group, make_staff, make_student, make_subject

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _assert_xlsx(response, expected_header_row: list[str]):
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == XLSX_CONTENT_TYPE
    assert "attachment" in response.headers["content-disposition"]
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook.active
    header_row = [cell.value for cell in next(sheet.iter_rows(min_row=1, max_row=1))]
    assert header_row == expected_header_row


def test_export_students(client, admin_headers):
    resp = client.get("/api/v1/students/export", headers=admin_headers)
    _assert_xlsx(resp, ["F.I.O", "Telefon", "Balans", "Holat"])


def test_export_staff_users(client, admin_headers):
    resp = client.get("/api/v1/admin/users/export", headers=admin_headers)
    _assert_xlsx(resp, ["F.I.O", "Telefon", "Lavozim", "Foiz", "Holat"])


def test_export_groups(client, admin_headers):
    resp = client.get("/api/v1/groups/export", headers=admin_headers)
    _assert_xlsx(resp, ["Nomi", "Fan", "O'qituvchi", "Dars narxi", "Holat", "Jadval"])


def test_export_lessons(client, admin_headers):
    resp = client.get("/api/v1/lessons/export", headers=admin_headers)
    _assert_xlsx(
        resp,
        ["Sana", "Vaqt", "Guruh", "Fan", "O'qituvchi", "Holat", "Keldi", "Sababli", "Sababsiz"],
    )


def test_export_transactions(client, admin_headers):
    resp = client.get("/api/v1/transactions/export", headers=admin_headers)
    _assert_xlsx(
        resp,
        ["Sana", "O'quvchi", "Turi", "Summa", "Guruh", "Dars sanasi", "Kim kiritdi", "Izoh"],
    )


def test_export_teacher_transactions_forbidden_for_teacher(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900500001")
    teacher_headers_resp = client.post(
        "/api/v1/auth/login",
        data={"username": teacher["phone"], "password": "pass123"},
    )
    token = teacher_headers_resp.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/teachers/transactions/export", headers=teacher_headers)
    assert resp.status_code == 403

    resp = client.get("/api/v1/teachers/transactions/export", headers=admin_headers)
    _assert_xlsx(
        resp,
        [
            "Sana",
            "O'qituvchi",
            "Turi",
            "Summa",
            "Guruh",
            "O'quvchi",
            "Dars sanasi",
            "Kim kiritdi",
            "Izoh",
        ],
    )


def test_export_teacher_finance(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900500002")
    login_resp = client.post(
        "/api/v1/auth/login", data={"username": teacher["phone"], "password": "pass123"}
    )
    teacher_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get("/api/v1/teachers/finance/export", headers=teacher_headers)
    _assert_xlsx(resp, ["Sana", "Turi", "Summa", "Guruh", "O'quvchi", "Dars sanasi", "Izoh"])

    resp = client.get(f"/api/v1/teachers/{teacher['id']}/finance/export", headers=admin_headers)
    _assert_xlsx(resp, ["Sana", "Turi", "Summa", "Guruh", "O'quvchi", "Dars sanasi", "Izoh"])


def test_export_student_transactions_and_attendance(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, phone="+998900500003")
    login_resp = client.post(
        "/api/v1/auth/login", data={"username": student["phone"], "password": "pass123"}
    )
    student_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get(f"/api/v1/students/{student['id']}/transactions/export", headers=student_headers)
    _assert_xlsx(
        resp,
        ["Sana", "Turi", "Summa", "Guruh", "O'qituvchi", "Dars sanasi", "Izoh"],
    )

    resp = client.get(f"/api/v1/students/{student['id']}/attendance/export", headers=student_headers)
    _assert_xlsx(resp, ["Sana", "Guruh", "O'qituvchi", "Holat", "Baho"])


def test_export_student_transactions_forbidden_for_other_student(client, admin_headers):
    student_a = make_student(client, admin_headers, phone="+998900500004")
    student_b = make_student(client, admin_headers, phone="+998900500005")
    login_resp = client.post(
        "/api/v1/auth/login", data={"username": student_b["phone"], "password": "pass123"}
    )
    student_b_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get(
        f"/api/v1/students/{student_a['id']}/transactions/export", headers=student_b_headers
    )
    assert resp.status_code == 403
