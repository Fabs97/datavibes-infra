import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
    createRequestLogger,
    createdResponse,
    badRequestResponse,
    internalErrorResponse,
    parseBody,
    putItem,
    pk,
    sk,
    KEYS,
    CreateEventRequestSchema,
} from '../../shared';

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    log.info('Creating event');

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = CreateEventRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        const data = validation.data;
        const now = new Date().toISOString();
        const eventId = uuidv4();

        // Create event item
        const eventItem = {
            PK: pk('EVENT', eventId),
            SK: sk('METADATA'),
            GSI1PK: pk('STATUS', data.status),
            GSI1SK: `${KEYS.DATE}#${data.startDate}`,
            id: eventId,
            title: data.title,
            description: data.description,
            category: data.category,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location,
            isVirtual: data.isVirtual,
            virtualLink: data.virtualLink,
            capacity: data.capacity,
            waitlistEnabled: data.waitlistEnabled,
            hasVotingEnabled: data.hasVotingEnabled,
            budget: data.budget,
            vendors: data.vendors,
            polls: data.polls,
            coverImage: data.coverImage,
            slackChannel: data.slackChannel,
            calendarEventId: data.calendarEventId,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
        };

        await putItem(eventItem);

        log.info('Event created', { eventId });

        // Return full event object
        const response = {
            id: eventId,
            title: data.title,
            description: data.description,
            category: data.category,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location,
            isVirtual: data.isVirtual,
            virtualLink: data.virtualLink,
            capacity: data.capacity,
            waitlistEnabled: data.waitlistEnabled,
            hasVotingEnabled: data.hasVotingEnabled,
            budget: data.budget,
            vendors: data.vendors,
            polls: data.polls,
            coverImage: data.coverImage,
            slackChannel: data.slackChannel,
            calendarEventId: data.calendarEventId,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
            attendees: [],
            media: [],
            scheduledMessages: [],
        };

        return createdResponse(response);
    } catch (error) {
        log.error('Failed to create event', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
