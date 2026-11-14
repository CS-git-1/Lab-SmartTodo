export function sendApiError(res, status, code, message) {
    return res.status(status).json({ error: { code, message } });
}

export function logServerError(context, error) {
    console.error(`[${context}]`, {
        message: error.message,
        code: error.code,
        number: error.number,
        stack: error.stack,
    });
}

export function asyncHandler(handler) {
    return function wrappedAsyncHandler(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
