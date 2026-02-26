import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../services/auth.service.js';
import { Config } from './config.js';

export function configurePassport(authService: AuthService) {
    passport.use(new GoogleStrategy({
        clientID: Config.googleClientId,
        clientSecret: Config.googleClientSecret,
        callbackURL: Config.googleCallbackUrl,
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('No email found in Google profile'), false);
            }

            const profileImage = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined;

            const user = await authService.handleGoogleLogin({
                email,
                name: profile.displayName,
                googleImageUrl: profileImage,
            });

            return done(null, user);
        } catch (error) {
            return done(error, false);
        }
    }));
}
