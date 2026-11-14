import { verifyToken } from '../services/authService.js';
import { sendApiError } from '../utils/apiError.js';

export default function authenticate(req, res, next) {
    const token = req.cookies?.['smart-todo.session'];
    const claims = verifyToken(token);
    if (!claims) return sendApiError(res, 401, 'AUTHENTICATION_REQUIRED', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
    req.auth = { userId: claims.sub, email: claims.email, displayName: claims.name };
    next();
}
