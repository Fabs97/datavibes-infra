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
    deleteItem,
    batchDeleteItems,
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

    log.info('Deleting event', { eventId });

    try {
        // Check event exists
        const existing = await getItem<Record<string, unknown>>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const eventPK = pk('EVENT', eventId);

        // Get all related items to delete
        const [attendees, polls, media, messages, budgetItems, vendors] = await Promise.all([
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.ATTENDEE}#` }),
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.POLL}#` }),
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.MEDIA}#` }),
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.MESSAGE}#` }),
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.BUDGET}#` }),
            queryItems<{ PK: string; SK: string }>(eventPK, { skPrefix: `${KEYS.VENDOR}#` }),
        ]);

        // Collect all items to delete
        const itemsToDelete = [
            { pk: eventPK, sk: sk('METADATA') },
            ...attendees.map((a) => ({ pk: a.PK, sk: a.SK })),
            ...polls.map((p) => ({ pk: p.PK, sk: p.SK })),
            ...media.map((m) => ({ pk: m.PK, sk: m.SK })),
            ...messages.map((m) => ({ pk: m.PK, sk: m.SK })),
            ...budgetItems.map((b) => ({ pk: b.PK, sk: b.SK })),
            ...vendors.map((v) => ({ pk: v.PK, sk: v.SK })),
        ];

        log.info('Deleting event and related items', {
            eventId,
            totalItems: itemsToDelete.length,
        });

        // Delete all items in batches
        await batchDeleteItems(itemsToDelete);

        log.info('Event deleted', { eventId });
        return successResponse({ deleted: true, eventId });
    } catch (error) {
        log.error('Failed to delete event', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
