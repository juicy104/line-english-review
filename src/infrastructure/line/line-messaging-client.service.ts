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
    await this.replyMessages(replyToken, [{ type: 'text', text }]);
  }

  async replyAnswerCard(
    replyToken: string,
    card: {
      progressId: string;
      front: string;
      back: string;
      example: string | null;
      note: string | null;
    },
  ): Promise<void> {
    await this.replyMessages(replyToken, [
      {
        type: 'flex',
        altText: `答え: ${card.back}`,
        contents: buildAnswerCardBubble(card),
      },
    ]);
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

  private async replyMessages(
    replyToken: string,
    messages: LineMessage[],
  ): Promise<void> {
    await this.sendLineRequest('https://api.line.me/v2/bot/message/reply', {
      replyToken,
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

function buildAnswerCardBubble(card: {
  progressId: string;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
}) {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '答え',
          size: 'sm',
          color: '#6b7280',
          weight: 'bold',
        },
        {
          type: 'text',
          text: card.back,
          size: 'xxl',
          weight: 'bold',
          wrap: true,
          color: '#111827',
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          margin: 'lg',
          contents: [
            buildTextBlock('表', card.front),
            card.example ? buildTextBlock('例文', card.example) : undefined,
            card.note ? buildTextBlock('メモ', card.note) : undefined,
          ].filter(Boolean),
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        buildReviewResultButton(card.progressId, '完璧', 'perfect', '#16a34a'),
        buildReviewResultButton(card.progressId, 'まあまあ', 'good', '#2563eb'),
        buildReviewResultButton(
          card.progressId,
          'もう一回',
          'again',
          '#dc2626',
        ),
      ],
    },
  };
}

function buildTextBlock(label: string, text: string) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'xs',
        color: '#6b7280',
        weight: 'bold',
      },
      {
        type: 'text',
        text,
        size: 'sm',
        color: '#374151',
        wrap: true,
      },
    ],
  };
}

function buildReviewResultButton(
  progressId: string,
  label: string,
  grade: string,
  color: string,
) {
  return {
    type: 'button',
    style: 'primary',
    color,
    action: {
      type: 'postback',
      label,
      data: `action=record_review&progressId=${progressId}&grade=${grade}`,
      displayText: label,
    },
  };
}
