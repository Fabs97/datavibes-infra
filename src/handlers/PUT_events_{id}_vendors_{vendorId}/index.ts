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
    VendorSchema,
    type Vendor,
} from '../../shared';

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const log = createRequestLogger(context.awsRequestId);

    const eventId = getPathParam(event, 'id');
    const vendorId = getPathParam(event, 'vendorId');

    if (!eventId) {
        return badRequestResponse('Event ID is required');
    }
    if (!vendorId) {
        return badRequestResponse('Vendor ID is required');
    }

    log.info('Updating vendor', { eventId, vendorId });

    try {
        const body = parseBody(event.body);
        if (!body) {
            return badRequestResponse('Request body is required');
        }

        // Validate request body (partial update)
        const validation = VendorSchema.partial().safeParse(body);
        if (!validation.success) {
            log.warn('Validation failed', { errors: validation.error.errors });
            return badRequestResponse(validation.error.errors[0]?.message ?? 'Invalid request');
        }

        // Get event with vendors
        const existing = await getItem<{ vendors?: Vendor[] }>(
            pk('EVENT', eventId),
            sk('METADATA')
        );

        if (!existing) {
            return notFoundResponse('Event not found');
        }

        const vendors = existing.vendors ?? [];
        const vendorIndex = vendors.findIndex((v) => v.id === vendorId);

        if (vendorIndex === -1) {
            return notFoundResponse('Vendor not found');
        }

        const data = validation.data;

        // Update vendor
        const updatedVendors = [...vendors];
        const existingVendor = updatedVendors[vendorIndex];
        if (existingVendor) {
            updatedVendors[vendorIndex] = {
                ...existingVendor,
                ...data,
                id: vendorId, // Ensure ID stays the same
            };
        }

        await updateItem(pk('EVENT', eventId), sk('METADATA'), {
            vendors: updatedVendors,
            updatedAt: new Date().toISOString(),
        });

        log.info('Vendor updated', { eventId, vendorId });

        return successResponse(updatedVendors[vendorIndex]);
    } catch (error) {
        log.error('Failed to update vendor', {
            error: error instanceof Error ? error.message : String(error),
        });
        return internalErrorResponse();
    }
}
