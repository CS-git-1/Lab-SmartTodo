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
