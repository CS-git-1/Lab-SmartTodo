# Smart Todo

Repository: [CS-git-1/smart-todo-curd](https://github.com/CS-git-1/smart-todo-curd)

แอปจัดการงานที่สร้างด้วย React และ Vite โดยโหลดข้อมูลผ่าน backend API และเก็บ task ใน Azure SQL Server

ตั้งค่า `VITE_API_BASE_URL` ใน `.env.local` (ค่าเริ่มต้น `http://localhost:3000/api`) ก่อนเริ่ม frontend ด้วย `npm run dev` Backend รองรับการเข้าสู่ระบบด้วย HttpOnly cookie; ตั้งค่า `CORS_ORIGIN` ฝั่ง backend ให้ตรงกับ origin ของ frontend

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด URL ที่ Vite แสดงใน terminal (โดยทั่วไปคือ `http://localhost:5173/`).

## ความสามารถหลัก

- เพิ่ม task จากฟอร์ม พร้อม title, description, priority และ due date
- แสดง ค้นหาด้วยปุ่ม “ค้นหา” หรือ Enter และกรอง task ตามสถานะหรือ priority
- สลับสถานะ Active/Done ได้ทั้งสองทาง และลบ task ตาม ID พร้อม Undo 10 วินาที
- ล้างงานที่เสร็จแล้วได้ พร้อม Undo 10 วินาที
- แก้ไข title และรายละเอียดของ task
- แสดง empty state เมื่อไม่มี task ตรงกับรายการที่แสดง

## Demo flow: Add → List → Toggle → Delete จน Empty

1. เพิ่ม task ด้วย title ที่จำได้ง่าย
2. ตรวจว่า task นั้นปรากฏในรายการ TodoList
3. กดปุ่มวงกลมของ task แล้วตรวจว่าเปลี่ยนเป็น Done
4. ลบ task นั้น แล้วตรวจว่าหายจากรายการ
5. ลบ task ที่เหลือทีละรายการ; แต่ละครั้งกู้คืนได้ด้วย Undo ภายใน 10 วินาที จน TodoList แสดง empty state

ก่อนตรวจ Empty ให้ล้างคำค้นหาและตั้งตัวกรอง status/priority เป็น `all` เพื่อให้แน่ใจว่าไม่มี task เหลือจริง ไม่ใช่ถูกซ่อนจาก filter. ดูรายละเอียดการตรวจและช่องบันทึกผลใน [TODO-FLOW.md](./TODO-FLOW.md).

## คำสั่งตรวจโค้ด

```bash
npm run build
npm run lint
```

## Git

สาขาหลักคือ `main` และ remote `origin` ชี้ไปยัง repository ด้านบน ไฟล์ `node_modules/` และ `dist/` ถูกละเว้นตาม `.gitignore`.
