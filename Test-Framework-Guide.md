# คู่มือ Test Framework สำหรับ Smart Todo

## Test framework คืออะไร

Test framework คือเครื่องมือสำหรับเขียน จัดกลุ่ม และรัน test cases พร้อมรายงานว่ากรณีใดผ่านหรือไม่ผ่าน

- **Test case** คือสิ่งที่ต้องการตรวจ เช่น เมื่อสร้าง task สำเร็จ API ต้องตอบ HTTP 201
- **Test framework** คือ runner และ assertion tools ที่รันกรณีเหล่านั้นและสรุปผล
- **Mock** คือของจำลองที่ใช้แทน dependency เช่นแทน repository หรือ API เพื่อให้ทดสอบ logic โดยไม่ต่อฐานข้อมูลจริง

การมี build/lint หรือ Postman collection ยังไม่เท่ากับมี unit test suite: build ตรวจว่าผลิตไฟล์ได้, lint ตรวจรูปแบบ/ข้อผิดพลาดบางชนิด, ส่วน test ตรวจพฤติกรรมที่คาดหวัง

## สถานะของโปรเจกต์ตอนนี้

จากไฟล์ที่ตรวจ:

- Frontend มี `npm run build` และ `npm run lint` แต่ยังไม่มี test runner หรือ unit test files
- Backend มี Postman collection และเอกสาร test cases แต่ package ยังไม่มี `npm test` หรือ test framework
- รายการทดสอบใน `backend/test-cases.md` บางส่วนเป็นข้อมูลย้อนหลัง และ security regression plan ปัจจุบันระบุว่า `Not run`

ดังนั้นเอกสารนี้เป็นข้อเสนอการเลือกเครื่องมือและขอบเขต test ยังไม่มีการติดตั้งหรือเพิ่มโค้ดทดสอบ

## ชุดเครื่องมือที่แนะนำ

| เครื่องมือ | ใช้ทำอะไรในโปรเจกต์ |
|---|---|
| **Vitest** | Test runner/assertions สำหรับ JavaScript ทั้ง frontend และ backend แยก config หรือ scripts ตามโฟลเดอร์ |
| **React Testing Library** | Render React components และทดสอบสิ่งที่ผู้ใช้ทำ/เห็น เช่นกรอกฟอร์ม กดบันทึก และเห็น error |
| **MSW หรือ fetch mock** | จำลอง API response สำเร็จ/ล้มเหลวระหว่างทดสอบ frontend โดยไม่เรียก server จริง |
| **Supertest** | ส่ง HTTP request เข้า Express app ระหว่างทดสอบ backend โดยไม่ต้องเปิด server จริง |
| **Playwright** | E2E tests ผ่าน browser ตั้งแต่หน้าเว็บไปถึง API; ควรเพิ่มภายหลังเมื่อ unit/integration tests พร้อม |

ไม่จำเป็นต้องใช้ทุกตัวตั้งแต่แรก แนะนำเริ่มจาก Vitest ทั้งสองฝั่ง, React Testing Library ฝั่ง frontend และ Supertest ฝั่ง backend ส่วน Playwright เป็นขั้นต่อไป

## ความหมายของแต่ละระดับ

### Unit test

ตรวจหน่วยเล็ก ๆ แยกจากระบบอื่น โดย mock dependency ที่ไม่ใช่สิ่งที่กำลังทดสอบ

ตัวอย่าง:

- ตรวจ task validation ว่าปฏิเสธ title ว่างหรือ description เกินเพดาน
- ตรวจ service ว่าเรียก repository ด้วย `userId` จากตัวตนที่ยืนยันแล้ว
- ตรวจ React form ว่าเก็บค่าที่กรอกไว้เมื่อ API ล้มเหลว

### Integration test

ตรวจหลายส่วนทำงานร่วมกัน เช่น route, middleware, controller และ repository หรือการ query กับ test database

ตัวอย่าง:

- ส่ง HTTP request ผ่าน Express ด้วย Supertest แล้วตรวจ status และ response envelope
- ทดสอบ repository/query กับ SQL test database เพื่อยืนยัน SQL parameters, constraints และ transaction จริง

### End-to-end (E2E) test

ทดสอบเส้นทางที่ผู้ใช้ทำผ่าน browser จนถึง backend และฐานข้อมูล

ตัวอย่าง:

- ลงชื่อเข้าใช้ → เพิ่ม task → ทำเครื่องหมายเสร็จ → refresh → ตรวจว่างานยังอยู่ → ลบงาน

