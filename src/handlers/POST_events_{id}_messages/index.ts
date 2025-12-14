import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";
import {
    createRequestLogger,
    createdResponse,
    badRequestResponse,
    internalErrorResponse,
    parseBody,
    putItem,
    pk,
    sk,
    getPathParam,
    KEYS,
} from '../../shared';

const scheduler = new SchedulerClient({});

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);
    const eventId = getPathParam(event, 'id');

    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }

    try {
        const body = parseBody<{
            content: string;
            scheduledAt: string;
            type: string;
            slackChannel?: string;
            channels?: string[];
            recipientType?: string;
            customRecipients?: string[];
        }>(event.body);

        if (!body || !body.content || !body.scheduledAt || !body.type) {
            return badRequestResponse('Missing required fields: content, scheduledAt, type');
        }

        // Validate email configuration if email channel is selected
        if (body.channels?.includes('email') && body.recipientType === 'custom' && (!body.customRecipients || body.customRecipients.length === 0)) {
            return badRequestResponse('customRecipients is required when email channel is selected with custom recipient type');
        }

        const messageId = uuidv4();
        const now = new Date().toISOString();

        // 1. Create Schedule
        const scheduleName = `msg-${messageId}`;
        const scheduleGroup = process.env.SCHEDULER_GROUP_NAME;
        const schedulerRoleArn = process.env.SCHEDULER_ROLE_ARN;
        const workerFunctionArn = `arn:aws:lambda:${process.env.AWS_REGION_NAME}:${context.invokedFunctionArn.split(':')[4]}:function:${process.env.PROJECT_NAME}-${process.env.ENVIRONMENT}-Worker_process_message`;

        const scheduleCommand = new CreateScheduleCommand({
            Name: scheduleName,
            GroupName: scheduleGroup,
            ScheduleExpression: `at(${body.scheduledAt.split('.')[0]})`, // Format: yyyy-mm-ddThh:mm:ss
            ScheduleExpressionTimezone: 'UTC',
            FlexibleTimeWindow: { Mode: 'OFF' },
            ActionAfterCompletion: 'DELETE',
            Target: {
                Arn: workerFunctionArn,
                RoleArn: schedulerRoleArn,
                Input: JSON.stringify({ eventId, messageId }),
            },
        });

        const scheduleResult = await scheduler.send(scheduleCommand);

        // 2. Store Message in DynamoDB
        const messageItem = {
            PK: pk('EVENT', eventId),
            SK: sk('MESSAGE', messageId),
            id: messageId,
            eventId,
            ...body,
            status: 'PENDING',
            schedulerScheduleArn: scheduleResult.ScheduleArn,
            createdAt: now,
            updatedAt: now,
        };

        await putItem(messageItem);

        log.info('Message scheduled', { eventId, messageId, scheduleArn: scheduleResult.ScheduleArn });

        return createdResponse(messageItem);

    } catch (error) {
        log.error('Failed to schedule message', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
