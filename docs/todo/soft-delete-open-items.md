# Soft delete — hozircha hal qilinmagan, lekin kelajakda ko'rib chiqilishi kerak bo'lgan masala

Bu fayl shoshilinch emas, lekin unutilmasligi kerak bo'lgan ochiq masalani saqlaydi.
Asosiy soft-delete ishi (`deleted_at`/`deleted_by_id`, block vs delete farqi, delete/restore
endpointlari, ro'yxat filtri, frontend tugmalari) allaqachon qilingan va ishlaydi.

---

## Telefon raqami boshqa (yangi) odamga o'tgan holat

**Muammo:** Agar student/teacher/admin o'chirilgan bo'lsa, uning telefon raqami baribir
o'zida qoladi (DB'da `phone` ustuni `unique=True, nullable=False`). Agar shu raqam
kelajakda operator tomonidan **boshqa, haqiqatan ham yangi odamga** berilsa (O'zbekistonda
raqamlar operator tomonidan uzoq vaqt ishlatilmasa qayta berib yuboriladi), hozirgi tizim
bu holatni ajrata olmaydi:

- Yangi odam uchun yangi profil ochish **mumkin emas** — backend xato qaytaradi va faqat
  "eski o'chirilgan yozuvni tiklash" variantini taklif qiladi (`app/routers/students.py`
  va `app/routers/admin.py` dagi `_check_phone_available`).
- "Tiklash" variantidan foydalanish **noto'g'ri** — bu eski odamning ismi, balansi va
  tarixini yangi odamga "kiydirib qo'yadi".

**Muhokama qilingan, lekin amalga oshirilmagan yechim:**

Eski (o'chirilgan) yozuvning `phone` maydonini ichki ravishda "band qilish"
(masalan `+998901234567::deleted::42` kabi, foydalanuvchiga ko'rsatilmaydigan shaklda),
shunda:
- Haqiqiy raqam bo'shaydi, yangi odam erkin yangi profil ochadi.
- Eski yozuv (ism, balans, to'lov/davomat tarixi) **saqlanib qoladi**, "O'chirilganlar"
  filtrida ismi orqali topish mumkin, lekin endi telefon orqali qidirib bo'lmaydi.

**Kamchiligi:** bu amal qaytarilmaydigan bo'ladi — raqami "band qilingan" yozuvni keyin
oddiy "Tiklash" orqali asl holatiga qaytarib bo'lmaydi (chunki asl raqami endi band emas,
ba'zan allaqachon boshqasiga berilgan bo'ladi).

**Qaror kerak:** bu funksiyani qo'shish kerakmi, kim chaqira olishi kerak (faqat
superadmin bo'lsinmi), va UI qanday ko'rinishi kerak (masalan telefon-ziddiyat xatosi
chiqqanda ikkinchi tugma: "Bu boshqa odam, yangi profil och").
