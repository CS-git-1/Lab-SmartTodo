import {
    createTaskRecord,
    deleteTaskRecord,
    findTaskById,
    findTasks,
    updateTaskRecord,
} from '../repositories/taskRepository.js';

export async function listTasks(options) { return findTasks(options); }

export async function getTask(userId, taskId) { return findTaskById(userId, taskId); }

export async function createTask(input) { return createTaskRecord(input); }

export async function updateTask(userId, taskId, changes) { return updateTaskRecord(userId, taskId, changes); }

export async function deleteTask(userId, taskId) { return deleteTaskRecord(userId, taskId); }
