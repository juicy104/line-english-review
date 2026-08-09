import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LineTextMessage = {
  type: 'text';
  text: string;
};

@Injectable()
export class LineMessagingClientService {
  constructor(private readonly configService: ConfigService) {}

  async pushText(to: string, text: string): Promise<void> {
    const channelAccessToken =
      this.configService.get<string>('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN') ||
      this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');

    if (!channelAccessToken) {
      throw new ServiceUnavailableException(
        'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured',
      );
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: 'text',
            text,
          } satisfies LineTextMessage,
        ],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `LINE push failed: ${response.status} ${await response.text()}`,
      );
    }
  }
}
