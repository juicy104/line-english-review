import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, CardProgressStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LineMessagingClientService } from '../../infrastructure/line/line-messaging-client.service';

type DeliverDueCardsInput = {
  dryRun?: boolean;
};

@Injectable()
export class DeliverDueCardsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly lineMessagingClient: LineMessagingClientService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: DeliverDueCardsInput = {}) {
    const now = new Date();
    const snoozeMinutes = Number(
      this.configService.get<string>('DELIVERY_SNOOZE_MINUTES') ?? 60,
    );
    const nextDueAt = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
    const accounts = await this.prisma.authAccount.findMany({
      where: { provider: AuthProvider.LINE },
      orderBy: { createdAt: 'asc' },
    });
    const results: Array<{
      userId: string;
      lineUserId: string;
      cardId?: string;
      status: 'sent' | 'dry_run' | 'skipped' | 'failed';
      reason?: string;
    }> = [];

    for (const account of accounts) {
      const progress = await this.findOrCreateDueProgress(account.userId, now);

      if (!progress) {
        results.push({
          userId: account.userId,
          lineUserId: account.providerUserId,
          status: 'skipped',
          reason: 'no_due_card',
        });
        continue;
      }

      try {
        if (!input.dryRun) {
          await this.lineMessagingClient.pushText(
            account.providerUserId,
            formatReviewMessage(progress.card),
          );

          await this.prisma.cardProgress.update({
            where: { id: progress.id },
            data: {
              status: CardProgressStatus.ASKED,
              askedAt: now,
              answeredAt: null,
              dueAt: nextDueAt,
            },
          });
        }

        results.push({
          userId: account.userId,
          lineUserId: account.providerUserId,
          cardId: progress.cardId,
          status: input.dryRun ? 'dry_run' : 'sent',
        });
      } catch (error) {
        results.push({
          userId: account.userId,
          lineUserId: account.providerUserId,
          cardId: progress.cardId,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    return {
      checked: accounts.length,
      sent: results.filter((result) => result.status === 'sent').length,
      dryRun: results.filter((result) => result.status === 'dry_run').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    };
  }

  private async findOrCreateDueProgress(userId: string, now: Date) {
    const progress = await this.prisma.cardProgress.findFirst({
      where: {
        userId,
        status: CardProgressStatus.QUEUED,
        dueAt: { lte: now },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: { card: true },
    });

    if (progress) {
      return progress;
    }

    const cardWithoutProgress = await this.prisma.card.findFirst({
      where: {
        deck: { userId },
        progress: {
          none: { userId },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!cardWithoutProgress) {
      return undefined;
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
}

function formatReviewMessage(card: { front: string }) {
  return `復習: ${card.front}`;
}
