import sql from 'mssql';
import { getPool } from '../config/database.js';

const columns = {
    title: ['Title', sql.NVarChar(300)], description: ['Description', sql.NVarChar(sql.MAX)],
    projectId: ['ProjectId', sql.UniqueIdentifier], status: ['Status', sql.VarChar(20)],
    priority: ['Priority', sql.TinyInt], startAt: ['StartAt', sql.DateTime2(3)],
    dueAt: ['DueAt', sql.DateTime2(3)], estimatedMinutes: ['EstimatedMinutes', sql.Int],
    sortOrder: ['SortOrder', sql.Int],
};

const taskDtoSql = `TaskId AS id, ProjectId AS projectId, Title AS title,
    Description AS description, Status AS status,
    CAST(CASE WHEN Status='done' THEN 1 ELSE 0 END AS bit) AS isCompleted,
    Priority AS priority, StartAt AS startAt, DueAt AS dueAt, EstimatedMinutes AS estimatedMinutes,
    CompletedAt AS completedAt, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt`;

const insertedTaskDtoSql = `INSERTED.TaskId AS id, INSERTED.ProjectId AS projectId,
    INSERTED.Title AS title, INSERTED.Description AS description, INSERTED.Status AS status,
    CAST(CASE WHEN INSERTED.Status='done' THEN 1 ELSE 0 END AS bit) AS isCompleted,
    INSERTED.Priority AS priority, INSERTED.StartAt AS startAt, INSERTED.DueAt AS dueAt,
    INSERTED.EstimatedMinutes AS estimatedMinutes, INSERTED.CompletedAt AS completedAt,
    INSERTED.SortOrder AS sortOrder, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt`;

export async function findTasks({ userId, status, priority, projectId, q, page, limit }) {
    const pool = await getPool();
    const request = pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('offset', sql.Int, (page - 1) * limit)
        .input('limit', sql.Int, limit);
    const where = ['UserId = @userId'];
    if (status) { where.push('Status = @status'); request.input('status', sql.VarChar(20), status); }
    if (priority) { where.push('Priority = @priority'); request.input('priority', sql.TinyInt, priority); }
    if (projectId) { where.push('ProjectId = @projectId'); request.input('projectId', sql.UniqueIdentifier, projectId); }
    if (q) { where.push('(Title LIKE @q OR Description LIKE @q)'); request.input('q', sql.NVarChar(302), `%${q}%`); }

    const result = await request.query(`
        SELECT TaskId AS id, UserId AS userId, ProjectId AS projectId, Title AS title,
               Description AS description, Status AS status,
               CAST(CASE WHEN Status = 'done' THEN 1 ELSE 0 END AS bit) AS isCompleted,
               Priority AS priority, StartAt AS startAt, DueAt AS dueAt,
               EstimatedMinutes AS estimatedMinutes, CompletedAt AS completedAt,
               SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
               Version AS version, COUNT_BIG(*) OVER() AS totalCount
        FROM dbo.Tasks WHERE ${where.join(' AND ')}
        ORDER BY CreatedAt DESC, TaskId DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return {
        data: result.recordset.map(({ id, title, description, status, isCompleted, priority, startAt, dueAt, estimatedMinutes, completedAt, sortOrder, createdAt, updatedAt }) => ({
            id, title, description, status, isCompleted, priority, startAt, dueAt, estimatedMinutes, completedAt, sortOrder, createdAt, updatedAt,
        })),
        total: Number(result.recordset[0]?.totalCount ?? 0),
    };
}

export async function findTaskById(userId, taskId) {
    const pool = await getPool();
    const result = await pool.request().input('userId', sql.UniqueIdentifier, userId).input('taskId', sql.UniqueIdentifier, taskId)
        .query(`SELECT ${taskDtoSql} FROM dbo.Tasks WHERE UserId=@userId AND TaskId=@taskId`);
    return result.recordset[0] ?? null;
}

export async function createTaskRecord(input) {
    const pool = await getPool();
    const request = pool.request().input('userId', sql.UniqueIdentifier, input.userId);
    const names = ['UserId']; const values = ['@userId'];
    for (const [key, value] of Object.entries(input)) {
        if (key === 'userId') continue;
        const [column, type] = columns[key];
        request.input(key, type, value === '' ? null : value);
        names.push(column); values.push(`@${key}`);
    }
    const completed = input.status === 'done' ? 'SYSUTCDATETIME()' : 'NULL';
    const result = await request.query(`INSERT dbo.Tasks (${names.join(',')}, CompletedAt)
        OUTPUT ${insertedTaskDtoSql}
        VALUES (${values.join(',')}, ${completed})`);
    return result.recordset[0];
}

export async function updateTaskRecord(userId, taskId, changes) {
    const pool = await getPool();
    const request = pool.request().input('userId', sql.UniqueIdentifier, userId).input('taskId', sql.UniqueIdentifier, taskId);
    const sets = [];
    for (const [key, value] of Object.entries(changes)) {
        const [column, type] = columns[key];
        request.input(key, type, value === '' ? null : value);
        sets.push(`${column}=@${key}`);
    }
    if (Object.hasOwn(changes, 'status')) sets.push("CompletedAt = CASE WHEN @status='done' THEN COALESCE(CompletedAt,SYSUTCDATETIME()) ELSE NULL END");
    sets.push('UpdatedAt=SYSUTCDATETIME()');
    const result = await request.query(`UPDATE dbo.Tasks SET ${sets.join(',')}
        OUTPUT ${insertedTaskDtoSql}
        WHERE UserId=@userId AND TaskId=@taskId`);
    return result.recordset[0] ?? null;
}

export async function deleteTaskRecord(userId, taskId) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const ownedTask = await new sql.Request(transaction)
            .input('userId', sql.UniqueIdentifier, userId)
            .input('taskId', sql.UniqueIdentifier, taskId)
            .query('SELECT TaskId FROM dbo.Tasks WHERE UserId=@userId AND TaskId=@taskId');
        if (ownedTask.recordset.length === 0) { await transaction.rollback(); return false; }
        await new sql.Request(transaction).input('taskId', sql.UniqueIdentifier, taskId)
            .query('DELETE FROM dbo.Reminders WHERE TaskId=@taskId');
        await new sql.Request(transaction).input('taskId', sql.UniqueIdentifier, taskId)
            .query('DELETE FROM dbo.ChecklistItems WHERE TaskId=@taskId');
        await new sql.Request(transaction).input('userId', sql.UniqueIdentifier, userId).input('taskId', sql.UniqueIdentifier, taskId)
            .query('DELETE FROM dbo.TaskTags WHERE UserId=@userId AND TaskId=@taskId');
        const result = await new sql.Request(transaction)
            .input('userId', sql.UniqueIdentifier, userId)
            .input('taskId', sql.UniqueIdentifier, taskId)
            .query('DELETE FROM dbo.Tasks WHERE UserId=@userId AND TaskId=@taskId');
        const affectedRows = result.rowsAffected.reduce((total, count) => total + count, 0);
        if (affectedRows === 0) { await transaction.rollback(); return false; }
        await transaction.commit();
        return true;
    } catch (error) { await transaction.rollback(); throw error; }
}
