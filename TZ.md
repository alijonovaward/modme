# 📚 O‘quv Markazi CRM Tizimi – To‘liq Texnik Topshiriq (TZ)

Ushbu texnik topshiriq o‘quv markazining kundalik operatsiyalarini avtomatlashtirish, o‘quvchilar balansi, davomat, baholash, o‘qituvchilarning foizli oylik hisob-kitobi hamda rollar bo‘yicha huquqlarni boshqarishga mo‘ljallangan CRM tizimining backend (FastAPI) va kelgusidagi frontend/mobile ilovalari uchun asosiy qo‘llanma hisoblanadi.

---

## 1. Loyihaning Umumiy Arxitekturasi va Texnologiyalar
* **Backend Framework:** FastAPI (Python)
* **Ma'lumotlar Bazasi (DB):** PostgreSQL / SQLite (SQLAlchemy ORM)
* **Autentifikatsiya:** JWT (JSON Web Tokens) - Access token asosida.
* **Xarajatlarni qisqartirish siyosati:** SMS yoki Telegram bot orqali parollarni tiklash xizmatlaridan voz kechilgan. Parollar va loginlar faqat Administrator tomonidan to‘g‘ridan-to‘g‘ri qo‘lda boshqariladi va yangilanadi.

---

## 2. Foydalanuvchilar Rollari va Huquqlar Matrikasi (Roles & Permissions)

Tizimda 4 ta asosiy rol mavjud bo‘lib, ularning huquqlari quyidagicha qat'iy taqsimlangan:

1. **Glavniy Admin (Superadmin / Owner):**
   * Tizim egasi yoki bosh direktori.
   * Barcha ma'lumotlarni ko‘ra oladi, umumiy moliyaviy statistikani kuzatadi.
   * **O‘qituvchilarni yaratadi** va ularga har bir dars uchun o‘ziga xos **foiz (stavka - masalan, 40%)** belgilaydi.
   * Oddiy adminlarni nazorat qiladi.
2. **Administrator (Admin):**
   * O‘quvchilarni tizimga ro‘yxatga olish va ularning balansiga pul kiritish (**Depozit** qo‘shish).
   * Guruhlar ochish, ularga mos fan, o‘qituvchi va **1 ta dars narxini** biriktirish.
   * O‘quvchilarni guruhlarga qo‘shish, guruhdan chiqarish yoki ularning guruhdagi holatini vaqtincha **muzlatib qo‘yish (`Freeze`)**.
   * Xodimlar yoki o‘quvchilarning paroli esdan chiqqanda, ularga bazadan qo‘lda **yangi login va parol o‘rnatib berish**.
   * *Cheklov:* O‘qituvchi yarata olmaydi.
3. **O‘qituvchi (Teacher):**
   * Faqat o‘ziga biriktirilgan guruhlarni va darslarni ko‘radi.
   * Har bir dars davomida o‘quvchilarning **davomatini qiladi** (`Keldi`, `Sababli`, `Sababsiz`).
   * Kelgan o‘quvchilarga **1 dan 5 gacha baho** qo‘yadi.
   * O‘zining ishlagan puli (foiz tarixlari) va balansini sana hamda guruhlar bo‘yicha **filtrlab** ko‘ra oladi.
4. **O‘quvchi (Student - Kelgusidagi kabinet uchun):**
   * O‘zining joriy balansi, davomati, olgan baholari va to‘lovlar tarixini ko‘radi.

---

## 3. Ma'lumotlar Bazasi Tuzilmasi (DB Schema & Models)

### 3.1. `users` (Foydalanuvchilar)
Foydalanuvchilar (Admin, Glavniy Admin, O‘qituvchi, O‘quvchi) bitta jadvalda saqlanadi va `role` ustuni orqali farqlanadi.
* `id` (Integer, PK)
* `full_name` (String) - F.I.O
* `phone` (String, Unique) - Login sifatida ishlatiladi
* `hashed_password` (String) - Shifrlangan parol
* `role` (Enum: `superadmin`, `admin`, `teacher`, `student`)
* `teacher_percentage` (Float, Nullable) - Faqat o‘qituvchilar uchun foiz stavkasi (masalan: 40.0)
* `balance` (Float, Default=0.0) - O‘qituvchilar uchun ishlagan puli (balansi)
* `created_at` (DateTime)

### 3.2. `subjects` (Fanlar)
* `id` (Integer, PK)
* `name` (String) - Fan nomi (Masalan: Matematika, Ingliz tili)

### 3.3. `groups` (Guruhlar)
* `id` (Integer, PK)
* `name` (String) - Guruh nomi (Masalan: Math-101)
* `subject_id` (Integer, FK -> subjects.id)
* `teacher_id` (Integer, FK -> users.id) - Dars o‘tuvchi o‘qituvchi
* `lesson_price` (Float) - Guruhdagi 1 ta darsning narxi
* `status` (Enum: `active`, `frozen`, `archived`)

### 3.4. `group_students` (Guruh va O‘quvchi bog‘lanishi - Many-to-Many)
1 ta o‘quvchi bir nechta fanda/guruhda qatnashishi mumkinligini ta'minlaydi.
* `id` (Integer, PK)
* `group_id` (Integer, FK -> groups.id)
* `student_id` (Integer, FK -> users.id)
* `status` (Enum: `active`, `frozen` - muzlatilgan, `dropped` - chiqib ketgan)

