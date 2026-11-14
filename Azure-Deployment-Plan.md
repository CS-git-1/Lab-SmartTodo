# Azure Deployment Analysis Plan — Smart Todo

## เป้าหมาย

แยกแอปเป็น 3 ส่วนที่ดูแลและตั้งค่าแยกกันได้:

1. **Frontend:** React/Vite สำหรับแสดงหน้าเว็บ
2. **Backend:** Node.js/Express สำหรับ API และการยืนยันตัวตน
3. **Database:** Azure SQL สำหรับจัดเก็บบัญชีและงาน

Frontend และ Backend อยู่บน Azure VM เครื่องเดียวเพื่อลดค่าใช้จ่าย โดย Nginx เสิร์ฟหน้าเว็บและ reverse proxy `/api` ไปยัง Node.js ที่ฟังเฉพาะ localhost; Backend เชื่อมต่อ Azure SQL โดยตรง

```text
ผู้ใช้
  │ HTTPS
  ▼
Azure VM เดียว
  ├── Nginx: Frontend static files + /api reverse proxy
  └── Node.js/Express: localhost only
  │ SQL connection
  ▼
Database: Azure SQL
```

## ขั้นที่ 1: ยืนยันสถาปัตยกรรมและการยืนยันตัวตน

ก่อนสร้างทรัพยากร Azure ให้ตัดสินใจว่าจะใช้ระบบใด:

- แนะนำตามข้อกำหนด: Microsoft Entra ID และ MSAL ให้ Frontend รับ access token และส่งให้ Backend
- Backend ต้องตรวจลายเซ็น token, วันหมดอายุ, audience และ scope ก่อนให้เรียก API
- เมื่อใช้ Entra แล้ว ให้ประเมินว่าจะเลิกใช้ระบบสมัคร/ล็อกอินและ session cookie ภายในโปรเจกต์หรือไม่ เพื่อไม่ให้มีระบบยืนยันตัวตนซ้ำซ้อน

ผลลัพธ์ของขั้นนี้คือข้อตกลงเรื่อง tenant, app registration, API scope และ audience ที่ Backend จะยอมรับ

## ขั้นที่ 2: เตรียม Repository และวิธี Deploy

ใช้ Azure VM ที่มีอยู่สำหรับ Frontend และ Backend ในเครื่องเดียว; deploy ผ่าน SSH หรือ GitHub Actions ตามวิธีที่เลือก

- ตรวจว่า repository อยู่บน GitHub และ branch ที่จะใช้ deploy ชัดเจน
- build `frontend/` แล้วส่ง `dist/` ไป Nginx; ติดตั้ง `backend/` บน VM และรันเป็น service
- เก็บค่าลับเป็น GitHub/Azure secrets หรือ App Settings ห้ามใส่ secrets ใน source code
- กำหนดว่าจะ deploy อัตโนมัติเมื่อ push หรือให้ deploy หลังตรวจและอนุมัติก่อน

## ขั้นที่ 3: เตรียม Azure SQL

- สร้าง Azure SQL Database และตั้งค่าผู้ใช้สำหรับ Backend โดยให้สิทธิ์เท่าที่จำเป็น
- นำ schema ของโปรเจกต์ไปใช้กับฐานข้อมูลที่เตรียมไว้
- กำหนด network/firewall ให้ Backend เข้าถึง DB ได้ โดยไม่เปิดการเข้าถึงจาก Frontend
- เตรียม credentials หรือ identity สำหรับการเชื่อมต่อ และกำหนดที่เก็บ secrets
- วางแผน backup และวิธีกู้คืนข้อมูล

## ขั้นที่ 4: เตรียมและ Deploy Backend

รัน Node.js API บน VM เป็น systemd service และให้ Nginx reverse proxy `/api` ไป `127.0.0.1:3000`; ห้ามเปิดพอร์ต Node สู่อินเทอร์เน็ตโดยตรง

ตั้งค่าอย่างน้อย:

