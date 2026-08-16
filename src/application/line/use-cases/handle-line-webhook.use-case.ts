import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, CardProgressStatus } from '@prisma/client';
import { LineMessagingClientService } from '../../../infrastructure/line/line-messaging-client.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MASTERED_INTERVAL_DAYS } from '../review-schedule.constants';
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
    const action = data.get('action');
    if (action !== 'show_answer' && action !== 'record_review') {
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

    if (action === 'record_review') {
      await this.recordReviewResult(
        event.replyToken,
        progress.id,
        data.get('grade'),
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

    await this.lineMessagingClient.replyAnswerCard(event.replyToken, {
      progressId: progress.id,
      front: progress.card.front,
      back: progress.card.back,
      example: progress.card.example,
      note: progress.card.note,
    });
  }

  private async recordReviewResult(
    replyToken: string,
    progressId: string,
    grade: string | null,
  ) {
    const now = new Date();
    const schedule = toReviewSchedule(grade, now);

    await this.prisma.cardProgress.update({
      where: { id: progressId },
      data: {
        status: CardProgressStatus.QUEUED,
        dueAt: schedule.dueAt,
        intervalDays: schedule.intervalDays,
        lastReviewedAt: now,
        reviewCount: { increment: 1 },
      },
    });

    await this.lineMessagingClient.replyText(replyToken, schedule.message);
  }
}

function toReviewSchedule(grade: string | null, now: Date) {
  if (grade === 'perfect') {
    return {
      dueAt: now,
      intervalDays: MASTERED_INTERVAL_DAYS,
      message: '完璧です。他のカードを優先します。',
    };
  }

  if (grade === 'good') {
    return {
      dueAt: addDays(now, 3),
      intervalDays: 3,
      message: '次は3日後に出します。',
    };
  }

  return {
    dueAt: addDays(now, 1),
    intervalDays: 1,
    message: '次は明日に出します。',
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
