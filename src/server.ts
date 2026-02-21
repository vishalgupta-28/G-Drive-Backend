import { createApp } from "./app.js";
import { Config } from "./config/config.js";
import { logger } from "./utils/logger.js";

async function startServer() {
    try {
        const app = await createApp();
        app.listen(Config.port, () => {
            logger.info(`Server is running on port ${Config.port}`);
        });
    } catch (error: any) {
        logger.error(error, "Failed to start server");
        process.exit(1);
    }
}

startServer();