import type { Context } from 'aws-lambda';
import {
    createRequestLogger,
    getItem,
    putItem,
    pk,
    sk,
    KEYS,
} from '../../shared';
import { sendSlackNotification } from '../../shared/slack';

interface WorkerEvent {
    eventId: string;
    messageId: string;
}

interface Message {
    PK: string;
    SK: string;
    status: string;
    content: string;
    slackChannel?: string;
    channels?: string[];
    recipientType?: string;
    customRecipients?: string[];
    type?: string;
    [key: string]: any;
}

export async function handler(event: WorkerEvent, context: Context): Promise<void> {
    const log = createRequestLogger(context.awsRequestId);
    log.info('Processing scheduled message', { event });

    try {
        const { eventId, messageId } = event;

        // Fetch message from DynamoDB
        const message = await getItem<Message>(
            pk('EVENT', eventId),
            sk('MESSAGE', messageId)
        );

        if (!message) {
            log.warn('Message not found', { eventId, messageId });
            return;
        }

        if (message.status === 'SENT') {
            log.info('Message already sent', { eventId, messageId });
            return;
        }

        // Execute action based on type
        const notificationText = `🔔 Scheduled Message: *${message.content}*`;

        // 1. Send Slack Notification
        await sendSlackNotification(notificationText, message.slackChannel);

        // 2. Send Email if configured
        if (message.channels?.includes('email')) {
            const { sendEmail } = await import('../../shared/email');

            // Determine recipients
            let recipients: string[] = [];
            if (message.recipientType === 'custom' && message.customRecipients) {
                recipients = message.customRecipients;
            }
            // TODO: Handle 'all', 'going', 'maybe' by fetching attendees from DynamoDB

            if (recipients.length > 0) {
                // Send to each recipient (or use BCC if supported by shared module, currently one by one)
                // For distribution list, it's just one email usually
                await Promise.all(recipients.map(email =>
                    sendEmail(
                        email,
                        `DataVibes Notification: ${message.type}`,
                        message.content
                    )
                ));
            }
        }

        // Update status to SENT
        await putItem({
            ...message,
            status: 'SENT',
            sentAt: new Date().toISOString(),
        });

        log.info('Message processed successfully', { eventId, messageId });

    } catch (error) {
        log.error('Failed to process message', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Retry via DLQ or EventBridge retry policy
    }
}
