import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    createRequestLogger,
    successResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    parseBody,
    getItem,
    updateItem,
    pk,
    sk,
    KEYS,
    UpdateEventRequestSchema,
} from '../../shared';

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }

    log.info('Updating event', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = UpdateEventRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Check event exists
        const existing = await getItem<Record<string, unknown>>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const data = validation.data;
        const now = new Date().toISOString();

        // Build updates object
        const updates: Record<string, unknown> = {
            updatedAt: now,
        };

        // Only include provided fields
        if (data.title !== undefined) updates.title = data.title;
        if (data.description !== undefined) updates.description = data.description;
        if (data.category !== undefined) updates.category = data.category;
        if (data.status !== undefined) {
            updates.status = data.status;
            updates.GSI1PK = pk('STATUS', data.status);
        }
        if (data.startDate !== undefined) {
            updates.startDate = data.startDate;
            updates.GSI1SK = `${KEYS.DATE}#${data.startDate}`;
        }
        if (data.endDate !== undefined) updates.endDate = data.endDate;
        if (data.location !== undefined) updates.location = data.location;
        if (data.isVirtual !== undefined) updates.isVirtual = data.isVirtual;
        if (data.virtualLink !== undefined) updates.virtualLink = data.virtualLink;
        if (data.capacity !== undefined) updates.capacity = data.capacity;
        if (data.waitlistEnabled !== undefined) updates.waitlistEnabled = data.waitlistEnabled;
        if (data.hasVotingEnabled !== undefined) updates.hasVotingEnabled = data.hasVotingEnabled;
        if (data.budget !== undefined) updates.budget = data.budget;
        if (data.vendors !== undefined) updates.vendors = data.vendors;
        if (data.polls !== undefined) updates.polls = data.polls;
        if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
        if (data.slackChannel !== undefined) updates.slackChannel = data.slackChannel;
        if (data.calendarEventId !== undefined) updates.calendarEventId = data.calendarEventId;

        await updateItem(pk('EVENT', eventId), sk('METADATA'), updates);

        log.info('Event updated', { eventId });

        // Return updated event (merge existing with updates)
        const response: Record<string, unknown> = {
            ...existing,
            ...updates,
            id: eventId,
        };

        // Remove DynamoDB-specific fields
        delete response.PK;
        delete response.SK;
        delete response.GSI1PK;
        delete response.GSI1SK;

        return successResponse(response);
    } catch (error) {
        log.error('Failed to update event', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
