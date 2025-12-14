import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SchedulerClient, DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
import {
    createRequestLogger,
    successResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getItem,
    deleteItem,
    pk,
    sk,
    getPathParam,
} from '../../shared';

const scheduler = new SchedulerClient({});

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);
    const eventId = getPathParam(event, 'id');
    const messageId = getPathParam(event, 'msgId');

    if (!eventId || !messageId) {
        return badRequestResponse('Event ID and Message ID are required');
    }

    try {
        // 1. Get Message to find Schedule Name/ARN
        const message = await getItem<{ schedulerScheduleArn?: string; status: string }>(
            pk('EVENT', eventId),
            sk('MESSAGE', messageId)
        );

        if (!message) {
            return notFoundResponse('Message not found');
        }

        // 2. Delete Schedule if pending
        if (message.status === 'PENDING' && message.schedulerScheduleArn) {
            const scheduleName = message.schedulerScheduleArn.split('/').pop(); // Extract name from ARN
            if (scheduleName) {
                try {
                    await scheduler.send(new DeleteScheduleCommand({
                        Name: scheduleName,
                        GroupName: process.env.SCHEDULER_GROUP_NAME,
                    }));
                    log.info('Schedule deleted', { scheduleName });
                } catch (err) {
                    log.warn('Failed to delete schedule (might already be gone)', { error: err });
                }
            }
        }

        // 3. Delete from DynamoDB
        await deleteItem(pk('EVENT', eventId), sk('MESSAGE', messageId));

        log.info('Message deleted', { eventId, messageId });

        return successResponse({ message: 'Message deleted' });

    } catch (error) {
        log.error('Failed to delete message', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
