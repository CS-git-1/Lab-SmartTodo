# คู่มือทำต่อ: Deploy Smart Todo บน Azure

> Historical details below include the retired Static Web Apps deployment. Current production status is recorded in the final "Current status" section; users should open the Container App URL listed there.

เอกสารนี้บันทึกสถาปัตยกรรม เหตุผลที่เปลี่ยนวิธี host สถานะปัจจุบัน และขั้นตอนที่ต้องทำต่อสำหรับทั้ง frontend และ backend เพื่อกลับมาทำงานภายหลังได้โดยไม่ต้องไล่บทสนทนาเดิม

## สรุปสั้น

- Frontend เป็น React + Vite และรวม build ไว้ใน image เดียวกับ backend บน **Azure Container Apps**.
- Backend เป็น Node.js + Express บน **Azure Container Apps** แทน Azure Web App/App Service ซึ่งติดข้อจำกัด quota ใน subscription.
- ใช้โดเมน Container App เดียวกันสำหรับเว็บและ API เพื่อให้ session cookie เป็น same-origin และไม่ขึ้นกับ third-party cookie policy.
- URL ปัจจุบันสำหรับผู้ใช้: `https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io`.
- Backend ยัง deploy ด้วย local Docker build/push และ `az containerapp update`; GitHub Actions auto-deploy backend ยังไม่ได้ตั้ง.

## ทำไมเปลี่ยนจาก Web App เป็น Container Apps

แผนเดิมคือใช้ Azure Web App/App Service รัน backend แต่ subscription/environment มี quota ไม่พอสำหรับสร้าง Web App ตามแผน จึงเลือก Azure Container Apps ซึ่งรัน backend ใน container ได้ และมี Container Apps environment อยู่แล้วใน subscription.

การเปลี่ยนนี้หมายถึง:

1. สร้าง container image จาก root ของ repository; Dockerfile build frontend และ backend รวมกัน.
2. push image เข้า Azure Container Registry (ACR).
3. ให้ Azure Container Apps รัน image และเปิด HTTPS ingress.
4. ตั้งค่า database, auth secret, CORS และพอร์ตใน Container App.
5. เปิด Container App domain; frontend เรียก API ด้วย relative path `/api`.

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
| Legacy Frontend Static Web App (not current production) | `camp-azure-webapp-todo` |
| Legacy Static Web App domain (not current production) | `https://lemon-pond-06b37d700.4.azurestaticapps.net` |
| GitHub repository/branch | `https://github.com/CS-git-1/Lab-SmartTodo`, `main` |
| ACR | `caaff190caa2acr.azurecr.io` |

ชื่อ resource เหล่านี้มาจาก Azure subscription ที่ล็อกอินอยู่ ถ้า subscription/resource เปลี่ยน ให้ตรวจใหม่ด้วย `az account show`, `az containerapp env list`, `az containerapp list`, และ `az staticwebapp list` ก่อนใช้คำสั่ง deploy.

## สถานะที่ยืนยันแล้ว

### GitHub

- `main` ล่าสุดที่ยืนยันก่อนเอกสารอัปเดตนี้: commit `fad25e6` (`Connect frontend to Azure API`).
- GitHub มีโฟลเดอร์ `backend/`, source, schema และ migration.
- GitHub มี `backend/Dockerfile`, `.dockerignore`, `frontend/.env.production` และ handoff นี้.
- Legacy workflow `.github/workflows/azure-static-web-apps-lemon-pond-06b37d700.yml` still deploys the retired Static Web App; it does not deploy the current Container App frontend.
- GitHub Actions run `44280600221` สำหรับ commit `fad25e6` จบด้วย success และ deploy frontend แล้ว.

### Azure Container Apps

