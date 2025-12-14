import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    createRequestLogger,
    successResponse,
    internalErrorResponse,
    queryItems,
    pk,
    sk,
    KEYS,
} from '../../shared';

interface EventItem {
    PK: string;
    SK: string;
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    startDate: string;
    endDate?: string;
    location: string;
    isVirtual: boolean;
    virtualLink?: string;
    capacity: number;
    waitlistEnabled: boolean;
    hasVotingEnabled: boolean;
    budget: { total: number; items: unknown[] };
    vendors: unknown[];
    coverImage?: string;
    slackChannel?: string;
    calendarEventId?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    GSI1PK?: string;
    GSI1SK?: string;
}

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    log.info('Listing events', {
        queryParams: event.queryStringParameters,
    });

    try {
        // Query all events - in a real app, you'd paginate and filter
        // For now, scan with a filter on the SK=METADATA pattern
        const statusFilter = event.queryStringParameters?.status;
        const categoryFilter = event.queryStringParameters?.category;

        // Query using GSI1 if filtering by status, otherwise scan events
        let events: EventItem[];

        if (statusFilter) {
            // Query by status using GSI1
            events = await queryItems<EventItem>(pk('STATUS', statusFilter), {
                indexName: 'GSI1',
            });
        } else {
            // We need to get all events - use a scan-like approach
            // In production, you'd implement pagination
            // For now, query with a begins_with on PK pattern
            const { docClient, TABLE_NAME } = await import('../../shared/dynamodb');
            const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');

            const result = await docClient.send(
                new ScanCommand({
                    TableName: TABLE_NAME,
                    FilterExpression: 'SK = :metadata AND begins_with(PK, :eventPrefix)',
                    ExpressionAttributeValues: {
                        ':metadata': KEYS.METADATA,
                        ':eventPrefix': `${KEYS.EVENT}#`,
                    },
                })
            );
            events = (result.Items as EventItem[]) ?? [];
        }

        // Apply category filter if present
        if (categoryFilter) {
            events = events.filter((e) => e.category === categoryFilter);
        }

        // Transform to API response format (remove DynamoDB keys)
        const response = events.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            status: item.status,
            startDate: item.startDate,
            endDate: item.endDate,
            location: item.location,
            isVirtual: item.isVirtual,
            virtualLink: item.virtualLink,
            capacity: item.capacity,
            waitlistEnabled: item.waitlistEnabled,
            hasVotingEnabled: item.hasVotingEnabled,
            budget: item.budget,
            vendors: item.vendors,
            coverImage: item.coverImage,
            slackChannel: item.slackChannel,
            calendarEventId: item.calendarEventId,
            createdBy: item.createdBy,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            // Nested data will be fetched separately or lazily
            attendees: [],
            polls: [],
            media: [],
            scheduledMessages: [],
        }));

        log.info('Returning events', { count: response.length });
        return successResponse({ events: response });
    } catch (error) {
        log.error('Failed to list events', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
