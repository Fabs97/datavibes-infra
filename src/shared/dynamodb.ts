import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    BatchWriteCommand,
    type GetCommandInput,
    type PutCommandInput,
    type UpdateCommandInput,
    type DeleteCommandInput,
    type QueryCommandInput,
    type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION_NAME ?? 'eu-central-1',
});

// Create document client with marshalling options
export const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});

// Get table name from environment
export const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'datavibes-dev-table';

// Key prefixes for single-table design
export const KEYS = {
    EVENT: 'EVENT',
    USER: 'USER',
    ATTENDEE: 'ATTENDEE',
    POLL: 'POLL',
    BUDGET: 'BUDGET',
    VENDOR: 'VENDOR',
    MEDIA: 'MEDIA',
    MESSAGE: 'MESSAGE',
    METADATA: 'METADATA',
    STATUS: 'STATUS',
    DATE: 'DATE',
} as const;

// Helper to create composite keys
export function pk(type: keyof typeof KEYS, id: string): string {
    return `${KEYS[type]}#${id}`;
}

export function sk(type: keyof typeof KEYS, id?: string): string {
    return id ? `${KEYS[type]}#${id}` : KEYS[type];
}

// Generic get item
export async function getItem<T>(pk: string, sk: string): Promise<T | null> {
    const result = await docClient.send(
        new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk },
        })
    );
    return (result.Item as T) ?? null;
}

// Generic put item
export async function putItem<T extends Record<string, unknown>>(item: T & { PK: string; SK: string }): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
        })
    );
}

// Generic update with expression builder
export async function updateItem(
    pk: string,
    sk: string,
    updates: Record<string, unknown>
): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value], index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
    });

    await docClient.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        })
    );
}

// Generic delete item
export async function deleteItem(pk: string, sk: string): Promise<void> {
    await docClient.send(
        new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk },
        })
    );
}

// Query items by partition key
export async function queryItems<T>(
    pkValue: string,
    options?: {
        skPrefix?: string;
        skValue?: string;
        indexName?: string;
        limit?: number;
        scanForward?: boolean;
    }
): Promise<T[]> {
    const input: QueryCommandInput = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
            ':pk': pkValue,
        },
        ScanIndexForward: options?.scanForward ?? true,
        Limit: options?.limit,
    };

    if (options?.indexName) {
        input.IndexName = options.indexName;
        input.KeyConditionExpression = 'GSI1PK = :pk';
    }

    if (options?.skPrefix) {
        input.KeyConditionExpression += ' AND begins_with(SK, :skPrefix)';
        input.ExpressionAttributeValues![':skPrefix'] = options.skPrefix;
    } else if (options?.skValue) {
        input.KeyConditionExpression += ' AND SK = :sk';
        input.ExpressionAttributeValues![':sk'] = options.skValue;
    }

    const result = await docClient.send(new QueryCommand(input));
    return (result.Items as T[]) ?? [];
}

// Batch delete items
export async function batchDeleteItems(items: { pk: string; sk: string }[]): Promise<void> {
    // DynamoDB batch write limit is 25 items
    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
        batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
        await docClient.send(
            new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: batch.map((item) => ({
                        DeleteRequest: {
                            Key: { PK: item.pk, SK: item.sk },
                        },
                    })),
                },
            })
        );
    }
}
