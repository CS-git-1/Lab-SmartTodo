import { getTokenLifetimeSeconds, loginUser, registerUser, requestPasswordReset, resetPassword } from '../services/authService.js';
import { logServerError, sendApiError } from '../utils/apiError.js';

const authCookieName = 'smart-todo.session';
const isProduction = process.env.NODE_ENV === 'production';
const authCookieBaseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'strict',
    path: '/',
};
const authCookieOptions = { ...authCookieBaseOptions, maxAge: getTokenLifetimeSeconds() * 1000 };
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
    res.clearCookie(authCookieName, authCookieBaseOptions);
    return res.status(204).end();
}

export async function forgotPassword(req, res) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return validationError(res, 'Please enter a valid email address');
    }
    try {
        await requestPasswordReset(email);
        return res.status(202).json({
            success: true,
            message: 'If an account exists for that email, password reset instructions will be sent.',
        });
    } catch (error) {
        logServerError('Password reset request failed', error);
        if (error.code === 'PASSWORD_RESET_EMAIL_NOT_CONFIGURED') {
            return sendApiError(res, 503, 'PASSWORD_RESET_UNAVAILABLE', 'Password reset email is not configured');
        }
        return sendApiError(res, 500, 'INTERNAL_SERVER_ERROR', 'Unable to process password reset request');
    }
}

export async function completePasswordReset(req, res) {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
        return validationError(res, 'Password reset link is invalid or expired');
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
        return validationError(res, 'Password must be 10–200 characters');
    }
    try {
        const updated = await resetPassword({ token, password });
        if (!updated) return sendApiError(res, 400, 'INVALID_RESET_TOKEN', 'Password reset link is invalid or expired');
        return res.json({ success: true, message: 'Password has been reset' });
    } catch (error) {
        return databaseError(res, error);
    }
}
