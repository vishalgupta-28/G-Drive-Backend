import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export class AuthController {
    constructor(private readonly authService: AuthService) { }

    async googleCallback(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            if (!user) {
                return res.status(401).json({ message: 'Authentication failed' });
            }

            const token = await this.authService.createSession(user);

            // Adjust this URL to your frontend's deep link or callback receiver.
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/auth/success?token=${token}`);
        } catch (error) {
            next(error);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                await this.authService.deleteSession(token);
            }
            res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            next(error);
        }
    }

    async getMe(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req.user as any)?.id;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const user = await this.authService.getUserById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.status(200).json(user);
        } catch (error) {
            next(error);
        }
    }
}
