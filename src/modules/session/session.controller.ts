import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import sessionService from './session.service';
import userService from '../user/user.service';

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and session management
 */
class SessionController {
  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - name
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 format: password
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Registration successful
   */
  register = asyncHandler(async (req, res: Response): Promise<void> => {
    const { email, password, name } = req.body;

    const user = await userService.createUser({ email, password, name });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        email: user.email,
        name: user.name,
      },
    });
  });

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 format: password
   *     responses:
   *       200:
   *         description: Login successful
   */
  login = asyncHandler(async (req, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const { user, tokens } = await sessionService.authenticateUser(
      email,
      password
    );

    // Set httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  });

  refresh = asyncHandler(async (req, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken;

    const tokens = await sessionService.refreshSession(refreshToken);

    // Set new httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout and revoke session
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   */
  logout = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const refreshToken = req.cookies?.refreshToken;

      await sessionService.revokeSession(req.user!.id, refreshToken);

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful',
      });
    }
  );

  googleCallback = asyncHandler(async (req, res: Response): Promise<void> => {
    const user = req.user as Express.User;

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }

    const tokens = await sessionService.createSession(user as never);

    // Set httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  });
}

export default new SessionController();
