from app.models.pending_charge import PendingCharge
from app.models.user import User
from tests.conftest import (
    add_student_to_group,
    auth_headers,
    login,
    make_group,
    make_lesson,
    make_staff,
    make_student,
    make_subject,
)


def _setup(client, superadmin_headers, admin_headers, *, teacher_phone, student_phone, lesson_price=50000, deposit=10000):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone=teacher_phone, teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Pending-Charges")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=lesson_price
    )
    student = make_student(client, admin_headers, phone=student_phone)
    if deposit:
        client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": deposit},
        )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
    lesson = make_lesson(client, admin_headers, group_id=group["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    return teacher, group, student, lesson, teacher_headers


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_insufficient_balance_deducts_directly_into_negative_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800001",
        student_phone="+998900800002",
        lesson_price=50000,
        deposit=10000,
    )

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert resp.status_code == 201, resp.text

    # 10,000 deposit - 50,000 lesson price = -40,000 negative balance (debt)
    assert _balance(db_session, student["id"]) == -40000.0
    assert _balance(db_session, teacher["id"]) == 4000.0


def test_depositing_money_clears_negative_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800003",
        student_phone="+998900800004",
        lesson_price=50000,
        deposit=0,
    )

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert _balance(db_session, student["id"]) == -50000.0

    resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 80000},
    )
    assert resp.status_code == 201, resp.text

    # -50,000 debt + 80,000 deposit = +30,000 balance
    assert _balance(db_session, student["id"]) == 30000.0
    assert _balance(db_session, teacher["id"]) == 20000.0


def test_cancelling_attendance_refunds_deducted_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800005",
        student_phone="+998900800006",
        lesson_price=50000,
        deposit=10000,
    )

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert _balance(db_session, student["id"]) == -40000.0

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 200, resp.text

    # Refunded 50,000 brings balance back from -40,000 to +10,000
    assert _balance(db_session, student["id"]) == 10000.0
    assert _balance(db_session, teacher["id"]) == 0.0


def test_cancelling_after_full_settlement_claws_back_all_teacher_earnings(
    client, superadmin_headers, admin_headers, db_session
):
    """Regression test: a lesson can pay the teacher in two separate installments -
    an immediate share when the lesson is charged, and another when a later deposit
    settles the leftover pending charge. Cancelling the lesson afterwards must claw
    back BOTH installments, not just the first one found."""
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800007",
        student_phone="+998900800008",
        lesson_price=50000,
        deposit=20000,
    )

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    # collected 20,000 -> immediate teacher share 8,000; pending 30,000 -> queued teacher share 12,000
    assert _balance(db_session, student["id"]) == -30000.0
    assert _balance(db_session, teacher["id"]) == 8000.0

    resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 30000},
    )
    assert resp.status_code == 201, resp.text

    # Deposit fully settles the pending charge, paying the remaining 12,000 to the teacher
    assert _balance(db_session, student["id"]) == 0.0
    assert _balance(db_session, teacher["id"]) == 20000.0
    db_session.expire_all()
    assert (
        db_session.query(PendingCharge)
        .filter(PendingCharge.lesson_id == lesson["id"], PendingCharge.resolved_at.is_(None))
        .first()
        is None
    )

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 200, resp.text

    # Full 50,000 refunded to the student, and BOTH teacher installments (8,000 + 12,000) clawed back
    assert _balance(db_session, student["id"]) == 50000.0
    assert _balance(db_session, teacher["id"]) == 0.0


def test_correction_with_insufficient_balance_splits_like_bulk_mark(
    client, superadmin_headers, admin_headers, db_session
):
    """A single-student correction (PUT) with insufficient balance must behave exactly
    like the bulk mark-attendance endpoint: deduct the full fee into negative balance,
    pay the teacher immediately for the collected part, and queue the rest."""
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800009",
        student_phone="+998900800010",
        lesson_price=50000,
        deposit=10000,
    )

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "excused"}]},
    )
    assert resp.status_code == 201, resp.text

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "present", "correct_count": 5, "total_count": 5},
    )
    assert resp.status_code == 200, resp.text

    # 10,000 collected - 50,000 fee = -40,000 negative balance (debt), same as a bulk mark would do
    assert _balance(db_session, student["id"]) == -40000.0
    assert _balance(db_session, teacher["id"]) == 4000.0

    db_session.expire_all()
    pending = (
        db_session.query(PendingCharge)
        .filter(PendingCharge.lesson_id == lesson["id"], PendingCharge.resolved_at.is_(None))
        .first()
    )
    assert pending is not None
    assert pending.amount == 40000.0
    assert pending.original_amount == 40000.0
    assert pending.teacher_share == 16000.0


def test_teacher_pending_commission_reflects_unresolved_charges(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800011",
        student_phone="+998900800012",
        lesson_price=50000,
        deposit=10000,
    )

    resp = client.get("/api/v1/teachers/pending-commission", headers=teacher_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total_amount": 0.0, "charge_count": 0}

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    # 40,000 left uncollected -> 40% teacher share = 16,000 still pending
    resp = client.get("/api/v1/teachers/pending-commission", headers=teacher_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total_amount": 16000.0, "charge_count": 1}

    resp = client.get(f"/api/v1/teachers/{teacher['id']}/pending-commission", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total_amount": 16000.0, "charge_count": 1}

    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 40000},
    )
    resp = client.get("/api/v1/teachers/pending-commission", headers=teacher_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total_amount": 0.0, "charge_count": 0}
