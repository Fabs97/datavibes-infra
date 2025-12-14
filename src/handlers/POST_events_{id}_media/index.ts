import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    createRequestLogger,
    createdResponse,
    badRequestResponse,
    notFoundResponse,
    internalErrorResponse,
    getPathParam,
    parseBody,
    getItem,
    putItem,
    pk,
    sk,
    CreateMediaRequestSchema,
} from '../../shared';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION_NAME ?? 'eu-central-1',
});

const MEDIA_BUCKET = process.env.MEDIA_BUCKET ?? 'datavibes-dev-media';
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }

    log.info('Generating presigned URL for media upload', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = CreateMediaRequestSchema.safeParse(body);
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
        const mediaId = uuidv4();
        const now = new Date().toISOString();

        // Generate S3 key with proper path structure
        const s3Key = `events/${eventId}/media/${mediaId}/${data.fileName}`;

        // Generate presigned URL for PUT (upload)
        const putCommand = new PutObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: s3Key,
            ContentType: data.contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, putCommand, {
            expiresIn: PRESIGNED_URL_EXPIRY,
        });

        // The public URL for accessing the file after upload
        const url = `https://${MEDIA_BUCKET}.s3.${process.env.AWS_REGION_NAME ?? 'eu-central-1'}.amazonaws.com/${s3Key}`;

        // Create media item in DynamoDB (status: pending until upload confirmed)
        const mediaItem = {
            PK: pk('EVENT', eventId),
            SK: sk('MEDIA', mediaId),
            id: mediaId,
            url,
            type: data.type,
            uploadedBy: data.uploadedBy,
            uploadedAt: now,
            caption: data.caption,
            s3Key,
            s3Bucket: MEDIA_BUCKET,
            contentType: data.contentType,
            fileName: data.fileName,
            uploadStatus: 'pending', // Can be updated to 'completed' when frontend confirms
        };

        await putItem(mediaItem);

        log.info('Presigned URL generated', { eventId, mediaId, expiresIn: PRESIGNED_URL_EXPIRY });

        // Return the presigned upload URL and media metadata
        return createdResponse({
            id: mediaId,
            uploadUrl, // Frontend uses this to PUT the file directly to S3
            url, // Final URL after upload is complete
            type: data.type,
            uploadedBy: data.uploadedBy,
            uploadedAt: now,
            caption: data.caption,
            expiresIn: PRESIGNED_URL_EXPIRY,
        });
    } catch (error) {
        log.error('Failed to generate presigned URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
