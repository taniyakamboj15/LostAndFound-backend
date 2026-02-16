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
          createdAt: user.createdAt,
        },
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

  resendVerification = asyncHandler(async (req, res: Response): Promise<void> => {
    const { email } = req.body;

    await userService.resendVerificationEmail(email);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  });

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
