import sql from 'mssql';

let poolPromise;

function createPool() {
    const requiredVariables = ['DB_SERVER', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());

    if (missingVariables.length > 0) {
        const error = new Error(`Missing database configuration: ${missingVariables.join(', ')}`);
        error.code = 'DATABASE_CONFIG_MISSING';
        throw error;
    }

    return new sql.ConnectionPool({
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectionTimeout: Number(process.env.DB_LOGIN_TIMEOUT || 30) * 1000,
        options: {
            encrypt: process.env.DB_ENCRYPT !== 'false',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        },
    });
}

export function getPool() {
    if (!poolPromise) {
        const pool = createPool();
        poolPromise = pool.connect()
            .then(() => pool)
            .catch((error) => {
                poolPromise = undefined;
                throw error;
            });
    }

    return poolPromise;
}

export async function testDatabaseConnection() {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS success');
}

export async function closeDatabasePool() {
    if (poolPromise) {
        const pool = await poolPromise.catch(() => undefined);
        poolPromise = undefined;
        await pool?.close();
    }
}