- `NODE_ENV=production`; session cookie ใช้ `Secure` และ Nginx บังคับ redirect จาก HTTP ไป HTTPS
- `AUTH_TOKEN_SECRET` หากยังใช้ token ภายใน; หากย้ายไป Entra เต็มรูปแบบให้ทบทวนว่าค่านี้ยังจำเป็นหรือไม่
- `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `CORS_ORIGIN` เป็น origin จริงของ Frontend
- ตั้งค่า HTTPS และ health check สำหรับตรวจว่า API พร้อมให้บริการ

ก่อนเชื่อม Frontend ให้ตรวจว่า Backend เชื่อมต่อ SQL ได้ และปฏิเสธคำขอที่ไม่มี token หรือมี token ที่ audience/scope ไม่ถูกต้อง

## ขั้นที่ 5: เตรียมและ Deploy Frontend

สร้าง production build ของ React/Vite และให้ Nginx เสิร์ฟ static files

- ตั้ง `VITE_API_BASE_URL=/api` ให้ browser เรียก API ผ่าน origin เดียวกัน
- ตั้งค่า MSAL ด้วย tenant/client ID และ redirect URI ของ Frontend
- ลงทะเบียน redirect URI ของ URL ที่ deploy จริงใน Microsoft Entra
- ตรวจว่า build workflow ทำงานจากโฟลเดอร์ `frontend/` และเผยแพร่ไฟล์ build ที่ Vite สร้าง

ค่าที่ขึ้นต้นด้วย `VITE_` จะถูกฝังในไฟล์ frontend ที่ผู้ใช้ดาวน์โหลดได้ จึงใส่ได้เฉพาะค่าที่เปิดเผยได้ เช่น URL และ client ID ห้ามใส่ client secret หรือรหัสฐานข้อมูล

## ขั้นที่ 6: ตั้งค่า HTTPS, CORS และ URL

เมื่อได้ URL จริงจาก Azure แล้ว:

- บังคับใช้ HTTPS ทั้ง Frontend และ Backend
- ตั้ง `CORS_ORIGIN` เป็น origin จริงและไม่อนุญาต origin อื่นใน production; same-origin ผ่าน Nginx ไม่ต้องเปิด CORS เพิ่ม
- ตั้ง redirect URI ใน Entra ให้ตรงกับ URL และ path ที่ MSAL ใช้
- ตรวจว่า Frontend ส่ง access token ไปยัง API และ Backend ตรวจ token ตาม scope/audience ที่กำหนด

## ขั้นที่ 7: ตรวจการทำงานจากผู้ใช้ถึงฐานข้อมูล

ตรวจตามลำดับการใช้งานจริง:

1. ผู้ใช้ลงชื่อเข้าใช้ผ่าน Entra/MSAL
2. Frontend เรียก API พร้อม access token
3. Backend ปฏิเสธ token ที่หาย หมดอายุ หรือ claims ไม่ตรง
4. ผู้ใช้แต่ละคนอ่าน/แก้/ลบได้เฉพาะ task ของตนเอง
5. เพิ่ม แก้ ทำเสร็จ และลบ task ได้ โดย UI แสดงความสำเร็จหลัง Backend ตอบยืนยัน
6. เมื่อ API ล้มเหลว ต้องไม่แสดง success และต้องยังมีข้อมูลในฟอร์มให้ลองใหม่
7. Refresh หน้าแล้วข้อมูลต้องโหลดกลับจาก Backend/Azure SQL

## ลำดับ Deploy ที่แนะนำ

**ติดตั้ง runtime/Nginx → Backend service → Frontend build → ยืนยัน Azure SQL → ตั้ง HTTPS/domain → ตรวจ end-to-end**

ลำดับนี้ทำให้ตั้งค่า Frontend ด้วย URL Backend จริงได้ และ Backend มีฐานข้อมูลพร้อมก่อนเริ่มตรวจ API

## การตัดสินใจที่ยังต้องมี

- จะใช้ Entra/MSAL access token ตามข้อกำหนด และเลิกใช้ session cookie ภายในหรือไม่
- จะใช้ URL `*.azurestaticapps.net` และ `*.azurewebsites.net` ก่อน หรือเตรียม custom domain
- จะใช้ GitHub Actions deploy อัตโนมัติจาก branch ใด
- Azure SQL จะเปิด network access แบบใดให้ Backend โดยยังไม่เปิด DB สู่ Frontend
