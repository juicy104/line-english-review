import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, CardProgressStatus } from '@prisma/client';
import { LineMessagingClientService } from '../../../infrastructure/line/line-messaging-client.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LineWebhookPayloadDto } from '../dto/line-webhook-payload.dto';

@Injectable()
export class HandleLineWebhookUseCase {
  private readonly logger = new Logger(HandleLineWebhookUseCase.name);

  constructor(
    private readonly lineMessagingClient: LineMessagingClientService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(payload: LineWebhookPayloadDto): Promise<void> {
    this.logger.log({
      message: 'Received LINE webhook events',
      eventCount: payload.events?.length ?? 0,
      events: payload.events ?? [],
    });

    const lineUserIds = [
      ...new Set(
        (payload.events ?? [])
          .map((event) => event.source?.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];

    await Promise.all(
      lineUserIds.map(async (lineUserId) => {
        const account = await this.prisma.authAccount.upsert({
          where: {
            provider_providerUserId: {
              provider: AuthProvider.LINE,
              providerUserId: lineUserId,
            },
          },
          update: {},
          create: {
            provider: AuthProvider.LINE,
            providerUserId: lineUserId,
            user: {
              create: {},
            },
          },
          include: {
            user: true,
          },
        });

        this.logger.log({
          message: 'Resolved LINE user',
          lineUserId,
          userId: account.userId,
          createdAt: account.user.createdAt,
        });
      }),
    );

    await Promise.all(
      (payload.events ?? []).map((event) => this.handlePostback(event)),
    );
  }

  private async handlePostback(event: {
    type: string;
    replyToken?: string;
    source?: { userId?: string };
    postback?: { data?: string };
  }) {
    if (event.type !== 'postback' || !event.replyToken) {
      return;
    }

    const data = new URLSearchParams(event.postback?.data ?? '');
    if (data.get('action') !== 'show_answer') {
      return;
    }

    const progressId = data.get('progressId');
    const lineUserId = event.source?.userId;
    if (!progressId || !lineUserId) {
      return;
    }

    const progress = await this.prisma.cardProgress.findFirst({
      where: {
        id: progressId,
        user: {
          authAccounts: {
            some: {
              provider: AuthProvider.LINE,
              providerUserId: lineUserId,
            },
          },
        },
      },
      include: { card: true },
    });

    if (!progress) {
      await this.lineMessagingClient.replyText(
        event.replyToken,
        'この復習カードが見つかりませんでした。',
      );
      return;
    }

    await this.prisma.cardProgress.update({
      where: { id: progress.id },
      data: {
        status: CardProgressStatus.ANSWERED,
        answeredAt: new Date(),
      },
    });

    await this.lineMessagingClient.replyText(
      event.replyToken,
      formatAnswerMessage(progress.card),
    );
  }
}

function formatAnswerMessage(card: {
  front: string;
  back: string;
  example: string | null;
  note: string | null;
}) {
  return [
    `答え: ${card.back}`,
    card.example ? `例文: ${card.example}` : undefined,
    card.note ? `メモ: ${card.note}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}
