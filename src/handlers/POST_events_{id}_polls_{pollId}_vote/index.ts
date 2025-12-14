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
    VoteRequestSchema,
    type Poll,
} from '../../shared';

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    const pollId = getPathParam(event, 'pollId');

    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }
    if (!pollId) {
        return badRequestResponse('Poll ID is required');
    }

    log.info('Voting on poll', { eventId, pollId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = VoteRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Get event with polls
        const existing = await getItem<{ polls?: Poll[] }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const polls = existing.polls ?? [];
        const pollIndex = polls.findIndex((p) => p.id === pollId);

        if (pollIndex === -1) {
            return notFoundResponse('Poll not found');
        }

        const poll = polls[pollIndex];
        if (!poll) {
            return notFoundResponse('Poll not found');
        }

        if (!poll.isActive) {
            return badRequestResponse('Poll is closed');
        }

        const { optionId, userId } = validation.data;

        // Find option
        const optionIndex = poll.options.findIndex((o) => o.id === optionId);
        if (optionIndex === -1) {
            return badRequestResponse('Option not found');
        }

        // Remove previous vote from all options, add new vote
        const updatedOptions = poll.options.map((opt) => ({
            ...opt,
            votes: opt.votes.filter((v) => v !== userId),
        }));

        const option = updatedOptions[optionIndex];
        if (option) {
            option.votes.push(userId);
        }

        // Update poll in array
        const updatedPolls = [...polls];
        const updatedPoll = updatedPolls[pollIndex];
        if (updatedPoll) {
            updatedPoll.options = updatedOptions;
        }

        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            polls: updatedPolls,
            updatedAt: new Date().toISOString(),
        });

        log.info('Vote recorded', { eventId, pollId, optionId, userId });

        return successResponse({
            pollId,
            optionId,
            userId,
            poll: updatedPolls[pollIndex],
        });
    } catch (error) {
        log.error('Failed to vote', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
