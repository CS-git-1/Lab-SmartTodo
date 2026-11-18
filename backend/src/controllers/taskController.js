import { createTask, deleteTask, getTask, listTasks, updateTask } from '../services/taskService.js';
import { logServerError, sendApiError } from '../utils/apiError.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(['todo', 'in_progress', 'done', 'cancelled']);
const editable = new Set(['title', 'description', 'projectId', 'status', 'priority', 'startAt', 'dueAt', 'estimatedMinutes', 'sortOrder']);
const creatable = new Set(['title', 'description', 'projectId', 'status', 'priority', 'startAt', 'dueAt', 'estimatedMinutes', 'sortOrder']);
const maxSearchLength = 100;
const maxDescriptionLength = 2000;
const maxEstimatedMinutes = 525600;
const minSortOrder = -1000000;
const maxSortOrder = 1000000;
const maxTitleLength = 300;
const maxPage = 10000;

const titleMessage = 'กรุณาระบุชื่องาน 1–300 ตัวอักษร';
const listQueryFields = new Set(['page', 'limit', 'status', 'priority', 'projectId', 'q']);

function isValidIsoDateTime(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || Number.isNaN(Date.parse(value))) return false;
    const [, year, month, day, hour, minute, second] = match.map((part) => Number(part));
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        && hour <= 23 && minute <= 59 && second <= 59;
}

function validationError(res, message) {
    return sendApiError(res, 400, 'VALIDATION_ERROR', message);
}

function validate(fields, requireTitle = false) {
    if (requireTitle && (typeof fields.title !== 'string' || !fields.title.trim())) return titleMessage;
    if (fields.title !== undefined && (typeof fields.title !== 'string' || !fields.title.trim() || fields.title.trim().length > maxTitleLength)) return titleMessage;
    if (fields.description !== undefined && fields.description !== null && (typeof fields.description !== 'string' || fields.description.length > maxDescriptionLength)) return 'รายละเอียดงานต้องเป็นข้อความและยาวไม่เกิน 2,000 ตัวอักษร';
    if (fields.projectId !== undefined && fields.projectId !== null && !uuidPattern.test(fields.projectId)) return 'รหัสโครงการไม่ถูกต้อง';
    if (fields.status !== undefined && !statuses.has(fields.status)) return 'สถานะงานไม่ถูกต้อง';
    if (fields.priority !== undefined && (!Number.isInteger(fields.priority) || fields.priority < 1 || fields.priority > 4)) return 'ระดับความสำคัญต้องเป็นตัวเลข 1–4';
    for (const key of ['startAt', 'dueAt']) {
        if (fields[key] === undefined || fields[key] === null) continue;
        const value = fields[key];
        if (!isValidIsoDateTime(value)) return 'วันที่ต้องเป็นวันเวลา ISO 8601 ที่ถูกต้อง';
    }
    if (fields.estimatedMinutes !== undefined && fields.estimatedMinutes !== null && (!Number.isInteger(fields.estimatedMinutes) || fields.estimatedMinutes < 1 || fields.estimatedMinutes > maxEstimatedMinutes)) return 'เวลาประมาณการต้องอยู่ระหว่าง 1 ถึง 525,600 นาที';
    if (fields.sortOrder !== undefined && (!Number.isInteger(fields.sortOrder) || fields.sortOrder < minSortOrder || fields.sortOrder > maxSortOrder)) return 'ลำดับงานต้องอยู่ระหว่าง -1,000,000 ถึง 1,000,000';
    return null;
}

function databaseError(res, error) {
    logServerError('Task API database error', error);
    const status = [2601, 2627].includes(error.number) ? 409 : [547, 515].includes(error.number) ? 422 : 500;
    const code = status === 409 ? 'TASK_CONFLICT' : status === 422 ? 'TASK_CONSTRAINT_ERROR' : 'INTERNAL_SERVER_ERROR';
    const message = status === 409 ? 'ข้อมูลงานซ้ำกับรายการที่มีอยู่แล้ว'
        : status === 422 ? 'ข้อมูลชื่องานหรือรายการที่เกี่ยวข้องไม่ถูกต้อง'
            : 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง';
    return sendApiError(res, status, code, message);
}

export async function list(req, res) {
    const userId = req.auth.userId;
    if (Object.keys(req.query).some((key) => !listQueryFields.has(key))) return validationError(res, 'คำขอมีพารามิเตอร์ที่ไม่รองรับ');
    const rawPage = req.query.page ?? '1';
    const rawLimit = req.query.limit ?? '20';
    if (typeof rawPage !== 'string' || !/^\d+$/.test(rawPage)
        || typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) {
        return validationError(res, 'เลขหน้าและจำนวนรายการต้องเป็นจำนวนเต็มบวก');
    }
    const page = Number(rawPage), limit = Number(rawLimit);
    if (req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > maxSearchLength)) {
        return validationError(res, 'คำค้นหาต้องมีความยาวไม่เกิน 100 ตัวอักษร');
    }
    if (!Number.isSafeInteger(page) || page < 1 || page > maxPage
        || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return validationError(res, 'เลขหน้าไม่เกิน 10,000 และจำนวนรายการต่อหน้าไม่เกิน 100');
    if (req.query.status !== undefined && (typeof req.query.status !== 'string' || !statuses.has(req.query.status))) return validationError(res, 'สถานะงานไม่ถูกต้อง');
    if (req.query.priority !== undefined && (typeof req.query.priority !== 'string' || !/^[1-4]$/.test(req.query.priority))) return validationError(res, 'ระดับความสำคัญต้องเป็นตัวเลข 1–4');
    if (req.query.projectId !== undefined && (typeof req.query.projectId !== 'string' || !uuidPattern.test(req.query.projectId))) return validationError(res, 'รหัสโครงการไม่ถูกต้อง');
    try {
        const result = await listTasks({ userId, status: req.query.status, priority: req.query.priority ? Number(req.query.priority) : undefined, projectId: req.query.projectId, q: req.query.q, page, limit });
        res.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
    } catch (error) { return databaseError(res, error); }
}

