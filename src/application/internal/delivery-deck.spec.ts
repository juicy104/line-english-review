import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LineMessagingClientService } from '../../infrastructure/line/line-messaging-client.service';
import { HandleLineWebhookUseCase } from '../line/use-cases/handle-line-webhook.use-case';
import { MASTERED_INTERVAL_DAYS } from '../line/review-schedule.constants';
import { DeliverDueCardsService } from './deliver-due-cards.service';

type Candidate = {
  id: string;
  deckId: string;
  front: string;
  intervalDays?: number;
};

function setup(
  deckId: string | null,
  progress: Candidate[],
  unseen: Candidate[] = [],
) {
  const account = {
    userId: 'owner',
    providerUserId: 'line-user',
    user: { deliveryDeckId: deckId, createdAt: new Date() },
  };
  const toProgress = (card: Candidate) => ({
    id: 'progress-' + card.id,
    cardId: card.id,
    card,
  });
  const prisma = {
    authAccount: {
      findMany: jest.fn().mockResolvedValue([account]),
      findUnique: jest.fn().mockResolvedValue(account),
      upsert: jest.fn().mockResolvedValue(account),
    },
    cardProgress: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: {
            card: { deckId?: string };
            intervalDays: number | { not: number };
          };
        }) => {
          const candidate = progress.find(
            (card) =>
              (!where.card?.deckId || card.deckId === where.card.deckId) &&
              (typeof where.intervalDays === 'number'
                ? card.intervalDays === where.intervalDays
                : card.intervalDays !== where.intervalDays.not),
          );
          return candidate ? toProgress(candidate) : null;
        },
      ),
      create: jest.fn(async ({ data }: { data: { cardId: string } }) =>
        toProgress(unseen.find((card) => card.id === data.cardId)!),
      ),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    card: {
      findFirst: jest.fn(
        async ({ where }: { where: { deckId?: string } }) =>
          unseen.find(
            (card) => !where.deckId || card.deckId === where.deckId,
          ) ?? null,
      ),
    },
  };
  const line = {
    pushReviewCard: jest.fn(),
    replyReviewCard: jest.fn(),
    replyText: jest.fn(),
  };
  const config = { get: () => '60' } as unknown as ConfigService;
  return {
    line,
    run: async (mode: string) => {
      if (mode === 'scheduled') {
        return new DeliverDueCardsService(
          config,
          line as unknown as LineMessagingClientService,
          prisma as unknown as PrismaService,
        ).execute();
      }
      return new HandleLineWebhookUseCase(
        config,
        line as unknown as LineMessagingClientService,
        prisma as unknown as PrismaService,
      ).execute({
        events: [
          {
            type: 'message',
            replyToken: 'reply-token',
            source: { type: 'user', userId: 'line-user' },
            message: { type: 'text', text: '復習する' },
          },
        ],
      });
    },
  };
}

describe.each(['scheduled', 'manual'])(
  '%s LINE delivery deck selection',
  (mode) => {
    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    const outside = { id: 'outside', deckId: 'other', front: 'other deck' };
    const selected = {
      id: 'inside',
      deckId: 'selected',
      front: 'selected deck',
    };

    const sentCard = (line: ReturnType<typeof setup>['line']) =>
      mode === 'scheduled' ? line.pushReviewCard : line.replyReviewCard;

    it('sends a due card only from the pinned deck', async () => {
      const { run, line } = setup('selected', [outside, selected]);
      await run(mode);
      expect(sentCard(line)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ front: 'selected deck' }),
      );
    });

    it('creates progress only for an unseen card in the pinned deck', async () => {
      const { run, line } = setup('selected', [], [outside, selected]);
      await run(mode);
      expect(sentCard(line)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ front: 'selected deck' }),
      );
    });

    it('limits the mastered-card fallback to the pinned deck', async () => {
      const { run, line } = setup(
        'selected',
        [outside, selected].map((card) => ({
          ...card,
          intervalDays: MASTERED_INTERVAL_DAYS,
        })),
      );
      await run(mode);
      expect(sentCard(line)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ front: 'selected deck' }),
      );
    });

    it('does not fall back to any other deck when the pinned deck has no eligible cards', async () => {
      const { run, line } = setup(
        'empty',
        [outside, { ...selected, intervalDays: MASTERED_INTERVAL_DAYS }],
        [selected],
      );
      const result = await run(mode);
      expect(sentCard(line)).not.toHaveBeenCalled();
      if (mode === 'scheduled')
        expect(result).toEqual(
          expect.objectContaining({ skipped: 1, sent: 0 }),
        );
      else
        expect(line.replyText).toHaveBeenCalledWith(
          'reply-token',
          '今は復習するカードがありません。',
        );
    });

    it('keeps all decks eligible when the setting is cleared', async () => {
      const { run, line } = setup(null, [outside, selected]);
      await run(mode);
      expect(sentCard(line)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ front: 'other deck' }),
      );
    });
  },
);
