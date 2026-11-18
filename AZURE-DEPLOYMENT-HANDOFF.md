# คู่มือทำต่อ: Deploy Smart Todo บน Azure

เอกสารนี้บันทึกสถาปัตยกรรม เหตุผลที่เปลี่ยนวิธี host สถานะปัจจุบัน และขั้นตอนที่ต้องทำต่อสำหรับทั้ง frontend และ backend เพื่อกลับมาทำงานภายหลังได้โดยไม่ต้องไล่บทสนทนาเดิม

## สรุปสั้น

- Frontend เป็น React + Vite และ deploy อยู่บน **Azure Static Web Apps** จาก GitHub repository `CS-git-1/Lab-SmartTodo` branch `main`.
- Backend เป็น Node.js + Express และต้องรันเป็น process/container ที่เปิดพอร์ต HTTP ได้ จึงวางแผนใช้ **Azure Container Apps** แทน Azure Web App/App Service ที่ติดข้อจำกัด quota ใน subscription.
- Backend deploy สำเร็จบน Azure Container Apps จาก local Docker image tag `crosssite-cookie-v1`; GitHub auto-deploy สำหรับ backend ยังไม่ได้ตั้ง.
- Frontend และ backend ต้องเชื่อมกันผ่าน HTTPS; frontend ต้อง build โดยกำหนด `VITE_API_BASE_URL` เป็น URL ของ backend.
- Backend deploy แล้ว แต่ยังไม่มี GitHub Actions workflow สำหรับ deploy backend อัตโนมัติ.

## ทำไมเปลี่ยนจาก Web App เป็น Container Apps

แผนเดิมคือใช้ Azure Web App/App Service รัน backend แต่ subscription/environment มี quota ไม่พอสำหรับสร้าง Web App ตามแผน จึงเลือก Azure Container Apps ซึ่งรัน backend ใน container ได้ และมี Container Apps environment อยู่แล้วใน subscription.

การเปลี่ยนนี้หมายถึง:

1. สร้าง container image ของ backend จาก `backend/`.
2. push image เข้า Azure Container Registry (ACR).
3. ให้ Azure Container Apps รัน image และเปิด HTTPS ingress.
4. ตั้งค่า database, auth secret, CORS และพอร์ตใน Container App.
5. rebuild/deploy frontend โดยชี้ API ไปยัง Container App.

`az containerapp up --source ...` สร้าง image ฝั่ง Azure และส่ง build ไป ACR Tasks; ไม่ได้เรียก Docker Desktop engine ในเครื่อง. Subscription ปฏิเสธ ACR Tasks (`TasksOperationsNotAllowed`) จึงใช้ local Docker build + push เข้า ACR แล้ว deploy image ด้วย `az containerapp update` แทน.

## Azure resources และ URL ที่พบ

ตรวจผ่าน Azure CLI เมื่อ 2026-11-18:

| Resource | ค่า |
|---|---|
| Resource group | `rg-camp-azure-01` |
| Region | `Southeast Asia` |
| Container Apps environment | `managedEnvironment-rgcampazure01-950e` |
| Backend Container App | `app-todo-api-01` |
| Backend default domain | `https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io` |
| Frontend Static Web App | `camp-azure-webapp-todo` |
| Frontend domain | `https://lemon-pond-06b37d700.4.azurestaticapps.net` |
| GitHub repository/branch | `https://github.com/CS-git-1/Lab-SmartTodo`, `main` |
| ACR | `caaff190caa2acr.azurecr.io` |

ชื่อ resource เหล่านี้มาจาก Azure subscription ที่ล็อกอินอยู่ ถ้า subscription/resource เปลี่ยน ให้ตรวจใหม่ด้วย `az account show`, `az containerapp env list`, `az containerapp list`, และ `az staticwebapp list` ก่อนใช้คำสั่ง deploy.

## สถานะที่ยืนยันแล้ว

### GitHub

