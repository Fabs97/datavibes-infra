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
    KEYS,
    CreatePollRequestSchema,
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

    log.info('Creating poll', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = CreatePollRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Check event exists
        const existing = await getItem<{ polls?: unknown[] }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const data = validation.data;
        const pollId = uuidv4();

        // Add poll with generated ID
        const newPoll = {
            id: pollId,
            question: data.question,
            type: data.type,
            options: data.options.map((opt) => ({
                ...opt,
                id: opt.id || uuidv4(),
            })),
            isActive: data.isActive,
            closesAt: data.closesAt,
        };

        // Update event with new poll
        const currentPolls = (existing.polls as unknown[]) ?? [];
        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            polls: [...currentPolls, newPoll],
            hasVotingEnabled: true,
            updatedAt: new Date().toISOString(),
        });

        log.info('Poll created', { eventId, pollId });

        return createdResponse(newPoll);
    } catch (error) {
        log.error('Failed to create poll', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