- Container App `app-todo-api-01` มี ingress เป็น external.
- Revision ปัจจุบัน `app-todo-api-01--0000007` ใช้ image `caaff190caa2acr.azurecr.io/smart-todo-api:session-refresh-v1`; target port `3000`.
- Production cookie ใช้ `SameSite=Lax; Secure`; `CORS_ORIGIN` ตั้งเป็น Container App origin และ unsafe requests ต้องมี Origin ตรงกับ origin เดียวกัน.
- `GET https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io/health` ตอบ `200 {"success":true}`.
- Logs ยืนยัน `Smart Todo API listening on http://0.0.0.0:3000`.
- Earlier CORS preflight checks were for the retired Static Web App; production now uses same-origin requests.
- Login request ด้วยบัญชีสมมติที่ไม่มีอยู่ตอบ `401`; API เชื่อม Azure SQL ได้.
- ACR pull credential, DB password และ auth signing secret ถูกตั้งเป็น Azure Container App secrets. อย่าดึงหรือพิมพ์ค่า secret.

### Frontend

- The retired Static Web App remains linked to GitHub `main`; do not use its URL for production login.
- Vite settings are build-time values; the active Container App image builds with `VITE_API_BASE_URL=/api`.
- Production build config `frontend/.env.production` ใช้ `VITE_API_BASE_URL=/api`.
- Previous Static Web App checks are historical; current production checks target the Container App URL above.
- Earlier CORS preflight checks were for the retired Static Web App; production now uses same-origin requests.

### ข้อผิดพลาด/สิ่งที่ลองแล้ว

1. `az containerapp up --source backend` ครั้งแรกหยุดด้วย `MissingSubscriptionRegistration` สำหรับ `Microsoft.ContainerRegistry`; provider ถูก register สำเร็จภายหลัง.
2. ครั้งถัดไป Azure สร้าง ACR แต่ remote build หยุดด้วย `TasksOperationsNotAllowed`; subscription policy ปิด ACR Tasks.
3. Docker Desktop engine ยังไม่ตอบในครั้งแรก; หลังเริ่ม Docker Desktop แล้ว `docker info` ตอบ version `29.6.2`.
4. Local `docker build --platform linux/amd64` สำเร็จ, `az acr login` สำเร็จ และ push image สำเร็จ.
5. Container App pull image ไม่ได้ในครั้งแรก (`UNAUTHORIZED`); เพิ่ม ACR registry credentials แล้ว deploy revision ใหม่สำเร็จ.
6. Health, revision, logs, CORS preflight และการเชื่อม DB ผ่านตามผลด้านบน.

## สิ่งสำคัญก่อนเปิด frontend ให้ใช้ API

### 1. Cookie ข้ามโดเมน

แก้แล้วโดยรวม frontend กับ API ใน Container App เดียวกัน: browser เปิดและเรียก `/api` ภายใต้ origin เดียวกัน, cookie ใช้ `SameSite=Lax; Secure`, และ backend ตรวจ Origin ให้ตรงกับ Container App URL. ผู้ใช้ยืนยันแล้วว่า login และกด F5 แล้วยังอยู่ในหน้า task.

### 2. Database schema

Backend ต้องใช้ Azure SQL `sqldb-smarttodo.database.windows.net`, database `free-sql-db-smart-todo`, user `smarttodo-admin@sqldb-smarttodo` ตาม local config ที่อ่านใน session ก่อนหน้า. ห้ามเขียน DB password ลงเอกสาร, Git, frontend หรือ terminal output.

ก่อน deploy ตรวจว่า schema ที่ต้องใช้มีอยู่แล้ว. สำหรับ password reset ในฐานข้อมูลเดิมต้อง apply `backend/migrations/001_password_reset_tokens.sql`; สำหรับฐานข้อมูลใหม่ใช้ `backend/schema.sql`. Migration schema เป็น data/database change ให้ทำอย่างระมัดระวังกับ database ที่ถูกต้อง.

เมื่อ backend รันบน Azure Container Apps แล้ว Azure SQL ไม่ควรอนุญาตเฉพาะ IP ของ notebook อีกต่อไป; ต้องอนุญาต egress/network path ของ Container Apps ตามวิธีที่เหมาะสมกับ Azure SQL firewall/network configuration.

