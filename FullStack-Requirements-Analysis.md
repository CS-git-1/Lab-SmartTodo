# วิเคราะห์งาน Full Stack และ Lab 13

เอกสารนี้จัดหมวดงานสำหรับเชื่อม Todo UI กับ API/ฐานข้อมูล เพิ่มการยืนยันตัวตนด้วย Microsoft Entra ID และ MSAL และเตรียม deploy Frontend/Backend บน Azure VM เครื่องเดียวตามข้อจำกัดงบประมาณ

## สรุปสถานะปัจจุบัน

### มีแล้ว

- Todo UI เรียก API module สำหรับ GET, POST, PUT และ DELETE
- มี loading, empty, error และ success states
- ระหว่างส่ง request มี pending state และป้องกันการกดซ้ำ
- ถ้า request ล้มเหลว UI ไม่แสดง success และเก็บค่าที่กรอกในฟอร์ม
- Backend เชื่อม Azure SQL ได้ และมี owner-scoped CRUD
- ทดสอบ CRUD/ownership กับ Azure SQL แล้ว โดยลบข้อมูลทดสอบหลังตรวจ
- Deploy Frontend และ Backend ลง VM เดียวแล้ว; Nginx/Node service ทำงาน และ backend query Azure SQL ได้

### ยังไม่ตรงตาม Lab 13

- Authentication ปัจจุบันเป็นระบบอีเมล/รหัสผ่านและ token ของแอปเอง ยังไม่ได้ใช้ Microsoft Entra ID/MSAL
- ยังไม่ได้ใช้ Microsoft Entra ID/MSAL
- ตั้ง HTTPS ด้วยใบรับรอง Let’s Encrypt และ redirect HTTP ไป HTTPS แล้ว
- ผู้ใช้ยืนยันให้รวม Frontend/Backend ไว้บน VM เดียวเพื่อลดค่าใช้จ่าย
- VM ที่ใช้ deploy ติดตั้ง Node.js 22, Nginx และใบรับรอง HTTPS แล้ว; Azure CLI ไม่จำเป็นสำหรับ deploy ผ่าน SSH

## หมวดงานที่ต้องทำ

| ลำดับ | หมวด | งานหลัก | ผลลัพธ์ที่ต้องได้ |
|---:|---|---|---|
| 1 | ตัดสินใจสถาปัตยกรรมและสิทธิ์ | ใช้ VM เดียว; เตรียม SSH/IP และให้ Nginx เสิร์ฟ frontend พร้อม reverse proxy backend | ทราบเครื่องและเข้าถึงได้ |
| 2 | Microsoft Entra และ MSAL | ตั้งค่า tenant, Frontend client, API resource/scope และ redirect URI; เปลี่ยนหน้า login ให้ใช้ MSAL | Frontend ขอ access token สำหรับ API ได้ |
| 3 | Backend authentication | ตรวจ access token ด้วย library มาตรฐาน รวม signature, issuer, audience, expiry และ scope | API รับเฉพาะ token ที่ถูกต้องและมีสิทธิ์ |
| 4 | Authorization และ ownership | ใช้ identity จาก token ทุก endpoint ที่อ่าน/แก้/ลบ task; ทดสอบผู้ใช้ A กับ task ของผู้ใช้ B | ผู้ใช้เข้าถึงได้เฉพาะข้อมูลของตน |
| 5 | Database identity mapping | ผูกผู้ใช้ Entra กับแถวใน `Users`; วางแผนย้ายจาก `PasswordHash`/ผู้ใช้เดิมโดยไม่ทำให้ owner ของ task หาย | ทุก task ยังผูกกับเจ้าของที่ถูกต้อง |
| 6 | CRUD และ UI states | ตรวจ POST/PUT/DELETE, pending, retry, error และ success; คงข้อมูลในฟอร์มเมื่อบันทึกไม่ผ่าน | UI แสดงผลตามคำตอบจริงจาก server |
| 7 | CORS และ network security | ตั้ง origin ให้ตรง URL จริง, รองรับ `Authorization`, `Content-Type` และ preflight `OPTIONS`; จำกัด inbound/outbound network | Browser เรียก API ได้จาก origin ที่อนุญาตเท่านั้น |
| 8 | Deploy บน VM | เสิร์ฟ React build ผ่าน Nginx; รัน Node API เป็น service; ตั้ง HTTPS, API URL, CORS และ secrets | Frontend และ Backend ทำงานต่อเนื่องบน VM |
| 9 | ตรวจรับงาน | ทดสอบ login, CRUD, refresh, CORS, token errors, ownership isolation และ Azure SQL | ผ่าน flow ตั้งแต่หน้าเว็บถึงฐานข้อมูล |

