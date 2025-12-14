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
    CreateVendorRequestSchema,
    type Vendor,
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

    log.info('Adding vendor', { eventId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body
        const validation = CreateVendorRequestSchema.safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Check event exists
        const existing = await getItem<{ vendors?: Vendor[] }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const data = validation.data;
        const vendorId = uuidv4();

        // Add vendor with generated ID
        const newVendor: Vendor = {
            id: vendorId,
            name: data.name,
            category: data.category,
            contact: data.contact,
            cost: data.cost,
            status: data.status,
            notes: data.notes,
        };

        // Update event vendors
        const currentVendors = existing.vendors ?? [];
        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            vendors: [...currentVendors, newVendor],
            updatedAt: new Date().toISOString(),
        });

        log.info('Vendor added', { eventId, vendorId });

        return createdResponse(newVendor);
    } catch (error) {
        log.error('Failed to add vendor', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