- `main` ล่าสุดที่ยืนยัน: commit `3a81144` (`Add authentication and password recovery`).
- GitHub มีโฟลเดอร์ `backend/`, source, schema และ migration.
- GitHub ยังไม่มี `backend/Dockerfile`, `.dockerignore` หรือ workflow สำหรับ deploy backend. ไฟล์เหล่านี้อยู่ใน working tree ในเครื่องเท่านั้น ณ เวลาทำเอกสาร.
- Workflow ปัจจุบัน `.github/workflows/azure-static-web-apps-lemon-pond-06b37d700.yml` deploy **frontend อย่างเดียว** โดย `app_location: frontend`, `output_location: dist`.

### Azure Container Apps

- Container App `app-todo-api-01` มี ingress เป็น external.
- Deploy image `caaff190caa2acr.azurecr.io/smart-todo-api:crosssite-cookie-v1` สำเร็จ; revision ล่าสุด `app-todo-api-01--0000002` มีสถานะ Ready และ target port `3000`.
- Production cookie ใช้ `SameSite=None; Secure`; unsafe requests ต้องมี `Origin` ตรงกับ frontend origin ที่อนุญาต.
- `GET https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io/health` ตอบ `200 {"success":true}`.
- Logs ยืนยัน `Smart Todo API listening on http://0.0.0.0:3000`.
- CORS preflight จาก frontend origin ตอบ `204` พร้อม allow-origin และ credentials.
- Login request ด้วยบัญชีสมมติที่ไม่มีอยู่ตอบ `401`; API เชื่อม Azure SQL ได้.
- ACR pull credential, DB password และ auth signing secret ถูกตั้งเป็น Azure Container App secrets. อย่าดึงหรือพิมพ์ค่า secret.

### Frontend

- Static Web App ผูกกับ GitHub `main`.
- Static Web App app settings ยังว่าง; Vite ต้องรับ `VITE_API_BASE_URL` ตอน build (การตั้ง Vite env เป็น app runtime setting อย่างเดียวไม่เปลี่ยน bundle ที่ build ไปแล้ว).
- Production build config `frontend/.env.production` ชี้ไปยัง Container App HTTPS API URL; ไฟล์นี้ต้องอยู่ใน GitHub เพื่อให้ Azure Static Web Apps build bundle ใช้ API production.

### ข้อผิดพลาด/สิ่งที่ลองแล้ว

1. `az containerapp up --source backend` ครั้งแรกหยุดด้วย `MissingSubscriptionRegistration` สำหรับ `Microsoft.ContainerRegistry`; provider ถูก register สำเร็จภายหลัง.
2. ครั้งถัดไป Azure สร้าง ACR แต่ remote build หยุดด้วย `TasksOperationsNotAllowed`; subscription policy ปิด ACR Tasks.
3. Docker Desktop engine ยังไม่ตอบในครั้งแรก; หลังเริ่ม Docker Desktop แล้ว `docker info` ตอบ version `29.6.2`.
4. Local `docker build --platform linux/amd64` สำเร็จ, `az acr login` สำเร็จ และ push image สำเร็จ.
5. Container App pull image ไม่ได้ในครั้งแรก (`UNAUTHORIZED`); เพิ่ม ACR registry credentials แล้ว deploy revision ใหม่สำเร็จ.
6. Health, revision, logs, CORS preflight และการเชื่อม DB ผ่านตามผลด้านบน.

## สิ่งสำคัญก่อนเปิด frontend ให้ใช้ API

### 1. Cookie ข้ามโดเมน

Frontend ใช้ `https://...azurestaticapps.net`; API ใช้ `https://...azurecontainerapps.io` ซึ่งเป็นคนละ site. Backend revision `crosssite-cookie-v1` ตั้ง production session cookie เป็น `SameSite=None; Secure` และตรวจ `Origin` ของ unsafe requests ให้ตรงกับ frontend origin. Browser อาจยังบล็อก third-party cookies ตามการตั้งค่าความเป็นส่วนตัว จึงต้องตรวจ login จริงใน browser.

ทางเลือกที่ควรเลือกก่อนเปิดใช้งานจริง:

- **แนะนำ:** ใช้ custom domain ภายใต้โดเมนเดียวกัน เช่น `todo.example.com` กับ `api.example.com` แล้วออกแบบ cookie/domain ให้เหมาะสม; หรือ proxy `/api` ผ่าน frontend host.
- อีกทางคือ cross-site cookie `SameSite=None; Secure` และเพิ่ม/ตรวจ CSRF protection อย่างชัดเจน พร้อมทดสอบ browser policy เรื่อง third-party cookies. CORS กับ `Origin` check ที่มีอยู่เป็นชั้นป้องกัน แต่ต้องทบทวน flow และทดสอบจริงก่อนใช้.

