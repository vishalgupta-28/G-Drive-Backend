import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function setupAuthRoutes(authController: AuthController) {
    const router = Router();

    // Initiate Google OAuth login
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

    // Google OAuth callback
    router.get('/google/callback',
        passport.authenticate('google', { session: false, failureRedirect: '/login' }),
        authController.googleCallback.bind(authController)
    );

    // Logout endpoint to clear the backend session
    router.post('/logout', authController.logout.bind(authController));

    // Get current authenticated user profile
    router.get('/me', requireAuth, authController.getMe.bind(authController));

    return router;
}
