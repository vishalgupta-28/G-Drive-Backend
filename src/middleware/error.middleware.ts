import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (err instanceof ZodError) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: err.issues,
        });
    }

    logger.error(err, 'Unhandled error');

    const status = (err as any).status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
}
