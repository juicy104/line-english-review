import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LineTextMessage = {
  type: 'text';
  text: string;
};

type LineFlexMessage = {
  type: 'flex';
  altText: string;
  contents: Record<string, unknown>;
};

type LineMessage = LineTextMessage | LineFlexMessage;

@Injectable()
export class LineMessagingClientService {
  constructor(private readonly configService: ConfigService) {}

  async pushReviewCard(
    to: string,
    card: { progressId: string; front: string },
  ): Promise<void> {
    await this.pushMessages(to, [
      {
        type: 'flex',
        altText: `復習: ${card.front}`,
        contents: buildReviewCardBubble(card),
      },
    ]);
  }

  async replyText(replyToken: string, text: string): Promise<void> {
    await this.sendLineRequest('https://api.line.me/v2/bot/message/reply', {
      replyToken,
      messages: [{ type: 'text', text }],
    });
  }

  private async pushMessages(
    to: string,
    messages: LineMessage[],
  ): Promise<void> {
    await this.sendLineRequest('https://api.line.me/v2/bot/message/push', {
      to,
      messages,
    });
  }

  private async sendLineRequest(url: string, body: unknown): Promise<void> {
    const channelAccessToken =
      this.configService.get<string>('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN') ||
      this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');

    if (!channelAccessToken) {
      throw new ServiceUnavailableException(
        'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured',
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `LINE request failed: ${response.status} ${await response.text()}`,
      );
    }
  }
}

function buildReviewCardBubble(card: { progressId: string; front: string }) {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      contents: [
        {
          type: 'text',
          text: '復習',
          size: 'sm',
          color: '#6b7280',
          weight: 'bold',
        },
        {
          type: 'text',
          text: card.front,
          size: 'xxl',
          weight: 'bold',
          wrap: true,
          color: '#111827',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#2563eb',
          action: {
            type: 'postback',
            label: '答えを見る',
            data: `action=show_answer&progressId=${card.progressId}`,
            displayText: '答えを見る',
          },
        },
      ],
    },
  };
}
