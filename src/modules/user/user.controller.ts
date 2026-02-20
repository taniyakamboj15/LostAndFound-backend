import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import userService from './user.service';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User Management and Profile
 */
class UserController {
  /**
   * @swagger
   * /api/users/profile:
   *   get:
   *     summary: Get current user profile
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   */
  getProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = await userService.getUserById(req.user!.id);

      res.json({
        success: true,
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          avatar: user.avatar,
          phone: user.phone,
          notificationPreferences: user.notificationPreferences,
          createdAt: user.createdAt,
        },
      });
    }
  );

  /** Alias for GET /api/users/me */
  getMe = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = await userService.getUserById(req.user!.id);
      res.json({
        success: true,
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          avatar: user.avatar,
          phone: user.phone,
          notificationPreferences: user.notificationPreferences,
          createdAt: user.createdAt,
        },
      });
    }
  );

  /** PATCH /api/users/me/notification-preferences */
  updateNotificationPreferences = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { notificationPreferences } = req.body;
      const user = await userService.updateUser(req.user!.id, {
        notificationPreferences,
      });
      res.json({
        success: true,
        message: 'Notification preferences updated',
        data: { notificationPreferences: user.notificationPreferences },
      });
    }
  );

  /**
   * @swagger
   * /api/users/profile:
   *   patch:
   *     summary: Update user profile
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               phone:
   *                 type: string
   *               avatar:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated successfully
   */
  updateProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { name, phone, avatar } = req.body;

      const user = await userService.updateUser(req.user!.id, {
        name,
        phone,
        avatar,
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          phone: user.phone,
        },
      });
    }
  );

  /**
   * @swagger
   * /api/users/verify-email:
   *   post:
   *     summary: Verify user email with token
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *     responses:
   *       200:
   *         description: Email verified successfully
   */
  verifyEmail = asyncHandler(async (req, res: Response): Promise<void> => {
    const { token } = req.body;

    const user = await userService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  });

  /**
   * @swagger
   * /api/users/resend-verification:
   *   post:
   *     summary: Resend verification email
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Verification email sent
   */
  resendVerification = asyncHandler(async (req, res: Response): Promise<void> => {
    const { email } = req.body;

    await userService.resendVerificationEmail(email);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  });

  /**
   * @swagger
   * /api/users:
   *   post:
   *     summary: Create a new user (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *               - password
   *               - role
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [ADMIN, STAFF, CLAIMANT]
   *     responses:
   *       201:
   *         description: User created successfully
   */
  createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, email, password, role } = req.body;

    const user = await userService.createUser({
      name,
      email,
      password,
      role,
      isEmailVerified: true // Admin created users are auto-verified
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  });

  /**
   * @swagger
   * /api/users:
   *   get:
   *     summary: Get all users (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Users retrieved successfully
   */
  getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { role } = req.query;
    const users = await userService.getAllUsers(role as string);

    res.json({
      success: true,
      data: users,
    });
  });
}

export default new UserController();
