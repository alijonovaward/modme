# 📚 O'quv Markazi CRM Tizimi — Texnik Hujjat (joriy holat)

> Bu hujjat loyihaning **hozirgi (amaldagi) holatini** tasvirlaydi — boshlang'ich reja emas. Kod tez rivojlangani uchun, agar bu yerda yozilgan narsa kod bilan mos kelmasa, **kod haqiqiy manba hisoblanadi**. Katta o'zgarish qilinganda shu faylni ham yangilab turish tavsiya etiladi.

---

## 1. Arxitektura va texnologiyalar

* **Backend:** FastAPI (Python), SQLAlchemy ORM. Migratsiyalar Alembic orqali emas, `app/db/init_db.py` ichida qo'lda yozilgan ustun-qo'shish tekshiruvlari orqali amalga oshadi.
* **Ma'lumotlar bazasi:** SQLite (lokal rivojlantirish) / PostgreSQL (production). Pul maydonlari `Numeric(14, 0)` — so'mda kasr qism yo'q, Decimal orqali aniq hisoblanadi (`app/core/money.py`).
* **Autentifikatsiya:** JWT (access token), login telefon raqam + parol orqali (`/api/v1/auth/login`). Parollar faqat admin/bosh admin tomonidan qo'lda o'rnatiladi — SMS yoki bot orqali tiklash yo'q.
* **Frontend:** React + Vite + TypeScript + Tailwind CSS, PWA (o'rnatish banneri bilan). Rol bo'yicha marshrutlash (`ProtectedRoute`), telefon ekrani uchun alohida zich ro'yxat ko'rinishi (`MobileList`/`MobileListRow`) har bir jadval sahifasida desktop jadvali bilan yonma-yon ishlaydi.
* **Telegram integratsiyasi:** foydalanuvchi (o'quvchi) o'z Telegram akkauntini bog'lab qo'ysa (`telegram_chat_id`), balans to'ldirilganda/yechilganda, davomat belgilanganda avtomatik xabar boradi (`app/core/telegram.py`).

---

## 2. Rollar va huquqlar

Tizimda 4 ta rol bor, hammasi bitta `users` jadvalida, `role` ustuni orqali farqlanadi:

1. **Superadmin (Bosh Administrator)** — barcha ma'lumotni ko'radi, xodim (admin/o'qituvchi) yaratadi, o'qituvchiga foiz stavkasini belgilaydi, `/stats/reconciliation` orqali hisobotlar yaxlitligini tekshiradi.
2. **Admin** — o'quvchi ro'yxatga oladi, balansga pul kiritadi/qaytaradi, guruh ochadi, o'quvchini guruhga qo'shadi/chiqaradi/muzlatadi, parollarni qo'lda tiklaydi. O'qituvchi **yarata olmaydi**.
3. **O'qituvchi** — faqat o'ziga biriktirilgan guruhlarni ko'radi, davomat belgilaydi (24 soat ichida tuzatish huquqi bilan), o'z moliyaviy tarixini (`Moliyam`) ko'radi.
4. **O'quvchi** — o'z balansi, davomati, tranzaksiyalari tarixini ko'radi (`/student/...` sahifalari).

**Muhim:** Admin va superadmin umumiy Tranzaksiyalar sahifasida **bir xil ko'rish huquqiga** ega — kim kiritgan/yechgan bo'lishidan qat'i nazar, barcha yozuvlarni ko'radi (teacher esa faqat o'z guruhlariga tegishlilarini).

---

## 3. Ma'lumotlar bazasi tuzilmasi

### 3.1. `users`
* `id`, `full_name`, `phone` (unique, login sifatida), `hashed_password`, `role` (`superadmin`/`admin`/`teacher`/`student`)
* `teacher_percentage` (faqat o'qituvchi uchun, masalan 40.0)
* `balance` (`Numeric(14,0)`) — o'quvchi uchun qolgan pul (manfiy bo'lishi mumkin — qarz), o'qituvchi uchun ishlagan/yechib olinmagan pul
* `is_active` — bloklash belgisi. **Bloklash o'quvchining barcha faol guruh a'zoligini avtomatik "frozen" qiladi** (davomat/pul oqimi to'xtaydi); qayta faollashtirish bu holatni **avtomatik qaytarmaydi** — admin har bir guruhni qo'lda qayta faollashtirishi kerak.
* `telegram_chat_id` — ixtiyoriy, Telegram bog'langanda to'ldiriladi

### 3.2. `subjects` — fanlar (`id`, `name`)

### 3.3. `groups` — guruhlar
* `name`, `subject_id`, `teacher_id`, `lesson_price`, `status` (`active`/`frozen`/`archived`)
* `group_schedules` — alohida jadval: har bir guruh bir nechta `(weekday, start_time, end_time)` qatoriga ega bo'lishi mumkin (haftada bir necha kun)

### 3.4. `group_students` — guruh-o'quvchi bog'lanishi
* `status`: `active` / `frozen` (muzlatilgan — pul yechilmaydi) / `dropped` (chiqarilgan, sabab majburiy)
* Bitta o'quvchi bir guruhda faqat bitta faol (`active`/`frozen`) yozuvga ega bo'lishi mumkin; `dropped`dan keyin qayta qo'shilsa yangi qator ochiladi
* Guruhga qo'shishda **jadval to'qnashuvi** (schedule conflict) tekshiriladi — o'quvchi bir vaqtda ikki guruhga yozilishi odatiy holatda bloklanadi (`force` bayrog'i bilan bypass qilinadi)

### 3.5. `lessons` — darslar
* `group_id`, `lesson_date`, `start_time`/`end_time` (ixtiyoriy), `status` (`planned`/`completed`)
* Bitta guruh + sana juftligi uchun faqat bitta dars (`uq_lessons_group_date`)
* Guruh jadvali asosida darslarni avtomatik yaratish mumkin (30 kunlik gorizont, kunlik fon vazifasi)

### 3.6. `attendances` — davomat
* `lesson_id`, `student_id`, `status` (`present`/`excused`/`unexcused`)
* `correct_count`/`total_count` — **ixtiyoriy test natijasi** (masalan 4/5), faqat `present` holatida kiritiladi. *(Eslatma: eski versiyada "1-5 baho" bo'lgan, hozir test natijasi bilan almashtirilgan)*
* `is_trial` — sinov darsi belgisi: `true` bo'lsa pul yechilmaydi, lekin davomat yozib qo'yiladi
* O'qituvchi davomatni belgilagandan **24 soat ichida** tuzatishi mumkin (`ATTENDANCE_EDIT_WINDOW`)

### 3.7. `transactions` — o'quvchi pul harakati
* `student_id`, `amount` (musbat=kirim, manfiy=chiqim), `type` (`deposit`/`deduction`), `comment`, `created_by_id`, `lesson_id` (ixtiyoriy — darsga bog'liq bo'lmagan yozuvlarda bo'sh)
* **Ledger yozuvlari hech qachon o'rnida tahrirlanmaydi** — davomat tuzatilganda yoki holat o'zgarganda har doim yangi, qarama-qarshi (offsetting) yozuv qo'shiladi

### 3.8. `teacher_transactions` — o'qituvchi daromadi
* `teacher_id`, `lesson_id`, `student_id`, `amount`, `type` (`lesson_earning`/`payout`), `created_by_id`

### 3.9. `pending_charges` — kechiktirilgan qarz (o'qituvchi ulushi uchun)
* O'quvchi balansi darsning narxini to'liq qoplay olmasa: **balansdan baribir to'liq summa yechiladi** (balans manfiy bo'lib qolishi mumkin), lekin o'qituvchiga yetishmagan qism darhol to'lanmaydi — shu qism `pending_charges`ga yoziladi (`amount`, `original_amount`, `teacher_share`, `resolved_at`)
* O'quvchi keyinroq pul to'ldirsa, eng eski qarzdan boshlab avtomatik yopiladi, o'qituvchiga mos ulush o'tkaziladi (`_settle_pending_charges`)

### 3.10. `idempotency_keys`
Pul harakatlantiruvchi so'rovlar (`deposit`, `withdraw`, `payout`) uchun `Idempotency-Key` header orqali — tarmoq xatosi natijasida qayta yuborilgan so'rov bir xil amalni ikki marta bajarmasligini ta'minlaydi.

### 3.11. `app_state`
Kichik key-value jadval — masalan, kunlik "darslarni avtomatik yaratish" vazifasi oxirgi marta qachon ishlaganini saqlash uchun.

---

## 4. Asosiy biznes-mantiq

### 4.1. Davomat belgilash va pul oqimi (`app/routers/lessons.py`)
O'qituvchi dars uchun davomat belgilaganda (`POST /lessons/{id}/attendance`):

1. **Keldi (`present`):** ixtiyoriy test natijasi kiritiladi → `should_charge = true` (agar sinov darsi va muzlatilmagan bo'lsa)
2. **Sababli (`excused`):** pul yechilmaydi, o'qituvchiga ham yozilmaydi
3. **Sababsiz (`unexcused`):** pul **yechiladi** (dars o'tgani uchun, o'quvchi sababsiz qoldirgani uchun javobgar) — `present` bilan bir xil moliyaviy natija
4. **Sinov darsi (`is_trial=true`):** holatidan qat'i nazar pul yechilmaydi

Pul yechish/qaytarish har doim `_apply_lesson_fee` / `_reverse_lesson_fee` / `_sync_lesson_charge` orqali, **yangi offsetting yozuv** sifatida amalga oshadi — hech qachon eski tranzaksiya qatori o'zgartirilmaydi. Parallel so'rovlar (masalan ikki marta tez ketma-ket yuborish) uchun o'quvchi/o'qituvchi qatori `SELECT ... FOR UPDATE` bilan qulflanadi.

### 4.2. Balansni to'ldirish / qaytarib berish
* **To'ldirish** (`POST /students/{id}/deposit`): balansga pul qo'shiladi, keyin kutilayotgan qarzlar (pending charges) eng eskisidan boshlab avtomatik yopiladi.
* **Qaytarib berish** (`POST /students/{id}/withdraw`): admin o'quvchiga naqd pul qaytarganini qayd etadi (ortiqcha to'lov, chiqib ketish va h.k.). **Joriy balansdan ko'p yechib bo'lmaydi** — darsga bog'liq bo'lmagani uchun qarzga o'tkazilmaydi.
* Ikkalasi ham `Idempotency-Key` bilan himoyalangan va Telegram orqali xabar yuboradi (agar bog'langan bo'lsa).

### 4.3. O'qituvchiga pul berish (`POST /teachers/{id}/payout`)
Admin o'qituvchi balansidan pul yechib berganini qayd etadi — xuddi o'quvchi `withdraw`siga o'xshab, o'qituvchi balansidan ko'p yechib bo'lmaydi.

### 4.4. Guruhni/o'quvchini muzlatish
* `group_students.status = frozen` — shu guruh bo'yicha pul yechish/davomat hisoblash vaqtincha to'xtaydi, lekin o'quvchi guruhda ro'yxatda qoladi.
* `users.is_active = false` (Bloklash) — o'quvchining **barcha faol guruh a'zoligi avtomatik frozen**ga o'tadi (bir martalik harakat bilan butun o'quv jarayoni to'xtaydi), hisobga kirish ham yopiladi. Band 3.1ga qarang.

### 4.5. Ma'lumotlar yaxlitligi
`GET /stats/reconciliation` (faqat superadmin) — har bir o'quvchi/o'qituvchi uchun `balance` ustunini, o'sha foydalanuvchiga tegishli barcha tranzaksiyalar yig'indisi bilan solishtiradi. Mos kelmasa — bu dastur xatosi yoki bazaga to'g'ridan-to'g'ri kirishning belgisi.

---

## 5. Asosiy API yo'nalishlari (qisqacha)

* `POST /api/v1/auth/login` — JWT token olish
* `POST /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/status|password` — xodim boshqaruvi (superadmin/admin)
* `POST /api/v1/students`, `POST /api/v1/students/{id}/deposit|withdraw`, `PUT /api/v1/students/{id}/status` — o'quvchi va moliya
* `POST /api/v1/groups`, `POST /api/v1/groups/{id}/students`, `PUT /api/v1/groups/{id}/students/{student_id}` — guruh va a'zolik
* `POST /api/v1/lessons`, `POST /api/v1/lessons/generate`, `POST /api/v1/lessons/{id}/attendance`, `PUT /api/v1/lessons/{id}/attendance/{student_id}` — darslar va davomat
* `GET /api/v1/teachers/finance`, `POST /api/v1/teachers/{id}/payout` — o'qituvchi moliyasi
* `GET /api/v1/transactions`, `GET /api/v1/teachers/transactions` — umumiy tranzaksiya ro'yxatlari (filtrlar bilan)
* `GET /api/v1/stats/overview`, `GET /api/v1/stats/reconciliation` — umumiy statistika va yaxlitlik tekshiruvi

Deyarli barcha ro'yxat endpointlari uchun `/export` varianti ham bor (Excel chiqarish).

---

## 6. Testlar

Backend: `pytest` (`tests/`), 90+ test — pul hisob-kitobi, idempotency, reconciliation, ruxsatlar, davomat tuzatish, muzlatish/bloklash oqimlari qamrab olingan.
Frontend: `vitest` + Testing Library (`frontend/src/**/*.test.tsx`) — asosiy sahifalarning render/interaksiya holatlari uchun.
