import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../common/types';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { ValidationError } from '../../common/errors';
import chatService from './chat.service';
import logger from '../../common/utils/logger';

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI Assistant Chat sessions
 */
/**
 * @swagger
 * /api/chat/start:
 *   post:
 *     summary: Start a new chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat session started successfully
 */
export const startSession = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: userId, email: userEmail } = req.user!;

    const result = await chatService.startSession(userId, userEmail);

    logger.info(`Chat session started: ${result.sessionId} for user ${userId}`);

    res.status(200).json({
      success: true,
      data: result,
    });
  }
);

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Send a message to AI assistant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response retrieved successfully
 */
export const sendMessage = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const { sessionId, message } = req.body as { sessionId: string; message: string };
    const { id: userId, email: userEmail } = req.user!;

    if (!sessionId) {
      throw new ValidationError('sessionId is required. Call /api/chat/start first.');
    }

    const result = await chatService.processMessage(sessionId, message, userId, userEmail);

    res.status(200).json({
      success: true,
      data: result,
    });
  }
);

/**
 * @swagger
 * /api/chat/session/{sessionId}:
 *   get:
 *     summary: Get chat session state
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session state retrieved
 */
export const getSession = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { id: userId } = req.user!;

    const session = chatService.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Session not found or expired',
      });
      return;
    }

    // Security: only allow access to own sessions
    if (session.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        step: session.step,
        collectedData: session.collectedData,
        messageCount: session.messages.length,
        expiresAt: session.expiresAt,
      },
    });
  }
);

/**
 * @swagger
 * /api/chat/session/{sessionId}:
 *   delete:
 *     summary: End and delete a chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session terminated
 */
export const deleteSession = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { id: userId } = req.user!;

    const session = chatService.getSession(sessionId);

    if (session && session.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    chatService.deleteSession(sessionId);

    res.status(200).json({
      success: true,
      message: 'Session deleted',
    });
  }
);
