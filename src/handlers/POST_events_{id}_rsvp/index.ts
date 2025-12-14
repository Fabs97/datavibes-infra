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
    putItem,
    pk,
    sk,
    RSVPRequestSchema,
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

    log.info('Updating RSVP', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = RSVPRequestSchema.safeParse(body);
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

        // Check capacity and waitlist
        const capacity = existing.capacity as number;
        const waitlistEnabled = existing.waitlistEnabled as boolean;

        // Get current attendee count
        const { queryItems, KEYS } = await import('../../shared');
        const attendees = await queryItems<{ status: string }>(
            pk('EVENT', eventId),
            { skPrefix: `${KEYS.ATTENDEE}#` }
        );

        const goingCount = attendees.filter((a) => a.status === 'going').length;
        let finalStatus = data.status;

        // If trying to RSVP as 'going' but capacity is full
        if (data.status === 'going' && goingCount >= capacity && waitlistEnabled) {
            finalStatus = 'waitlist';
            log.info('Event at capacity, adding to waitlist', { eventId, userId: data.userId });
        }

        // Create/update attendee item
        const attendeeItem = {
            PK: pk('EVENT', eventId),
            SK: sk('ATTENDEE', data.userId),
            GSI1PK: pk('USER', data.userId),
            GSI1SK: pk('EVENT', eventId),
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
            avatar: data.userAvatar,
            status: finalStatus,
            respondedAt: now,
        };

        await putItem(attendeeItem);

        log.info('RSVP updated', {
            eventId,
            userId: data.userId,
            status: finalStatus,
        });

        return successResponse({
            eventId,
            userId: data.userId,
            status: finalStatus,
            respondedAt: now,
            wasWaitlisted: finalStatus === 'waitlist' && data.status === 'going',
        });
    } catch (error) {
        log.error('Failed to update RSVP', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