อย่าเพิ่งถือว่า login ผ่านเพียงเพราะ API ตอบ HTTP. ต้องตรวจว่า browser เก็บ cookie แล้วส่งกลับใน request ต่อไป.

### 2. Database schema

Backend ต้องใช้ Azure SQL `sqldb-smarttodo.database.windows.net`, database `free-sql-db-smart-todo`, user `smarttodo-admin@sqldb-smarttodo` ตาม local config ที่อ่านใน session ก่อนหน้า. ห้ามเขียน DB password ลงเอกสาร, Git, frontend หรือ terminal output.

ก่อน deploy ตรวจว่า schema ที่ต้องใช้มีอยู่แล้ว. สำหรับ password reset ในฐานข้อมูลเดิมต้อง apply `backend/migrations/001_password_reset_tokens.sql`; สำหรับฐานข้อมูลใหม่ใช้ `backend/schema.sql`. Migration schema เป็น data/database change ให้ทำอย่างระมัดระวังกับ database ที่ถูกต้อง.

เมื่อ backend รันบน Azure Container Apps แล้ว Azure SQL ไม่ควรอนุญาตเฉพาะ IP ของ notebook อีกต่อไป; ต้องอนุญาต egress/network path ของ Container Apps ตามวิธีที่เหมาะสมกับ Azure SQL firewall/network configuration.

### 3. Secrets/config ของ Container App

ค่าที่ต้องมีใน runtime (secret values ต้องเก็บเป็น Container Apps secrets):

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CORS_ORIGIN=https://lemon-pond-06b37d700.4.azurestaticapps.net` (ต้องตรงกับ frontend origin จริง)
- `DB_SERVER`, `DB_PORT=1433`, `DB_NAME`, `DB_USER`
- `DB_PASSWORD` เป็น Container App secret reference
- `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false`
- `AUTH_TOKEN_SECRET` เป็น Container App secret อย่างน้อย 32 ตัวอักษร
- `FRONTEND_URL` ใช้ frontend origin สำหรับ reset links
- SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) ถ้าจะเปิด password reset email

อย่าสร้าง auth signing secret ใหม่ทับของเดิมโดยไม่ตั้งใจ: ถ้ามี session cookie ที่ยังใช้งานอยู่ การเปลี่ยน signing secret จะทำให้ session เดิมใช้ไม่ได้.

## ขั้นตอนทำต่อ: Deploy backend

ไฟล์ local ที่เตรียมไว้:

- `backend/Dockerfile` — Node 22 Alpine, `npm ci --omit=dev`, start API ที่ port 3000.
- `backend/.dockerignore` — กัน `.env`/node_modules เข้าสู่ image build context.
- `backend/src/server.js` — local working-tree change ให้ default host `0.0.0.0`; ตรวจว่า commit ล่าสุดยังมีการแก้ไขนี้ก่อน deploy.

### วิธี A: Local Docker build/push (ข้าม ACR Tasks)

1. เปิด Docker Desktop และรอให้ `docker info --format '{{.ServerVersion}}'` แสดง server version. `az containerapp up --source` ไม่ได้ใช้ local engine; มัน build image ใน Azure ผ่าน ACR Tasks.
2. ตรวจสิทธิ์ ACR: `az acr login --name caaff190caa2acr`.
3. Build image จาก root repository:

   ```powershell
   docker build -t caaff190caa2acr.azurecr.io/smart-todo-api:latest .\backend
   docker push caaff190caa2acr.azurecr.io/smart-todo-api:latest
   ```

4. ผูก ACR pull credentials ให้ Container App ด้วย `az containerapp registry set` ถ้า registry เป็น private.
5. Deploy image ไป `app-todo-api-01` ด้วย `az containerapp update --image ...` และตั้ง ingress target port 3000.
6. ตั้ง runtime env vars/secrets ด้วย Azure Container Apps. อย่าใส่ secret literal ในคำสั่งที่แชร์หรือบันทึกในไฟล์.
7. ตรวจ revision/image/port, `/health`, และ logs. วิธี local Docker นี้ใช้ deploy API รุ่นแรกสำเร็จแล้ว.

