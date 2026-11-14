import { getTokenLifetimeSeconds, loginUser, registerUser } from '../services/authService.js';
import { logServerError, sendApiError } from '../utils/apiError.js';

const authCookieName = 'smart-todo.session';
const authCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: getTokenLifetimeSeconds() * 1000 };
function sendAuthenticated(res, status, result) {
    res.cookie(authCookieName, result.token, authCookieOptions);
    return res.status(status).json({ success: true, data: { user: result.user } });
}

function validationError(res, message) {
    return sendApiError(res, 400, 'VALIDATION_ERROR', message);
}

function databaseError(res, error) {
    logServerError('Authentication database error', error);
    if ([2601, 2627].includes(error.number)) return sendApiError(res, 409, 'ACCOUNT_ALREADY_EXISTS', 'อีเมลนี้มีบัญชีอยู่แล้ว');
    return sendApiError(res, 500, 'INTERNAL_SERVER_ERROR', 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
}

export async function register(req, res) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const password = req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return validationError(res, 'กรุณาระบุอีเมลที่ถูกต้อง');
    if (displayName.length < 1 || displayName.length > 100) return validationError(res, 'ชื่อที่แสดงต้องมี 1–100 ตัวอักษร');
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) return validationError(res, 'รหัสผ่านต้องมี 10–200 ตัวอักษร');
    try { return sendAuthenticated(res, 201, await registerUser({ email, displayName, password })); }
    catch (error) { return databaseError(res, error); }
}

export async function login(req, res) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    if (!email || typeof password !== 'string') return validationError(res, 'กรุณาระบุอีเมลและรหัสผ่าน');
    try {
        const result = await loginUser({ email, password });
        if (!result) return sendApiError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        return sendAuthenticated(res, 200, result);
    } catch (error) { return databaseError(res, error); }
}

export async function me(req, res) {
    return res.json({ success: true, data: { id: req.auth.userId, email: req.auth.email, displayName: req.auth.displayName } });
}

export async function logout(_req, res) {
    res.clearCookie(authCookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    return res.status(204).end();
}
