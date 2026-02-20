import { v4 as uuidv4 } from 'uuid';
import User, { IUser } from './user.model';
import Claim from '../claim/claim.model';
import { NotFoundError, ValidationError } from '../../common/errors';
import transporter from '../../config/email';
import logger from '../../common/utils/logger';

class UserService {
  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    isEmailVerified?: boolean;
  }): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email });

    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    const emailVerificationToken = uuidv4();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      ...data,
      emailVerificationToken,
      emailVerificationExpires,
    });

    await this.linkAnonymousClaims(user.email, user._id.toString());

    await this.sendVerificationEmail(user.email, emailVerificationToken);

    return user;
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email });
  }

  async getAllUsers(role?: string): Promise<IUser[]> {
    const query = role ? { role } : {};
    return User.find(query).sort({ createdAt: -1 });
  }

  async updateUser(
    userId: string,
    data: Partial<Pick<IUser, 'name' | 'phone' | 'avatar' | 'notificationPreferences'>>
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async verifyEmail(token: string): Promise<IUser> {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw new ValidationError('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Retroactively link anonymous claims on email verification too
    await this.linkAnonymousClaims(user.email, user._id.toString());

    return user;
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await User.findOne({ email }).select(
      '+emailVerificationToken +emailVerificationExpires'
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isEmailVerified) {
      throw new ValidationError('Email already verified');
    }

    const emailVerificationToken = uuidv4();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();

    await this.sendVerificationEmail(email, emailVerificationToken);
  }

  /**
   * Link all anonymous claims that were filed with the given email
   * to the newly created (or verified) user account.
   * This is idempotent — claims already linked are skipped.
   */
  async linkAnonymousClaims(email: string, userId: string): Promise<void> {
    try {
      const result = await Claim.updateMany(
        { isAnonymous: true, email, claimantId: { $exists: false } },
        { $set: { claimantId: userId, isAnonymous: false } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`Linked ${result.modifiedCount} anonymous claim(s) to user ${userId} (email: ${email})`);
      }
    } catch (err) {
      // Non-blocking — don't fail registration if linking errors
      logger.warn('Failed to link anonymous claims:', err);
    }
  }

  private async sendVerificationEmail(
    email: string,
    token: string
  ): Promise<void> {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Email - Lost & Found Platform',
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });
  }
}

export default new UserService();
