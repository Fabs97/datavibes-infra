import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({});
let cachedSecret: { token: string; channelId: string } | null = null;

async function getSlackCredentials() {
    if (cachedSecret) return cachedSecret;

    const secretArn = process.env.SLACK_SECRET_ARN;
    if (!secretArn) {
        console.warn("SLACK_SECRET_ARN environment variable is not set");
        return null;
    }

    try {
        const command = new GetSecretValueCommand({ SecretId: secretArn });
        const response = await secretsClient.send(command);

        if (response.SecretString) {
            cachedSecret = JSON.parse(response.SecretString);
            return cachedSecret;
        }
    } catch (error) {
        console.error("Error fetching Slack credentials:", error);
    }

    return null;
}

export async function sendSlackNotification(message: string, channel?: string) {
    const credentials = await getSlackCredentials();
    if (!credentials) {
        console.warn("Skipping Slack notification: Credentials not found");
        return;
    }

    const targetChannel = channel || credentials.channelId;
    if (!targetChannel) {
        console.warn("Skipping Slack notification: No channel ID provided");
        return;
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${credentials.token}`,
            },
            body: JSON.stringify({
                channel: targetChannel,
                text: message,
            }),
        });

        const data = await response.json() as { ok: boolean; error?: string };
        if (!data.ok) {
            console.error("Slack API error:", data.error);
        }
    } catch (error) {
        console.error("Error sending Slack notification:", error);
    }
}
