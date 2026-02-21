import { S3Client } from '@aws-sdk/client-s3';
import { Config } from './config.js';

export const s3Client = new S3Client({
    // Clean the endpoint to ensure it doesn't contain the bucket name.
    // E.g., if env is 'https://stealth.blr1.digitaloceanspaces.com', we want 'https://blr1.digitaloceanspaces.com'
    endpoint: Config.doEndpoint.replace(`${Config.doBucket}.`, ''),
    region: Config.awsRegion,
    credentials: {
        accessKeyId: Config.doAccessKeyId,
        secretAccessKey: Config.doSecretAccessKey,
    },
    forcePathStyle: false, // DO Spaces supports virtual-hosted style requests
});
