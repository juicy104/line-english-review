import { AdminService } from './admin.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('AdminService deck preferences and CSV export', () => {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    deck: {
      findFirstOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    card: { findMany: jest.fn() },
  };
  let service: AdminService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AdminService(prisma as unknown as PrismaService);
    prisma.deck.findFirstOrThrow.mockResolvedValue({ id: 'deck-1' });
  });

  it('persists the selected default deck for the authenticated owner', async () => {
    await expect(service.setDefaultDeck('user-1', 'deck-1')).resolves.toEqual({
      defaultDeckId: 'deck-1',
    });
    expect(prisma.deck.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'deck-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { defaultDeckId: 'deck-1' },
    });
  });

  it('marks the persisted default even when a newer deck appears first', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ defaultDeckId: 'old' });
    prisma.deck.findMany.mockResolvedValue([{ id: 'new' }, { id: 'old' }]);
    await expect(service.listDecks('user-1')).resolves.toEqual([
      { id: 'new', isDefault: false },
      { id: 'old', isDefault: true },
    ]);
  });

  it('uses the saved default when resolving the default deck', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      defaultDeckId: 'deck-1',
    });
    prisma.deck.findFirst.mockResolvedValue({ id: 'deck-1' });
    await expect(service.getOrCreateDefaultDeck('user-1')).resolves.toEqual({
      id: 'deck-1',
    });
    expect(prisma.deck.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', id: 'deck-1' },
      }),
    );
    expect(prisma.deck.create).not.toHaveBeenCalled();
  });

  it.each(['setDefaultDeck', 'exportCardsToCsv'] as const)(
    '%s refuses a deck not owned by the user',
    async (method) => {
      prisma.deck.findFirstOrThrow.mockRejectedValue(new Error('Not found'));
      await expect(service[method]('user-1', 'foreign-deck')).rejects.toThrow(
        'Not found',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.card.findMany).not.toHaveBeenCalled();
    },
  );

  it('exports all four fields and round trips punctuation, Japanese and multiline text through import', async () => {
    const card = {
      front: 'say "hello", friend',
      back: 'こんにちは\n世界',
      example: 'first\r\nsecond',
      note: null,
    };
    prisma.card.findMany.mockResolvedValue([card]);
    const csv = await service.exportCardsToCsv('user-1', 'deck-1');
    expect(csv).toBe(
      '\uFEFF"front","back","example","note"\r\n"say ""hello"", friend","こんにちは\n世界","first\r\nsecond",""\r\n',
    );
    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: { deckId: 'deck-1', deck: { userId: 'user-1' } },
      orderBy: { createdAt: 'desc' },
    });
    const create = jest
      .spyOn(service, 'createCard')
      .mockResolvedValue({} as never);
    await expect(
      service.importCardsFromCsv('user-1', 'deck-1', csv),
    ).resolves.toEqual({ imported: 1, skipped: 0 });
    expect(create).toHaveBeenCalledWith('user-1', {
      deckId: 'deck-1',
      ...card,
      note: undefined,
    });
  });

  it('exports a header for an empty deck', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    await expect(service.exportCardsToCsv('user-1', 'deck-1')).resolves.toBe(
      '\uFEFF"front","back","example","note"\r\n',
    );
  });
});
