import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../modules/user/user.model';
import { UserRole } from '../common/types';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: (error: Error | null, user?: Express.User | false) => void
    ) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            email,
            name: profile.displayName,
            role: UserRole.CLAIMANT,
            isEmailVerified: true, 
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value,
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          user.isEmailVerified = true;
          await user.save();
        }

        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

export default passport;
