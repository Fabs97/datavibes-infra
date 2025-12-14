import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    createRequestLogger,
    successResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    getItem,
    updateItem,
    pk,
    sk,
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

    log.info('Closing poll', { eventId, pollId });

    try {
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
            return badRequestResponse('Poll is already closed');
        }

        // Close the poll
        const updatedPolls = [...polls];
        const updatedPoll = updatedPolls[pollIndex];
        if (updatedPoll) {
            updatedPoll.isActive = false;
            updatedPoll.closesAt = new Date().toISOString();
        }

        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            polls: updatedPolls,
            updatedAt: new Date().toISOString(),
        });

        log.info('Poll closed', { eventId, pollId });

        return successResponse({
            pollId,
            closed: true,
            poll: updatedPolls[pollIndex],
        });
    } catch (error) {
        log.error('Failed to close poll', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
