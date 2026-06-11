// AWS SNS 기반 SmsSender 구현

import {
  SNSClient,
  PublishCommand,
  type MessageAttributeValue,
} from '@aws-sdk/client-sns';

import type { SmsSender } from './SmsNotificationAdapter.js';

export interface SnsSmsSenderOptions {
  readonly region?: string;
  readonly senderId?: string;
  readonly smsType?: 'Transactional' | 'Promotional';
}

export function createSnsSmsSender(options: SnsSmsSenderOptions = {}): SmsSender {
  const client = new SNSClient(
    options.region !== undefined && options.region.length > 0
      ? { region: options.region }
      : {},
  );
  const smsType = options.smsType ?? 'Transactional';
  return {
    async send({ to, message }): Promise<void> {
      const attributes: Record<string, MessageAttributeValue> = {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: smsType },
      };
      if (options.senderId !== undefined && options.senderId.length > 0) {
        attributes['AWS.SNS.SMS.SenderID'] = {
          DataType: 'String',
          StringValue: options.senderId,
        };
      }
      await client.send(
        new PublishCommand({
          PhoneNumber: to,
          Message: message,
          MessageAttributes: attributes,
        }),
      );
    },
  };
}
