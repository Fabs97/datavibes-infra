import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
    createRequestLogger,
    successResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    getItem,
    deleteItem,
    pk,
    sk,
} from '../../shared';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION_NAME ?? 'eu-central-1',
});

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    const mediaId = getPathParam(event, 'mediaId');

    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }
    if (!mediaId) {
        return badRequestResponse('Media ID is required');
    }

    log.info('Deleting media', { eventId, mediaId });

    try {
        // Check event exists
        const eventExists = await getItem<Record<string, unknown>>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!eventExists) {
            return notFoundResponse('Event not found');
        }

        // Check media exists and get S3 info
        const mediaItem = await getItem<{
            s3Key?: string;
            s3Bucket?: string;
        }>(pk('EVENT', eventId), sk('MEDIA', mediaId));

        if (!mediaItem) {
            return notFoundResponse('Media not found');
        }

        // Delete from S3 if we have the key
        if (mediaItem.s3Key && mediaItem.s3Bucket) {
            try {
                await s3Client.send(
                    new DeleteObjectCommand({
                        Bucket: mediaItem.s3Bucket,
                        Key: mediaItem.s3Key,
                    })
                );
                log.info('Deleted from S3', {
                    bucket: mediaItem.s3Bucket,
                    key: mediaItem.s3Key,
                });
            } catch (s3Error) {
                // Log but don't fail - the DynamoDB record is more important
                log.warn('Failed to delete from S3', {
                    error: s3Error instanceof Error ? s3Error.message : String(s3Error),
                    bucket: mediaItem.s3Bucket,
                    key: mediaItem.s3Key,
                });
            }
        }

        // Delete from DynamoDB
        await deleteItem(pk('EVENT', eventId), sk('MEDIA', mediaId));

        log.info('Media deleted', { eventId, mediaId });

        return successResponse({ deleted: true, mediaId });
    } catch (error) {
        log.error('Failed to delete media', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
