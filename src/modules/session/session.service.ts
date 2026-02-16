import jwt from 'jsonwebtoken';
import { addDays } from 'date-fns';
import Session from './session.model';
import User, { IUser } from '../user/user.model';
import redisClient from '../../config/redis';
import { AuthenticationError, NotFoundError } from '../../common/errors';
import { TokenPayload, Tokens } from '../../common/types';
import { JWT } from '../../common/constants';

class SessionService {
  async createSession(user: IUser): Promise<Tokens> {
    const payload: TokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };

    const accessToken = jwt.sign(
      payload,
      JWT.ACCESS_TOKEN_SECRET,
      { expiresIn: JWT.ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { id: user._id.toString() },
      JWT.REFRESH_TOKEN_SECRET,
      { expiresIn: JWT.REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    // Store refresh token in database
    const expiresAt = addDays(new Date(), 7);
    await Session.create({
      userId: user._id,
      refreshToken,
      expiresAt,
    });

    // Cache refresh token validity in Redis
    await redisClient.setex(
      `refresh_token:${user._id.toString()}:${refreshToken}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      'valid'
    );

    return { accessToken, refreshToken };
  }

  async refreshSession(refreshToken: string): Promise<Tokens> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        JWT.REFRESH_TOKEN_SECRET
      ) as { id: string };

      const session = await Session.findOne({
        refreshToken,
        userId: decoded.id,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      const user = await User.findById(decoded.id);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Delete old session
      await Session.deleteOne({ _id: session._id });

      // Create new session
      return this.createSession(user);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw error;
    }
  }

  async revokeSession(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await Session.deleteOne({ userId, refreshToken });
      // Remove from Redis cache
      await redisClient.del(`refresh_token:${userId}:${refreshToken}`);
    } else {
      // Revoke all sessions
      await Session.deleteMany({ userId });
      // Clear all refresh tokens from Redis
      const keys = await redisClient.keys(`refresh_token:${userId}:*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }

    // Clear user session cache
    await redisClient.del(`session:${userId}`);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await Session.deleteMany({ userId });
    
    // Clear all Redis keys for this user
    const refreshTokenKeys = await redisClient.keys(`refresh_token:${userId}:*`);
    if (refreshTokenKeys.length > 0) {
      await redisClient.del(...refreshTokenKeys);
    }
    await redisClient.del(`session:${userId}`);
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<{ user: IUser; tokens: Tokens }> {
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    if (!user.password) {
      throw new AuthenticationError(
        'Please login with Google or reset your password'
      );
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const tokens = await this.createSession(user);

    return { user, tokens };
  }
}

export default new SessionService();