E2E ใช้เวลามากกว่าและดูแลยากกว่า unit tests จึงควรครอบคลุม user journey สำคัญ ไม่ต้องจำลองทุก input combination

## ขอบเขตที่แนะนำสำหรับโปรเจกต์นี้

### Backend — Vitest + Supertest

- **Auth service:** สร้าง/ตรวจ token, token ผิดหรือหมดอายุ, hash password และตรวจ password
- **Auth middleware/routes:** ไม่มี cookie, cookie ผิด, logout แล้วเรียก protected route, `/me` เมื่อผ่าน/ไม่ผ่าน auth
- **Task validation/controller:** create/list/read/patch/put/delete ทั้ง success, malformed input, boundary, not found และ database error mapping
- **Authorization:** ผู้ใช้ A ห้าม list/read/update/replace/delete task ของผู้ใช้ B
- **Service:** mock repository และตรวจ business flow/error propagation
- **Repository:** unit tests ควรทดสอบ mapping/การ bind parameters ด้วย mock; ใช้ SQL test database แยกสำหรับยืนยัน behavior ของ query, foreign keys และ transaction

### Frontend — Vitest + React Testing Library

- **API clients:** `credentials: include`, JSON Content-Type, response parsing, error status, abort signal
- **AuthForm:** login/register success, invalid credentials, validation/error state และ busy state
- **TodoForm/TodoItem:** submit/edit/toggle/delete; เปลี่ยน UI หลัง server ยืนยัน; คงค่าฟอร์มและเปิดโหมดแก้ไขเมื่อ request ล้มเหลว
- **App:** loading, empty, load error, retry, session หมดอายุ/sign out, CRUD success/failure, refresh/reload behavior
- **Search/filter:** ค้นหาและกรอง status/priority โดยไม่เปลี่ยนข้อมูลฝั่ง server โดยไม่ตั้งใจ

### E2E — Playwright (ระยะถัดไป)

เริ่มจาก flow หลัก 1–2 เส้นทาง เช่น login และ CRUD task ด้วย test account/database ที่ทิ้งข้อมูลได้ จากนั้นเพิ่มกรณี API error และ reload persistence

## การแยกข้อมูลและสภาพแวดล้อม

- Unit tests ต้องไม่ใช้ Azure SQL จริง และไม่พึ่ง `.env` หรือ credentials ส่วนตัว
- Integration/E2E ที่เขียนข้อมูลต้องใช้ test database หรือข้อมูลทดสอบที่แยกจาก production พร้อม cleanup
- ห้ามให้ test ลบ/แก้ข้อมูลผู้ใช้จริง
- เก็บ secrets ของ test ไว้นอก source control และไม่พิมพ์ token/password ใน logs

## เกณฑ์ว่าชุดทดสอบเริ่มครอบคลุม

1. ทุก API route มีกรณีสำเร็จและกรณีผิดพลาดที่สำคัญ
2. Input validation มีค่าปกติ, ค่าขอบเขต, เกินขอบเขต, ชนิดผิด และฟิลด์ที่ไม่อนุญาต
3. Auth มี missing/invalid/expired session และตรวจการเข้าถึงข้ามเจ้าของข้อมูล
4. Error responses ตรงกับ API contract และไม่เปิดเผย stack, secrets หรือรายละเอียด DB
5. Frontend ไม่แสดง success ก่อน server ยืนยัน และยังให้ผู้ใช้ลองใหม่ได้หลัง error
6. มี CRUD + refresh persistence integration/E2E flow อย่างน้อยหนึ่งชุด
7. ผลทดสอบที่รายงานว่า Pass ต้องมาจากการรันจริง ส่วนกรณีที่ยังไม่รันให้ระบุ `Not run`

## ลำดับติดตั้งที่แนะนำ

1. เพิ่ม Vitest และ scripts สำหรับ backend/frontend
2. เขียน unit tests สำหรับ validation, auth middleware/service และ API client/form
3. เพิ่ม Supertest สำหรับ routes และ error envelopes
4. เตรียม SQL test database แล้วทดสอบ ownership, SQL constraints และ transaction
5. เพิ่ม Playwright สำหรับ user journey สำคัญ
6. เชื่อมคำสั่งตรวจที่เหมาะสมเข้ากับ GitHub Actions เมื่อเริ่มใช้ CI

การเลือก version, ติดตั้ง package และสร้างไฟล์ test จะทำในขั้น implementation แยกต่างหาก
