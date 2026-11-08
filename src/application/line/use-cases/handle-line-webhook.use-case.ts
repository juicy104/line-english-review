import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, CardProgressStatus } from '@prisma/client';
import { LineMessagingClientService } from '../../../infrastructure/line/line-messaging-client.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  INTERRUPTED_REVIEW_EXPIRATION_MS,
  MASTERED_INTERVAL_DAYS,
} from '../review-schedule.constants';
import { LineWebhookPayloadDto } from '../dto/line-webhook-payload.dto';

@Injectable()
export class HandleLineWebhookUseCase {
  private readonly logger = new Logger(HandleLineWebhookUseCase.name);

  constructor(
    private readonly configService: ConfigService,
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
      (payload.events ?? []).map((event) => this.handleEvent(event)),
    );
  }

  private async handleEvent(event: {
    type: string;
    replyToken?: string;
    source?: { userId?: string };
    message?: { type?: string; text?: string };
    postback?: { data?: string };
  }) {
    if (event.type === 'message') {
      await this.handleMessage(event);
      return;
    }

    await this.handlePostback(event);
  }

  private async handleMessage(event: {
    type: string;
    replyToken?: string;
    source?: { userId?: string };
    message?: { type?: string; text?: string };
  }) {
    if (
      event.message?.type !== 'text' ||
      event.message.text?.trim() !== '復習する' ||
      !event.replyToken
    ) {
      return;
    }

    await this.replyNextReviewCard(event.replyToken, event.source?.userId);
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
    if (action === 'request_review') {
      await this.replyNextReviewCard(event.replyToken, event.source?.userId);
      return;
    }

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

    const now = new Date();
    if (this.isExpiredPostback(data.get('expiresAt'), progress, now)) {
      await this.lineMessagingClient.replyText(
        event.replyToken,
        'この復習カードの有効期限が過ぎています。もう一度「復習する」から開き直してください。',
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
        answeredAt: now,
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

  private async replyNextReviewCard(
    replyToken: string,
    lineUserId: string | undefined,
  ) {
    if (!lineUserId) {
      return;
    }

    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.LINE,
          providerUserId: lineUserId,
        },
      },
      include: { user: { select: { deliveryDeckId: true } } },
    });

    if (!account) {
      await this.lineMessagingClient.replyText(
        replyToken,
        'LINEユーザーを確認できませんでした。もう一度試してください。',
      );
      return;
    }

    const now = new Date();
    await this.resetStaleInterruptedProgress(account.userId, now);

    const progress = await this.findOrCreateDueProgress(
      account.userId,
      now,
      account.user.deliveryDeckId,
    );
    if (!progress) {
      await this.lineMessagingClient.replyText(
        replyToken,
        '今は復習するカードがありません。',
      );
      return;
    }

    const snoozeMinutes = Number(
      this.configService.get<string>('DELIVERY_SNOOZE_MINUTES') ?? 60,
    );
    const nextDueAt = new Date(now.getTime() + snoozeMinutes * 60 * 1000);

    await this.prisma.cardProgress.update({
      where: { id: progress.id },
      data: {
        status: CardProgressStatus.ASKED,
        askedAt: now,
        answeredAt: null,
        dueAt: nextDueAt,
      },
    });

    await this.lineMessagingClient.replyReviewCard(replyToken, {
      progressId: progress.id,
      front: progress.card.front,
    });
  }

  private async findOrCreateDueProgress(
    userId: string,
    now: Date,
    deckId: string | null,
  ) {
    const cardFilter = { deck: { userId }, ...(deckId ? { deckId } : {}) };
    const progress = await this.prisma.cardProgress.findFirst({
      where: {
        userId,
        status: CardProgressStatus.QUEUED,
        dueAt: { lte: now },
        intervalDays: { not: MASTERED_INTERVAL_DAYS },
        card: cardFilter,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: { card: true },
    });

    if (progress) {
      return progress;
    }

    const cardWithoutProgress = await this.prisma.card.findFirst({
      where: {
        ...cardFilter,
        progress: {
          none: { userId },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!cardWithoutProgress) {
      return this.prisma.cardProgress.findFirst({
        where: {
          userId,
          status: CardProgressStatus.QUEUED,
          dueAt: { lte: now },
          intervalDays: MASTERED_INTERVAL_DAYS,
          card: cardFilter,
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        include: { card: true },
      });
    }

    return this.prisma.cardProgress.create({
      data: {
        userId,
        cardId: cardWithoutProgress.id,
        status: CardProgressStatus.QUEUED,
        dueAt: now,
      },
      include: { card: true },
    });
  }

  private isExpiredPostback(
    expiresAt: string | null,
    progress: {
      askedAt: Date | null;
      answeredAt: Date | null;
    },
    now: Date,
  ) {
    if (expiresAt) {
      const expiresAtDate = new Date(expiresAt);
      return Number.isNaN(expiresAtDate.getTime()) || expiresAtDate <= now;
    }

    const touchedAt = progress.answeredAt ?? progress.askedAt;
    if (!touchedAt) {
      return false;
    }

    return (
      touchedAt.getTime() <= now.getTime() - INTERRUPTED_REVIEW_EXPIRATION_MS
    );
  }

  private async resetStaleInterruptedProgress(userId: string, now: Date) {
    const staleBefore = new Date(
      now.getTime() - INTERRUPTED_REVIEW_EXPIRATION_MS,
    );

    await this.prisma.cardProgress.updateMany({
      where: {
        userId,
        status: {
          in: [CardProgressStatus.ASKED, CardProgressStatus.ANSWERED],
        },
        updatedAt: { lte: staleBefore },
      },
      data: {
        status: CardProgressStatus.QUEUED,
        dueAt: now,
      },
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
