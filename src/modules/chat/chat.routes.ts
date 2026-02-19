import { Router } from 'express';
import { authenticate, requireEmailVerification } from '../../common/middlewares/auth.middleware';
import { sendMessageValidation, sessionParamValidation } from './chat.validation';
import * as chatController from './chat.controller';
import { validate } from '../../common/middlewares/validation.middleware';

const router = Router();

// All chat routes require authentication and email verification
router.use(authenticate);
router.use(requireEmailVerification);

/**
 * @route   POST /api/chat/start
 * @desc    Start a new chat session
 * @access  Private (authenticated + email verified)
 */
router.post('/start', chatController.startSession);

/**
 * @route   POST /api/chat/message
 * @desc    Send a message in a chat session
 * @access  Private
 */
router.post('/message', validate(sendMessageValidation), chatController.sendMessage);

/**
 * @route   GET /api/chat/session/:sessionId
 * @desc    Get session state
 * @access  Private
 */
router.get(
  '/session/:sessionId',
  validate(sessionParamValidation),
  chatController.getSession
);

/**
 * @route   DELETE /api/chat/session/:sessionId
 * @desc    Cancel and delete a session
 * @access  Private
 */
router.delete(
  '/session/:sessionId',
  validate(sessionParamValidation),
  chatController.deleteSession
);

export default router;
