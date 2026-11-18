import sql from 'mssql';
import { getPool } from '../config/database.js';

export async function createUser({ email, displayName, passwordHash }) {
    const pool = await getPool();
    const result = await pool.request()
        .input('email', sql.NVarChar(254), email)
        .input('displayName', sql.NVarChar(100), displayName)
        .input('passwordHash', sql.NVarChar(512), passwordHash)
        .query(`INSERT dbo.Users (Email, DisplayName, PasswordHash)
            OUTPUT INSERTED.UserId AS id, INSERTED.Email AS email, INSERTED.DisplayName AS displayName
            VALUES (@email, @displayName, @passwordHash)`);
    return result.recordset[0];
}

export async function findUserByEmail(email) {
    const pool = await getPool();
    const result = await pool.request().input('email', sql.NVarChar(254), email)
        .query('SELECT UserId AS id, Email AS email, DisplayName AS displayName, PasswordHash AS passwordHash FROM dbo.Users WHERE Email=@email');
    return result.recordset[0] ?? null;
}

export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
    const pool = await getPool();
    await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('tokenHash', sql.Char(64), tokenHash)
        .input('expiresAt', sql.DateTime2(3), expiresAt)
        .query(`BEGIN TRANSACTION;
            DELETE FROM dbo.PasswordResetTokens WHERE UserId=@userId;
            INSERT dbo.PasswordResetTokens (UserId, TokenHash, ExpiresAt)
            VALUES (@userId, @tokenHash, @expiresAt);
            COMMIT TRANSACTION;`);
}

export async function deletePasswordResetToken(tokenHash) {
    const pool = await getPool();
    await pool.request().input('tokenHash', sql.Char(64), tokenHash)
        .query('DELETE FROM dbo.PasswordResetTokens WHERE TokenHash=@tokenHash');
}

export async function hasValidPasswordResetToken(tokenHash) {
    const pool = await getPool();
    const result = await pool.request().input('tokenHash', sql.Char(64), tokenHash)
        .query('SELECT 1 AS valid FROM dbo.PasswordResetTokens WHERE TokenHash=@tokenHash AND ExpiresAt>SYSUTCDATETIME()');
    return result.recordset.length > 0;
}

export async function consumePasswordResetToken({ tokenHash, passwordHash }) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const token = await new sql.Request(transaction)
            .input('tokenHash', sql.Char(64), tokenHash)
            .query(`SELECT UserId AS userId FROM dbo.PasswordResetTokens WITH (UPDLOCK, ROWLOCK)
                WHERE TokenHash=@tokenHash AND ExpiresAt>SYSUTCDATETIME()`);
        if (!token.recordset[0]) {
            await transaction.rollback();
            return false;
        }
        await new sql.Request(transaction)
            .input('userId', sql.UniqueIdentifier, token.recordset[0].userId)
            .input('passwordHash', sql.NVarChar(512), passwordHash)
            .query(`UPDATE dbo.Users SET PasswordHash=@passwordHash, UpdatedAt=SYSUTCDATETIME()
                WHERE UserId=@userId;
                DELETE FROM dbo.PasswordResetTokens WHERE UserId=@userId;`);
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
