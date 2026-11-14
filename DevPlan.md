# Smart Todo Full Stack Development Plan

แผนนี้ครอบคลุมการเชื่อม Todo UI กับ API และ Azure SQL, เพิ่ม authentication และ ownership, ตรวจการทำงานข้ามชั้น และ deploy ขึ้น Azure

## สถานะปัจจุบัน

- **เสร็จแล้ว:** API layer, response DTO, UI CRUD ผ่าน API, pending/duplicate guard และ error handling; การทดสอบ CRUD กับ Azure SQL ผ่านและลบข้อมูลทดสอบแล้ว
- **เสร็จแล้วเฉพาะระบบปัจจุบัน:** email/password ของแอป, bearer token ภายใน และ owner isolation; สิ่งนี้ยังไม่ใช่ Entra ID/MSAL ตาม Lab 13
- **ยังเหลือสำหรับ Lab 13:** เปลี่ยน auth เป็น Entra/MSAL, ให้ backend ตรวจ Entra access token, map Entra identity กับ owner ใน DB และทดสอบ flow ใหม่
- **การตัดสินใจ Deploy:** รวม Frontend/Backend บน VM เดียวตามงบประมาณ; Nginx เสิร์ฟ frontend และ reverse proxy ไป Node service
- **Deploy แล้ว:** Frontend และ Backend ทำงานบน VM เดียว; Nginx เสิร์ฟ Frontend/proxy `/api`, Node.js รันเป็น systemd service, เชื่อม Azure SQL ได้ และเปิด HTTPS

## ตารางแผนและระยะเวลา

| ลำดับ | ช่วงงาน | งานหลัก | ผลลัพธ์/เกณฑ์ผ่าน | เวลาทำโดยประมาณ | สถานะ |
|---:|---|---|---|---:|---|
| 1 | เตรียม contract | สรุป task fields, response/error, mapping และแนวทาง auth | API contract ที่ frontend/backend ใช้ร่วมกัน | 20–40 นาที | เสร็จ |
| 2 | Backend authentication | ปัจจุบันใช้ custom register/login; งานถัดไปเปลี่ยนเป็นตรวจ Entra access token | API ใช้ user จาก Entra token ที่ตรวจแล้ว | 1–2 ชั่วโมง | Custom auth เสร็จ; Entra/MSAL ยังไม่ทำ |
| 3 | Backend ownership และ contract | Owner-scoped CRUD และ response DTO ที่สม่ำเสมอ; ผูก Entra identity กับ DB user | ผู้ใช้เข้าถึงได้เฉพาะ task ของตน | 45–90 นาที | CRUD/ownership เดิมผ่าน; ตรวจซ้ำหลัง Entra |
| 4 | Frontend auth flow | ปัจจุบันใช้ custom login; งานถัดไปใช้ MSAL ขอ API access token | UI เข้าระบบด้วย Entra และเรียก API ด้วย access token | 45–90 นาที | Custom auth เสร็จ; MSAL ยังไม่ทำ |
| 5 | เชื่อม UI กับ CRUD API | โหลด/เพิ่ม/แก้/เปลี่ยนสถานะ/ลบ task ผ่าน API | Reload แล้วยังได้ข้อมูลจาก DB | 1–2 ชั่วโมง | เสร็จ |
| 6 | จัดการ UI features กับ server | Clear Completed ผ่าน API; เอา Undo ที่กู้คืนได้เฉพาะใน browser ออก; รองรับ pagination | การกระทำใน UI สอดคล้องกับข้อมูล server | 30–60 นาที | เสร็จ |
| 7 | ตรวจข้ามชั้น | Build/lint, auth, CRUD, owner isolation และ Azure SQL | Flow ทดสอบผ่าน และล้างข้อมูลทดสอบแล้ว | 1–2 ชั่วโมง | custom auth/CRUD ผ่าน; ต้องทดสอบใหม่หลัง Entra |
| 8 | Deploy VM เดียว | ตั้งค่า Node service, Nginx, secrets, API URL, CORS/HTTPS และตรวจ production | Frontend/API ตอบได้และ Backend ต่อ SQL ได้ | 1–2 ชั่วโมง | Deploy แล้วผ่าน HTTPS; Entra ยังเหลือ |
| 9 | ส่งมอบ/เอกสาร | README, env examples, Postman collection และแผนงาน | ขั้นตอน local และ API มีเอกสาร | 20–40 นาที | เสร็จ; deployment steps รอระบุ resource |

## สรุประยะเวลา

- **เวลาลงมือทำรวมโดยประมาณ:** 7–13 ชั่วโมงทำงานของ AI แบบทำต่อเนื่อง
- **กรณี Azure พร้อมและไม่มีปัญหา credential/network:** ประมาณ 1 วันทำงาน
- **เวลารอภายนอก:** ไม่นับรวม เช่น รอสิทธิ์ Azure, secret, firewall approval หรือการสร้าง resource

เวลานี้เป็นประมาณการจากสภาพ repo ปัจจุบัน ไม่ใช่กำหนดส่งตายตัว งาน auth และ deploy อาจใช้เวลามากขึ้นหากต้องเปลี่ยนรูปแบบ login หรือ Azure environment ยังไม่พร้อม

## เงื่อนไขที่ต้องมีเพื่อไม่ให้งานสะดุด

- เข้าถึง Azure SQL และยืนยันได้ว่าจะใช้ database/schema ชุดใด
- มีสิทธิ์สร้างหรือแก้ App Service/Static Web App และตั้งค่า environment variables
- มีค่า secrets สำหรับ DB และ JWT/session ในช่องทางที่ปลอดภัย ห้ามใส่ secrets ลงใน repo หรือ frontend
- ตัดสินใจว่าจะใช้ email/password ตามตาราง `Users` หรือใช้ identity provider ภายนอก

## ลำดับแนะนำ

ทำ contract และ authentication ก่อน แล้วค่อยเชื่อม UI เพื่อไม่ผูก frontend เข้ากับ `X-User-Id` ที่ปลอมได้ จากนั้นตรวจ flow กับ DB ในเครื่อง/สภาพแวดล้อมทดสอบ แล้ว deploy และตรวจซ้ำบน Azure