### 3. Secrets/config ของ Container App

ค่าที่ต้องมีใน runtime (secret values ต้องเก็บเป็น Container Apps secrets):

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CORS_ORIGIN=https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io` (origin ของเว็บและ API ปัจจุบัน)
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

1. แก้ frontend ใน `frontend/src/`; `frontend/.env.production` กำหนด API เป็น `/api`.
2. Build จาก repository root ด้วย Dockerfile ที่ build frontend แล้วรวมไฟล์ `dist` ใน backend image; push image ไป ACR แล้ว deploy ด้วย `az containerapp update`.
3. เปิด Container App URL เดียวกัน, login และ refresh; ผู้ใช้ยืนยันแล้วว่า refresh ไม่หลุดไปหน้า login. ควรตรวจ task CRUD เพิ่มเมื่อมีการเปลี่ยนแปลง API.

## Checklist รับงาน

- [x] Backend image ใน Container App เป็น image Smart Todo ไม่ใช่ quickstart.
- [x] Container App revision `app-todo-api-01--0000007` Ready; target port ตรง `3000`.
- [x] `/health` ตอบ `200` และ `{"success":true}`.
- [x] Log แสดง Smart Todo API start และเรียก `/health` ได้.
- [x] Login test ด้วยข้อมูลสมมติตอบ `401`, ยืนยันว่า API เชื่อมฐานข้อมูลได้.
- [x] Frontend build bundle ใช้ same-origin API path `/api` ไม่ใช่ localhost หรือ cross-site URL.
- [x] CORS preflight ผ่าน และ API ปฏิเสธ unsafe request ที่ไม่มี Origin.
- [x] Login และ refresh แล้วยังคงอยู่ในหน้า task (ผู้ใช้ยืนยัน).
- [ ] ทดสอบ task CRUD หลัง deploy image ที่รวม frontend ล่าสุด.
- [x] Container App เสิร์ฟ frontend และ backend จาก origin เดียวกัน; backend auto-deploy workflow ยังไม่ได้ตั้ง.

## คำสั่งตรวจเร็ว

```powershell
az account show --query '{subscription:name, user:user.name}' -o table
az containerapp show -n app-todo-api-01 -g rg-camp-azure-01 --query '{revision:properties.latestRevisionName, ready:properties.latestReadyRevisionName, image:properties.template.containers[0].image, fqdn:properties.configuration.ingress.fqdn, port:properties.configuration.ingress.targetPort}' -o json
Invoke-WebRequest https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io/health
az containerapp logs show -n app-todo-api-01 -g rg-camp-azure-01 --type console --tail 50
```

อย่าพิมพ์หรือแนบ `.env`, DB password, cookies, JWT/session tokens หรือ Azure credentials ใน issue/แชต/log ที่แชร์ได้.
# สถานะปัจจุบัน (อัปเดต 2026-11-18)

- URL ที่ให้ผู้ใช้เปิด: `https://app-todo-api-01.orangeplant-6ae0cf94.southeastasia.azurecontainerapps.io`
- Container App revision `app-todo-api-01--0000007` รัน image `caaff190caa2acr.azurecr.io/smart-todo-api:session-refresh-v1` และเสิร์ฟทั้ง frontend กับ API.
- Frontend เรียก API ด้วย relative path `/api`; session cookie เป็น `SameSite=Lax; Secure` จึงอยู่ same-origin และไม่พึ่ง third-party cookies.
- การ build ต้องใช้ repository root เป็น Docker context: `docker build --platform linux/amd64 -t <acr>/smart-todo-api:<tag> -f backend/Dockerfile .`
- Vite settings are build-time values; the active Container App image builds with `VITE_API_BASE_URL=/api`.
- Login และ F5 ผ่านตามที่ผู้ใช้ยืนยัน; ตรวจเมื่อ deploy: `/` ต้องตอบ `text/html`, `/health` และ `/api/health` ตอบ `200`.
