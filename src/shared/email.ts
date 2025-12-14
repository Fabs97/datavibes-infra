import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({});

// Default sender address - must be verified in SES
const DEFAULT_FROM_EMAIL = "notifications@datavibes.datareply.de";

export async function sendEmail(to: string, subject: string, body: string) {
    try {
        const command = new SendEmailCommand({
            Source: DEFAULT_FROM_EMAIL,
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: "UTF-8",
                },
                Body: {
                    Text: {
                        Data: body,
                        Charset: "UTF-8",
                    },
                    Html: {
                        Data: body.replace(/\n/g, "<br>"), // Simple conversion for now
                        Charset: "UTF-8",
                    },
                },
            },
        });

        await sesClient.send(command);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