### 3.5. `transactions` (O‘quvchi moliya va balans tarixi)
* `id` (Integer, PK)
* `student_id` (Integer, FK -> users.id)
* `amount` (Float) - Summa (Musbat: balans to‘ldirildi, Manfiy: dars uchun yechildi)
* `type` (Enum: `deposit`, `deduction`)
* `comment` (String, Nullable) - Izoh
* `created_at` (DateTime)

### 3.6. `teacher_transactions` (O‘qituvchi daromad va chiqim tarixi)
* `id` (Integer, PK)
* `teacher_id` (Integer, FK -> users.id)
* `amount` (Float) - Summa (Musbat: darsdan chiqqan foiz, Manfiy: admin bergan oylik/chiqim)
* `type` (Enum: `lesson_earning`, `payout`)
* `created_at` (DateTime)

### 3.7. `lessons` (Darslar jadvali)
* `id` (Integer, PK)
* `group_id` (Integer, FK -> groups.id)
* `lesson_date` (Date / DateTime) - Dars bo‘ladigan sana
* `status` (Enum: `planned`, `completed`)

### 3.8. `attendances` (Davomat va Baholar)
* `id` (Integer, PK)
* `lesson_id` (Integer, FK -> lessons.id)
* `student_id` (Integer, FK -> users.id)
* `status` (Enum: `present` - keldi, `excused` - sababli kelmadi, `unexcused` - sababsiz kelmadi)
* `grade` (Integer, Nullable) - 1 dan 5 gacha baho (Faqat `present` bo‘lganda kiritiladi)

---

## 4. Asosiy Biznes Logika va Tranzaksiyalar (Core Logic)

### 4.1. O‘quvchi balansini to‘ldirish (Deposit):
* Admin o‘quvchi profiliga pul kiritadi.
* `transactions` jadvaliga `deposit` turi bilan yozuv qo‘shiladi. O‘quvchining joriy balansiga bu summa qo‘shib boriladi (yoki balans tranzaksiyalar yig‘indisi sifatida hisoblanadi).

### 4.2. Davomat va Pul yechish mexanizmi (Atomic Transaction):
O‘qituvchi dars vaqtida davomat qilganda quyidagi shartlar bir vaqtning o‘zida (tranzaksiya ichida) bajarilishi shart:
1. **Keldi (`present`):** 
   * O‘quvchiga **1 dan 5 gacha baho** qo‘yiladi.
   * O‘quvchining balansidan guruhning `lesson_price` miqdoricha pul yechiladi (`transactions` jadvaliga `deduction` sifatida yoziladi).
   * O‘qituvchining foiz stavkasiga qarab (`teacher_percentage`), o‘qituvchiga tushadigan pul hisoblanadi: 
     $$\text{O‘qituvchi ulushi} = \text{lesson\_price} \times \frac{\text{teacher\_percentage}}{100}$$
   * Bu summa o‘qituvchining balansiga qo‘shiladi va `teacher_transactions` jadvaliga `lesson_earning` sifatida yoziladi.
2. **Sababli kelmadi (`excused`):** 
   * O‘quvchidan pul yechilmaydi.
   * O‘qituvchiga pul yozilmaydi.
3. **Sababsiz kelmadi (`unexcused`):** 
   * O‘quvchi balansidan guruhning `lesson_price` miqdoricha pul yechiladi (`deduction`).
   * O‘qituvchi darsga tayyor bo‘lib kelgani va o‘quvchi sababsiz qoldirgani uchun, o‘qituvchiga ham o‘z foizi hisoblanib yoziladi (`lesson_earning`).

### 4.3. Guruhni yoki o‘quvchini muzlatish (`Freeze`):
* O‘quvchi uzoq muddatga kelolmaydigan bo‘lsa, admin uning `group_students` dagi statusini `frozen` qiladi. Bu holatda tizim o‘quvchiga dars hisoblaganda undan pul yechishni vaqtincha chetlab o‘tadi.

---

## 5. FastAPI Backend API Endpoints (Rejalashtirilgan marshrutlar)

* **Autentifikatsiya:**
  * `POST /api/v1/auth/login` — Telefon raqam va parol orqali JWT token olish.
* **Admin / Glavniy Admin boshqaruvi:**
  * `POST /api/v1/admin/users` — Yangi xodim (o‘qituvchi, admin) qo‘shish (Glavniy admin uchun).
  * `PUT /api/v1/admin/users/{id}/password` — Unutilgan parolni qo‘lda yangilash (Admin uchun).
* **O‘quvchilar va Moliya:**
  * `POST /api/v1/students` — O‘quvchi qo‘shish.
  * `POST /api/v1/students/{id}/deposit` — O‘quvchi balansiga pul kiritish.
  * `GET /api/v1/students/{id}/transactions` — O‘quvchining to‘lovlar va yechimlar tarixini ko‘rish.
* **Guruhlar:**
  * `POST /api/v1/groups` — Guruh ochish, fan, o‘qituvchi va dars narxini belgilash.
  * `POST /api/v1/groups/{group_id}/students` — Guruhga o‘quvchi qo‘shish / muzlatish.
* **Darslar va Davomat:**
  * `POST /api/v1/lessons` — Guruh uchun dars ochish.
  * `POST /api/v1/lessons/{lesson_id}/attendance` — Davomat qilish, baho qo‘yish va avtomatik balans/foiz yechimlarini bajarish.
* **O‘qituvchi moliyasi:**
  * `GET /api/v1/teachers/finance` — O‘qituvchining o‘z daromad tarixi, ishlagan pullari va filtrlar (sana, guruh bo‘yicha).

---
*Ushbu hujjatni kelgusida `TZ.md` nomi bilan loyihangiz papkasiga saqlab qo‘yishingiz mumkin.*