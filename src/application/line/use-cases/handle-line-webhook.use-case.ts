import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LineWebhookPayloadDto } from '../dto/line-webhook-payload.dto';

@Injectable()
export class HandleLineWebhookUseCase {
  private readonly logger = new Logger(HandleLineWebhookUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

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
  }
}
