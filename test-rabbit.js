import amqp from 'amqplib';

const QUEUE = 'PROCESS_THUMBNAIL';
const RABBIT_URL = 'amqp://localhost:5672';

async function main() {
    const conn = await amqp.connect(RABBIT_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(QUEUE, { durable: true });

    const info = await ch.checkQueue(QUEUE);
    console.log(`Queue "${QUEUE}": ${info.messageCount} messages, ${info.consumerCount} consumer(s)`);

    await ch.close();
    await conn.close();
}

main().catch(console.error);
