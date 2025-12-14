// Re-export all shared utilities
export { logger, createRequestLogger } from './logger';
export * from './dynamodb';
export * from './schemas';

// Common response helpers
export interface ApiResponse<T = unknown> {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function jsonResponse<T>(statusCode: number, data: T): ApiResponse<T> {
    return {
        statusCode,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(data),
    };
}

export function successResponse<T>(data: T): ApiResponse<T> {
    return jsonResponse(200, data);
}

export function createdResponse<T>(data: T): ApiResponse<T> {
    return jsonResponse(201, data);
}

export function errorResponse(statusCode: number, message: string): ApiResponse<{ error: string }> {
    return jsonResponse(statusCode, { error: message });
}

export function badRequestResponse(message: string): ApiResponse<{ error: string }> {
    return errorResponse(400, message);
}

export function notFoundResponse(message = 'Not found'): ApiResponse<{ error: string }> {
    return errorResponse(404, message);
}

export function internalErrorResponse(message = 'Internal server error'): ApiResponse<{ error: string }> {
    return errorResponse(500, message);
}

// Parse path parameters from event
export function getPathParam(event: { pathParameters?: Record<string, string | undefined> | null }, name: string): string | null {
    return event.pathParameters?.[name] ?? null;
}

// Parse and validate JSON body
export function parseBody<T>(body: string | null): T | null {
    if (!body) return null;
    try {
        return JSON.parse(body) as T;
    } catch {
        return null;
    }
}
