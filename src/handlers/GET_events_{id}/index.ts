import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    createRequestLogger,
    successResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    getItem,
    queryItems,
    pk,
    sk,
    KEYS,
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

    log.info('Getting event', { eventId });

    try {
        // Get event metadata
        const eventItem = await getItem<Record<string, unknown>>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!eventItem) {
            return notFoundResponse('Event not found');
        }

        // Get all related items (attendees, polls, media, messages)
        const eventPK = pk('EVENT', eventId);

        const [attendees, polls, media, messages] = await Promise.all([
            queryItems<Record<string, unknown>>(eventPK, { skPrefix: `${KEYS.ATTENDEE}#` }),
            queryItems<Record<string, unknown>>(eventPK, { skPrefix: `${KEYS.POLL}#` }),
            queryItems<Record<string, unknown>>(eventPK, { skPrefix: `${KEYS.MEDIA}#` }),
            queryItems<Record<string, unknown>>(eventPK, { skPrefix: `${KEYS.MESSAGE}#` }),
        ]);

        // Transform to API response
        const response = {
            id: eventItem.id,
            title: eventItem.title,
            description: eventItem.description,
            category: eventItem.category,
            status: eventItem.status,
            startDate: eventItem.startDate,
            endDate: eventItem.endDate,
            location: eventItem.location,
            isVirtual: eventItem.isVirtual,
            virtualLink: eventItem.virtualLink,
            capacity: eventItem.capacity,
            waitlistEnabled: eventItem.waitlistEnabled,
            hasVotingEnabled: eventItem.hasVotingEnabled,
            budget: eventItem.budget,
            vendors: eventItem.vendors,
            polls: eventItem.polls ?? [],
            coverImage: eventItem.coverImage,
            slackChannel: eventItem.slackChannel,
            calendarEventId: eventItem.calendarEventId,
            createdBy: eventItem.createdBy,
            createdAt: eventItem.createdAt,
            updatedAt: eventItem.updatedAt,
            // Nested data from separate items
            attendees: attendees.map((a) => ({
                id: a.id,
                name: a.name,
                email: a.email,
                avatar: a.avatar,
                status: a.status,
                respondedAt: a.respondedAt,
            })),
            media: media.map((m) => ({
                id: m.id,
                url: m.url,
                type: m.type,
                uploadedBy: m.uploadedBy,
                uploadedAt: m.uploadedAt,
                caption: m.caption,
            })),
            scheduledMessages: messages.map((msg) => ({
                id: msg.id,
                eventId: msg.eventId,
                type: msg.type,
                subject: msg.subject,
                content: msg.content,
                channels: msg.channels,
                recipientType: msg.recipientType,
                customRecipients: msg.customRecipients,
                scheduledFor: msg.scheduledFor,
                timezone: msg.timezone,
                pollOptions: msg.pollOptions,
                formFields: msg.formFields,
                status: msg.status,
                sentAt: msg.sentAt,
                errorMessage: msg.errorMessage,
                createdBy: msg.createdBy,
                createdAt: msg.createdAt,
                updatedAt: msg.updatedAt,
            })),
        };

        log.info('Returning event', { eventId });
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get event', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