export async function read(req, res) {
    const userId = req.auth.userId;
    if (!uuidPattern.test(req.params.taskId)) return validationError(res, 'รหัสงานไม่ถูกต้อง');
    try { const task = await getTask(userId, req.params.taskId); return task ? res.json({ success: true, data: task }) : sendApiError(res, 404, 'TASK_NOT_FOUND', 'ไม่พบงานที่ต้องการ'); }
    catch (error) { return databaseError(res, error); }
}

export async function create(req, res) {
    const userId = req.auth.userId;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return validationError(res, 'ข้อมูลคำขอต้องเป็น object และมีชื่องาน');
    }
    if (Object.keys(req.body).some((key) => !creatable.has(key))) {
        return validationError(res, 'คำขอมีฟิลด์ที่ไม่อนุญาต');
    }
    if (typeof req.body.title !== 'string') return validationError(res, titleMessage);
    const title = req.body.title.trim();
    if (title.length < 1 || title.length > maxTitleLength) {
        return validationError(res, titleMessage);
    }
    const fields = Object.fromEntries(Object.entries(req.body).filter(([key]) => creatable.has(key)));
    const error = validate(fields, true);
    if (error) return validationError(res, error);
    fields.title = title;
    fields.status ??= 'todo';
    fields.priority ??= 2;
    for (const key of ['startAt', 'dueAt']) if (fields[key]) fields[key] = new Date(fields[key]);
    try { res.status(201).json({ success: true, data: await createTask({ userId, ...fields }) }); }
    catch (err) { databaseError(res, err); }
}

export async function update(req, res) {
    const userId = req.auth.userId;
    const body = req.body ?? {};
    if (!uuidPattern.test(req.params.taskId)) return validationError(res, 'รหัสงานไม่ถูกต้อง');
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return validationError(res, 'ข้อมูลคำขอต้องเป็น object');
    }
    if (Object.keys(body).some((key) => !editable.has(key))) {
        return validationError(res, 'คำขอมีฟิลด์ที่ไม่อนุญาต');
    }
    const changes = Object.fromEntries(Object.entries(body).filter(([key]) => editable.has(key)));
    if (!Object.keys(changes).length) return validationError(res, 'กรุณาระบุข้อมูลที่ต้องการแก้ไข');
    const error = validate(changes); if (error) return validationError(res, error);
    if (changes.title) changes.title = changes.title.trim();
    for (const key of ['startAt', 'dueAt']) if (changes[key]) changes[key] = new Date(changes[key]);
    try { const task = await updateTask(userId, req.params.taskId, changes); return task ? res.json({ success: true, data: task }) : sendApiError(res, 404, 'TASK_NOT_FOUND', 'ไม่พบงานที่ต้องการ'); }
    catch (err) { databaseError(res, err); }
}

export async function replace(req, res) {
    const userId = req.auth.userId;
    const body = req.body ?? {};
    if (!uuidPattern.test(req.params.taskId)) return validationError(res, 'รหัสงานไม่ถูกต้อง');
    if (!body || typeof body !== 'object' || Array.isArray(body)) return validationError(res, 'ข้อมูลคำขอต้องเป็น object');
    if (typeof body.title !== 'string') return validationError(res, titleMessage);
    const title = body.title.trim();
    if (title.length < 1 || title.length > maxTitleLength) return validationError(res, titleMessage);
    if (typeof body.isCompleted !== 'boolean') return validationError(res, 'สถานะเสร็จงานต้องเป็น true หรือ false');
    const replaceable = new Set([...editable, 'isCompleted']);
    if (Object.keys(body).some((key) => !replaceable.has(key))) {
        return validationError(res, 'คำขอมีฟิลด์ที่ไม่อนุญาต');
    }
    const changes = Object.fromEntries(Object.entries(body).filter(([key]) => editable.has(key)));
    changes.title = title;
    const error = validate(changes, true);
    if (error) return validationError(res, error);
    if (changes.description === '') changes.description = null;
    for (const key of ['startAt', 'dueAt']) if (changes[key]) changes[key] = new Date(changes[key]);
    changes.status = body.isCompleted ? 'done' : 'todo';
    try {
        const task = await updateTask(userId, req.params.taskId, changes);
        return task ? res.json({ success: true, data: task }) : sendApiError(res, 404, 'TASK_NOT_FOUND', 'ไม่พบงานที่ต้องการ');
    } catch (error) { return databaseError(res, error); }
}

export async function remove(req, res) {
    const userId = req.auth.userId;
    if (!uuidPattern.test(req.params.taskId)) return validationError(res, 'รหัสงานไม่ถูกต้อง');
    try {
        const deleted = await deleteTask(userId, req.params.taskId);
        return deleted ? res.status(204).end() : sendApiError(res, 404, 'TASK_NOT_FOUND', 'ไม่พบงานที่ต้องการ');
    }
    catch (error) { databaseError(res, error); }
}
