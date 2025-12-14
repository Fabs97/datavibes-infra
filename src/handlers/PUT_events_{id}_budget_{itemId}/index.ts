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
    BudgetItemSchema,
    type Budget,
} from '../../shared';

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    const itemId = getPathParam(event, 'itemId');

    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }
    if (!itemId) {
        return badRequestResponse('Item ID is required');
    }

    log.info('Updating budget item', { eventId, itemId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body (partial update)
        const validation = BudgetItemSchema.partial().safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Get event with budget
        const existing = await getItem<{ budget?: Budget }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const budget = existing.budget ?? { total: 0, items: [] };
        const itemIndex = budget.items.findIndex((i) => i.id === itemId);

        if (itemIndex === -1) {
            return notFoundResponse('Budget item not found');
        }

        const data = validation.data;

        // Update budget item
        const updatedItems = [...budget.items];
        const existingItem = updatedItems[itemIndex];
        if (existingItem) {
            updatedItems[itemIndex] = {
                ...existingItem,
                ...data,
                id: itemId, // Ensure ID stays the same
            };
        }

        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            budget: {
                ...budget,
                items: updatedItems,
            },
            updatedAt: new Date().toISOString(),
        });

        log.info('Budget item updated', { eventId, itemId });

        return successResponse(updatedItems[itemIndex]);
    } catch (error) {
        log.error('Failed to update budget item', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
