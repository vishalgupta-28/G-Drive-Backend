import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import amqp, { ConsumeMessage } from 'amqplib';
import { eq } from 'drizzle-orm';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Set the path to the statically compiled ffmpeg binary safely imported
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
}
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';

import { Config } from '../config/config.js';
import { s3Client } from '../config/aws.js';
import { connectToDB } from '../db/db.js';
import { blobsTable } from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

const QUEUE_NAME = 'PROCESS_THUMBNAIL';
const TMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

interface ThumbnailJob {
    fileId: string;
    blobId: string;
    s3Key: string;
    type: string;
}

async function downloadFromS3(s3Key: string, destPath: string): Promise<void> {
    const command = new GetObjectCommand({
        Bucket: Config.doBucket,
        Key: s3Key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error('S3 response body is empty');
    }
    // Type casting because AWS SDK Node.js stream types are slightly mixed
    const bodyStream = response.Body as unknown as NodeJS.ReadableStream;
    const writeStream = fs.createWriteStream(destPath);
    await pipeline(bodyStream, writeStream);
}

async function uploadToS3(localPath: string, s3Key: string): Promise<void> {
    const fileStream = fs.createReadStream(localPath);
    const command = new PutObjectCommand({
        Bucket: Config.doBucket,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'image/jpeg',
    });
    await s3Client.send(command);
}

async function extractVideoThumbnail(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['00:00:01.000'], // Take screenshot at 1 second
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '320x240'
            })
            .on('end', () => resolve())
            .on('error', (err) => {
                const errMsg = err?.message || 'Unknown ffmpeg error';
                console.error(`[Worker] ffmpeg failed: ${errMsg}`);
                reject(new Error(errMsg));
            });
    });
}

async function extractPdfThumbnail(inputPath: string, outputPath: string): Promise<void> {
    const { execSync } = await import('child_process');
    // Use Ghostscript directly to render PDF page 1 to JPEG
    const gsCommand = [
        'gs',
        '-dNOPAUSE',
        '-dBATCH',
        '-dFirstPage=1',
        '-dLastPage=1',
        '-sDEVICE=jpeg',
        '-dJPEGQ=85',
        '-r150',            // 150 DPI resolution
        `-dDEVICEWIDTHPOINTS=600`,
        `-dDEVICEHEIGHTPOINTS=800`,
        '-dPDFFitPage',
        `-sOutputFile=${outputPath}`,
        inputPath
    ].join(' ');

    console.log(`[Worker] Running Ghostscript: ${gsCommand}`);
    try {
        execSync(gsCommand, { stdio: 'pipe', timeout: 30000 });
    } catch (err: any) {
        console.error(`[Worker] Ghostscript failed:`, err.stderr?.toString() || err.message);
        throw err;
    }
}

async function extractImageThumbnail(inputPath: string, outputPath: string): Promise<void> {
    console.log(`[Worker] Running sharp resizing for image: ${inputPath}`);
    await sharp(inputPath)
        .resize({ width: 600, height: 800, fit: 'inside' })
        .jpeg({ quality: 85 })
        .toFile(outputPath);
}

async function startWorker() {
    let connection: any = null;
    let channel: any = null;

    try {
        const db = await connectToDB(Config.dbUrl);
        logger.info('Worker connected to Postgres database');

        connection = await amqp.connect(Config.rabbitMqUrl);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        logger.info(`🐰 Worker listening for messages on queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            const jobStr = msg.content.toString();
            let job: ThumbnailJob;

            try {
                job = JSON.parse(jobStr);
            } catch (err) {
                logger.error({ err, jobStr }, 'Failed to parse RabbitMQ message');
                channel!.ack(msg); // Ack malformed messages to drop them
                return;
            }

            logger.info({ blobId: job.blobId, type: job.type }, 'Processing thumbnail job');
            console.log(`[Worker] Processing thumbnail for blobId=${job.blobId}, type=${job.type}, s3Key=${job.s3Key}`);

            const sourceFilePath = path.join(TMP_DIR, `${job.blobId}_src_${job.s3Key}`);
            const thumbFilePath = path.join(TMP_DIR, `${job.blobId}_thumb.jpg`);
            const targetS3Key = `thumbnails/${job.blobId}.jpg`;

            try {
                // 1. Download file from S3 to temp storage
                console.log(`[Worker] Step 1: Downloading from S3 key=${job.s3Key} to ${sourceFilePath}`);
                await downloadFromS3(job.s3Key, sourceFilePath);
                console.log(`[Worker] Step 1 DONE. File size: ${fs.statSync(sourceFilePath).size} bytes`);

                // 2. Extract Thumbnail
                if (job.type === 'mp4' || job.type === 'mp3' || job.type === 'video') {
                    console.log(`[Worker] Step 2: Extracting video thumbnail...`);
                    await extractVideoThumbnail(sourceFilePath, thumbFilePath);
                } else if (job.type === 'pdf') {
                    console.log(`[Worker] Step 2: Extracting PDF thumbnail...`);
                    await extractPdfThumbnail(sourceFilePath, thumbFilePath);
                } else if (job.type === 'jpg' || job.type === 'png' || job.type === 'webp' || job.type === 'image') {
                    console.log(`[Worker] Step 2: Extracting image thumbnail...`);
                    await extractImageThumbnail(sourceFilePath, thumbFilePath);
                } else {
                    console.log(`[Worker] Unsupported type: ${job.type}, skipping.`);
                    logger.warn({ type: job.type }, 'Unsupported format for thumbnail extraction');
                    channel!.ack(msg);
                    return;
                }
                console.log(`[Worker] Step 2 DONE. Thumb exists: ${fs.existsSync(thumbFilePath)}`);

                // 3. Upload Thumbnail to S3
                if (fs.existsSync(thumbFilePath)) {
                    console.log(`[Worker] Step 3: Uploading thumbnail to S3 key=${targetS3Key}, size=${fs.statSync(thumbFilePath).size}`);
                    await uploadToS3(thumbFilePath, targetS3Key);
                    console.log(`[Worker] Step 3 DONE.`);

                    // 4. Update Database
                    console.log(`[Worker] Step 4: Setting has_thumbnail=true for blobId=${job.blobId}`);
                    await db.update(blobsTable)
                        .set({ has_thumbnail: true })
                        .where(eq(blobsTable.id, job.blobId));
                    console.log(`[Worker] Step 4 DONE. Thumbnail pipeline complete!`);

                    logger.info({ blobId: job.blobId }, 'Successfully generated and saved thumbnail');
                } else {
                    throw new Error('Thumbnail file was not generated');
                }

                // 5. Acknowledge message processing succeeded
                channel!.ack(msg);
            } catch (error) {
                logger.error({ error, job }, 'Failed to process thumbnail job');
                // Nack the message so it goes back to queue (or DLQ if configured)
                channel!.nack(msg, false, false); // requeue = false assuming we don't want infinite loops on bad files for now
            } finally {
                // Cleanup temp files
                if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);
                if (fs.existsSync(thumbFilePath)) fs.unlinkSync(thumbFilePath);
            }
        });

    } catch (error) {
        logger.error(error, 'Worker failed to start');
        process.exit(1);
    }
}

startWorker();
