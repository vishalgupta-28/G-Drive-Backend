import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Config } from '../config/config.js';
import { RedisClient } from '../config/redis.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, Config.jwtSecret) as { sessionId: string };

        // Check Redis Session
        const redis = RedisClient.getInstance();
        const sessionData = await redis.get(`session:${decoded.sessionId}`);

        if (!sessionData) {
            return res.status(401).json({ message: 'Session expired or invalid' });
        }

        const user = JSON.parse(sessionData);
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
