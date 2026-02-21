# ☁️ G-Drive Backend Service

> A robust, highly scalable, and production-ready backend infrastructure for a cloud storage platform (Google Drive clone).

This application is engineered with a decoupled, event-driven architecture designed to handle heavy asynchronous workloads. It utilizes strict Dependency Injection and follows the Controller-Service-Repository pattern to ensure maintainability and testability at an enterprise scale.

---

## 🚀 Core Features

* **Robust Authentication**: Implements Passport.js with Google OAuth2.0 integration for seamless and secure user sign-ins.
* **Advanced File System Management**: Comprehensive file, folder, and blob management logic separated into dedicated repositories (`FileRepository`, `FolderRepository`, `BlobRepository`).
* **Secure Sharing Mechanics**: Includes a dedicated `FileShareRepository` to handle granular access control and public/private link sharing.
* **Rich Media Processing**: Utilizes `fluent-ffmpeg`, `ffmpeg-static`, `sharp`, and `pdf2pic` to process uploads, compress media, and generate thumbnails.
* **Background Task Processing**: Integrates RabbitMQ via `amqplib` for executing decoupled, asynchronous background jobs (like video transcoding and image processing) through a dedicated worker process.
* **High-Performance Caching**: Employs Redis (`ioredis`) for session management, fast data retrieval, and caching mechanisms.
* **Direct-to-Cloud Uploads**: Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for secure, multi-part, or direct-to-S3 file uploads via the `UploadService`.
* **Type-Safe Validation**: Leverages `zod` for strict runtime schema and API payload validation.
* **Built-in Security & Monitoring**: Incorporates `helmet` for HTTP header security, `cors` for cross-origin management, and a dedicated `/health` endpoint for uptime monitoring.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Language** | TypeScript / Node.js |
| **Framework** | Express.js (v5.x) |
| **Database** | PostgreSQL (v15 Alpine) |
| **ORM** | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) |
| **Message Broker** | RabbitMQ (v3 Management Alpine) |
| **Caching** | Redis (v7 Alpine) |
| **Logging** | Pino (`pino`, `pino-pretty`) & Morgan (`morgan`) |

---

## 📂 Project Architecture & Design Pattern

The application rigorously adheres to the **Controller-Service-Repository** design pattern, instantiated via manual Dependency Injection during application startup.

### Layer Breakdown:
1. **App Initialization (`createApp`)**: Connects to the Database, Redis, and RabbitMQ before passing instances down to the repositories.
2. **Repositories**: Act as the strict data-access layer. The system includes `UserRepository`, `BlobRepository`, `UploadRepository`, `FileRepository`, `FolderRepository`, and `FileShareRepository`.
3. **Services**: Contain the core business logic. The system initializes `AuthService`, `UploadService`, `FileService`, and `FolderService`, injecting the required repositories into them.
4. **Controllers**: Handle HTTP request extraction and responses via `AuthController`, `UploadController`, `FileController`, and `FolderController`.
5. **Error Handling**: All routes flow through a centralized, global `errorHandler` middleware.

---

## 🐳 Infrastructure & Docker Deployment

The system is fully containerized for local development and production equivalence using `docker-compose.yml`.

### Services Orchestrated:
* **`app`**: The main Express API running on port `8000`.
* **`worker`**: A discrete Node.js process executing `npm run worker` to consume queue messages and handle heavy media processing.
* **`db`**: A persistent PostgreSQL instance mapped to the `pgdata` volume on port `5432`.
* **`redis`**: An in-memory data store mapped to the `redisdata` volume on port `6379`.
* **`rabbitmq`**: The message broker mapped to the `rabbitmqdata` volume, exposing port `5672` for internal communication and `15672` for the management UI.

*Note: Both the `app` and `worker` nodes wait for `db`, `redis`, and `rabbitmq` to pass their respective health checks before initializing.*

---

## 💻 Setup & Installation

### 1. Prerequisites
Ensure you have Docker, Docker Compose, and Node.js installed. 

### 2. Environment Variables
Create a `.env` file based on the application's configuration needs. The Docker environment automatically maps the following internal URLs:
* `REDIS_URL=redis://redis:6379`
* `RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672`

### 3. Start Infrastructure
To spin up the entire stack locally:
```bash
docker-compose up -d

4. Available NPM Scripts
If you prefer running the application directly on your host machine for development, use the following commands defined in the project:

Start Development API:

Bash
npm run dev
# Executes: ts-node src/index.ts
Start Development Worker:

Bash
npm run worker
# Executes: node ./dist/worker/index.js
Build for Production:

Bash
npm run build
# Executes: tsc
Start Production API:

Bash
npm start
# Executes: node ./dist/server.js
5. Database Management (Drizzle)
Manage your database schema using the built-in Drizzle scripts:

npm run db:generate: Generates new migration files.

npm run db:migrate: Applies migrations to the database.

npm run db:push: Pushes schema changes directly (best for rapid prototyping).