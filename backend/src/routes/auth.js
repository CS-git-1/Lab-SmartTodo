import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import authenticate from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/apiError.js';

const router = Router();
router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.post('/forgot-password', asyncHandler(controller.forgotPassword));
router.post('/reset-password', asyncHandler(controller.completePasswordReset));
router.get('/me', authenticate, asyncHandler(controller.me));

export default router;