ถ้า `az acr login` หรือ `docker push` ถูกปฏิเสธ ต้องขอ registry permission/role ที่เหมาะสมกับ subscription; การเปิด Docker ไม่แก้ ACR authorization policy.

### วิธี B: GitHub Actions deploy อัตโนมัติ

1. Commit/push Dockerfile และ `.dockerignore`.
2. เพิ่ม workflow ที่ checkout repo, login Azure ด้วย GitHub OIDC (แนะนำ) หรือ service principal, ใช้ `docker/build-push-action` สร้าง/push image เข้า ACR แล้วใช้ Azure CLI/Container Apps deploy image ใหม่.
3. ตั้ง GitHub repository secrets/variables สำหรับ Azure authentication, ACR, app/resource group/environment; ตั้ง DB password และ auth signing key เป็น Azure Container App secrets ไม่ส่งผ่าน build args.
4. ให้ workflow ใช้ branch `main` และ image tag จาก commit SHA เพื่อให้ย้อน revision ได้.
5. ตรวจ workflow run ใน GitHub Actions และ Container App revision/logs.

การ deploy จาก GitHub ต้องมี credentials/identity และ permissions ที่ถูกต้อง. อย่าใส่ service principal secret หรือ DB credentials ลง YAML.

## ขั้นตอนทำต่อ: Frontend

1. เลือก API origin/custom domain/proxy หลังแก้ cross-site cookie plan.
2. ตั้ง `VITE_API_BASE_URL=https://<api-domain>/api` **ตอน build**. สำหรับ workflow ปัจจุบัน ให้ส่ง env var เข้า Azure Static Web Apps build job; app settings หลัง build ไม่เปลี่ยน bundle.
3. ตรวจว่า CORS `CORS_ORIGIN` เป็น origin ของ frontend แบบ exact (protocol + host, ไม่มี path/trailing slash).
4. Push workflow/config change ไป `main`; รอ Azure Static Web Apps GitHub Actions deployment successful.
5. เปิด frontend URL, DevTools Network/Application: ตรวจ request HTTPS ไป `/api/auth/login`, response `Set-Cookie`, cookie ถูกเก็บและส่งใน `GET /api/auth/me`.
6. ทดสอบ login, refresh, list/create/update/delete task; ยืนยัน database ownership behavior.

## Checklist รับงาน

- [x] Backend image ใน Container App เป็น image Smart Todo ไม่ใช่ quickstart.
- [x] Container App revision `app-todo-api-01--0000002` Ready; target port ตรง `3000`.
- [x] `/health` ตอบ `200` และ `{"success":true}`.
- [x] Log แสดง Smart Todo API start และเรียก `/health` ได้.
- [x] Login test ด้วยข้อมูลสมมติตอบ `401`, ยืนยันว่า API เชื่อมฐานข้อมูลได้.
- [ ] Frontend build bundle จาก GitHub ใช้ `https://<api-domain>/api`, ไม่ใช่ localhost.
- [ ] Browser CORS ผ่าน และ cookie auth ทำงานข้าม origin/site ตาม architecture ที่เลือก.
- [ ] Login + refresh + `/api/auth/me` + task CRUD ผ่าน.
- [ ] GitHub Actions frontend/backend deployment สำเร็จ และไฟล์ secrets ไม่อยู่ใน repo.

## คำสั่งตรวจเร็ว

```powershell
az account show --query '{subscription:name, user:user.name}' -o table
az containerapp show -n app-todo-api-01 -g rg-camp-azure-01 --query '{revision:properties.latestRevisionName, ready:properties.latestReadyRevisionName, image:properties.template.containers[0].image, fqdn:properties.configuration.ingress.fqdn, port:properties.configuration.ingress.targetPort}' -o json
Invoke-WebRequest https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io/health
az containerapp logs show -n app-todo-api-01 -g rg-camp-azure-01 --type console --tail 50
```

อย่าพิมพ์หรือแนบ `.env`, DB password, cookies, JWT/session tokens หรือ Azure credentials ใน issue/แชต/log ที่แชร์ได้.