## จุดตัดสินใจด้าน Authentication

โจทย์กล่าวถึงทั้ง session cookie และ access token ซึ่งเป็นคนละรูปแบบกัน ข้อกำหนดที่ระบุ Entra/MSAL และให้ Frontend ขอ token สำหรับ API สอดคล้องกับแบบ SPA เรียก API โดยตรง:

```text
React + MSAL → ขอ Access token → Authorization: Bearer <token>
             → Backend ตรวจ token → query task ตาม owner
```

- ใช้ **authorization code flow พร้อม PKCE** สำหรับ SPA ผ่าน MSAL
- ใช้ **access token** เรียก API; ID token ใช้ยืนยันตัวตนกับ client ไม่ใช้แทน access token ที่เรียก API
- Backend ตรวจ token ก่อนสร้าง user identity สำหรับ request
- ทุก query ที่ใช้ Task ID ต้องตรวจ ownership ด้วย user identity ที่ตรวจ token แล้ว

ถ้าต้องการ session cookie แทน bearer token ควรเลือกสถาปัตยกรรม BFF ให้ Backend จัดการ session ด้วย `HttpOnly`, `Secure`, `SameSite` cookie และออกแบบ CSRF protection เพิ่ม ไม่ควรผสม cookie session กับ SPA bearer-token flow โดยไม่มีเหตุผลชัดเจน

เอกสาร Microsoft:

- [Application types และ SPA flow บน Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types)
- [การตรวจ access token ของ protected web API](https://learn.microsoft.com/en-us/azure/active-directory/develop/scenario-protected-web-api-overview)

## CORS และการเชื่อมต่อ

Origin ประกอบด้วย protocol, host และ port ดังนั้น `http://localhost:5173` กับ `http://localhost:3000` เป็นคนละ origin

Production ควรกำหนดค่าให้ตรง URL จริง เช่น:

```text
CORS_ORIGIN=https://todo.example.com
VITE_API_BASE_URL=https://api.example.com/api
```

เมื่อส่ง `Authorization` หรือ `Content-Type` บางชนิด Browser อาจส่ง preflight `OPTIONS` ก่อน API request จริง Backend ต้องตอบ preflight โดยอนุญาต origin, method และ header ที่ต้องใช้เท่านั้น ไม่ใช้ `*` เป็นทางแก้ถาวร

## โครงสร้าง Deploy บน VM เดียว

```text
Browser
  └── HTTPS → VM เดียว / Nginx
                  ├── / → React build
                  └── /api → Node API (localhost)
                                      └── Encrypted SQL → Azure SQL
```

- Nginx เสิร์ฟ frontend build และ proxy `/api` ไป Node API ที่ localhost; ไม่เปิดพอร์ต Node สู่ Internet โดยตรง
- Azure SQL รับ connection จาก Backend เท่านั้น ใช้ firewall/VNet หรือ Private Endpoint ตามข้อจำกัดของ Lab
- จำกัด SSH port 22 ให้เข้าถึงจาก IP ที่จำเป็น; เปิดเว็บด้วย HTTPS
- เก็บ DB credential และค่าลับบน VM ผ่าน environment/service configuration ที่ไม่อยู่ใน Git

## ข้อมูลที่ยังต้องมีสำหรับ Lab 13

ก่อนทำ Entra integration ยังต้องกำหนด tenant, app registrations, API scope/audience และ redirect URI ที่จะใช้ ห้าม commit private key หรือ secrets ลง repository

## เกณฑ์ผ่าน

- [ ] ผู้ใช้ลงชื่อเข้าใช้ผ่าน Entra/MSAL และ Frontend ใช้ access token เรียก API
- [ ] Backend ตรวจ token และปฏิเสธ token หาย/หมดอายุ/ผิด audience หรือ scope
- [ ] ผู้ใช้ A อ่าน แก้ และลบ task ของผู้ใช้ B ไม่ได้
- [ ] เพิ่ม/แก้/ทำเสร็จ/ลบจากหน้าเว็บได้; UI เปลี่ยนหลัง server ยืนยันสำเร็จเท่านั้น
- [ ] API ล้มเหลวแล้วไม่แสดง success; ฟอร์มยังเก็บข้อมูลและมีวิธีลองใหม่
- [ ] Refresh แล้วข้อมูลตรงกับ Backend/Azure SQL
- [ ] Frontend และ Backend ทำงานบน VM เดียวผ่าน Nginx และ Backend เชื่อม Azure SQL ได้
- [ ] CORS อนุญาตเฉพาะ Frontend origin จริงและใช้งาน HTTPS
