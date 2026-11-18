import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import nodemailer from 'nodemailer';
import { createUser, findUserByEmail, createPasswordResetToken, deletePasswordResetToken, hasValidPasswordResetToken, consumePasswordResetToken } from '../repositories/authRepository.js';

const scrypt = promisify(scryptCallback);
const tokenTtlSeconds = 60 * 60 * 8;

function signingKey() {
    const key = process.env.AUTH_TOKEN_SECRET;
    if (!key || key.length < 32) throw new Error('AUTH_TOKEN_SECRET must be set to at least 32 characters');
    return key;
}

export function assertAuthConfiguration() {
    signingKey();
}

function sign(value) {
    return createHmac('sha256', signingKey()).update(value).digest('base64url');
}

function createToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, name: user.displayName, iat: now, exp: now + tokenTtlSeconds })).toString('base64url');
    const content = `${header}.${payload}`;
    return `${content}.${sign(content)}`;
}

export function getTokenLifetimeSeconds() {
    return tokenTtlSeconds;
}

export function verifyToken(token) {
    const [header, payload, signature, extra] = String(token ?? '').split('.');
    if (!header || !payload || !signature || extra) return null;
    const content = `${header}.${payload}`;
    const expected = Buffer.from(sign(content));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!claims.sub || !Number.isInteger(claims.exp) || claims.exp <= Date.now() / 1000) return null;
        return claims;
    } catch {
        return null;
    }
}

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
    const derived = await scrypt(password, salt, 64);
    return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function passwordMatches(password, storedHash) {
    const [scheme, salt, hex] = String(storedHash ?? '').split('$');
    if (scheme !== 'scrypt' || !salt || !hex) return false;
    const actual = Buffer.from(hex, 'hex');
    const expected = await scrypt(password, salt, actual.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function registerUser({ email, displayName, password }) {
    const hash = await passwordHash(password);
    const user = await createUser({ email, displayName, passwordHash: hash });
    return { user, token: createToken(user) };
}

export async function loginUser({ email, password }) {
    const user = await findUserByEmail(email);
    if (!user || !(await passwordMatches(password, user.passwordHash))) return null;
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, token: createToken(safeUser) };
}

function hashResetToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function createResetMailer() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
        const error = new Error('Password reset email is not configured');
        error.code = 'PASSWORD_RESET_EMAIL_NOT_CONFIGURED';
        throw error;
    }
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
}

export async function requestPasswordReset(email) {
    const mailer = createResetMailer();
    const user = await findUserByEmail(email);
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });
    const baseUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
    const resetUrl = new URL('/', `${baseUrl}/`);
    resetUrl.searchParams.set('resetToken', token);
    void mailer.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: 'Reset your Smart Todo password',
            text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl.href}`,
        }).catch(async (error) => {
            console.error('[Password reset email failed]', { code: error.code, message: error.message });
            await deletePasswordResetToken(tokenHash).catch(() => {});
        });
}

export async function resetPassword({ token, password }) {
    const tokenHash = hashResetToken(token);
    if (!(await hasValidPasswordResetToken(tokenHash))) return false;
    const passwordDigest = await passwordHash(password);
    return consumePasswordResetToken({ tokenHash, passwordHash: passwordDigest });
}
