import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
    createRequestLogger,
    createdResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    parseBody,
    getItem,
    updateItem,
    pk,
    sk,
    CreateBudgetItemRequestSchema,
    type Budget,
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

    log.info('Adding budget item', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = CreateBudgetItemRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Check event exists
        const existing = await getItem<{ budget?: Budget }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const data = validation.data;
        const itemId = uuidv4();

        // Add budget item with generated ID
        const newItem = {
            id: itemId,
            category: data.category,
            description: data.description,
            estimated: data.estimated,
            actual: data.actual,
        };

        // Update event budget
        const currentBudget = existing.budget ?? { total: 0, items: [] };
        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            budget: {
                ...currentBudget,
                items: [...currentBudget.items, newItem],
            },
            updatedAt: new Date().toISOString(),
        });

        log.info('Budget item added', { eventId, itemId });

        return createdResponse(newItem);
    } catch (error) {
        log.error('Failed to add budget item', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
