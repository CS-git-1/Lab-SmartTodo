import { Router } from 'express';
import * as controller from '../controllers/taskController.js';
import { asyncHandler } from '../utils/apiError.js';

const router = Router();
router.post('/', asyncHandler(controller.create));
router.get('/', asyncHandler(controller.list));
router.get('/:taskId', asyncHandler(controller.read));
router.patch('/:taskId', asyncHandler(controller.update));
router.put('/:taskId', asyncHandler(controller.replace));
router.delete('/:taskId', asyncHandler(controller.remove));

export default router;
