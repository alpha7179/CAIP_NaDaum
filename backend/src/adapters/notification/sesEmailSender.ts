// AWS SES v2 기반 EmailSender 구현

import {
  SESv2Client,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';

import type { EmailSender } from './EmailNotificationAdapter.js';

export interface SesEmailSenderOptions {
  readonly fromAddress: string;
  readonly region?: string;
}

export function createSesEmailSender(options: SesEmailSenderOptions): EmailSender {
  const client = new SESv2Client(
    options.region !== undefined && options.region.length > 0
      ? { region: options.region }
      : {},
  );
  return {
    async send({ to, subject, body }): Promise<void> {
      await client.send(
        new SendEmailCommand({
          FromEmailAddress: options.fromAddress,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Text: { Data: body, Charset: 'UTF-8' } },
            },
          },
        }),
      );
    },
  };
}
