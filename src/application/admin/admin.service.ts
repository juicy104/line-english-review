import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type CreateDeckInput = {
  name: string;
  description?: string;
};

type CreateCardInput = {
  deckId: string;
  front: string;
  back: string;
  example?: string;
  note?: string;
};

type UpdateCardInput = {
  front?: string;
  back?: string;
  example?: string | null;
  note?: string | null;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(userId: string) {
    return this.prisma.user.findMany({
      where: { id: userId },
      include: {
        authAccounts: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { decks: true, progress: true },
        },
      },
    });
  }

  listDecks(userId: string) {
    return this.prisma.deck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });
  }

  async getOrCreateDefaultDeck(userId: string) {
    const existing = await this.prisma.deck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.deck.create({
      data: {
        userId,
        name: 'Default',
      },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });
  }

  createDeck(userId: string, input: CreateDeckInput) {
    return this.prisma.deck.create({
      data: {
        userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });
  }

  listCards(userId: string, deckId: string) {
    return this.prisma.card.findMany({
      where: { deckId, deck: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCard(userId: string, input: CreateCardInput) {
    await this.assertDeckOwner(userId, input.deckId);

    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: this.toCardData(input),
      });

      await tx.cardProgress.create({
        data: {
          userId,
          cardId: card.id,
        },
      });

      return card;
    });
  }

  async importCardsFromCsv(userId: string, deckId: string, csv: string) {
    await this.assertDeckOwner(userId, deckId);

    const rows = parseCsv(csv).filter((row) => !isAnkiMetadataRow(row));

    if (!rows.length) {
      return { imported: 0, skipped: 0 };
    }

    const { indexes, records } = toCsvRecords(rows);
    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      const front = readCell(record, indexes.front);
      const back = readCell(record, indexes.back);

      if (!front || !back) {
        skipped += 1;
        continue;
      }

      await this.createCard(userId, {
        deckId,
        front,
        back,
        example: readCell(record, indexes.example),
        note: readCell(record, indexes.note),
      });
      imported += 1;
    }

    return { imported, skipped };
  }

  async updateCard(userId: string, id: string, input: UpdateCardInput) {
    await this.assertCardOwner(userId, id);

    return this.prisma.card.update({
      where: { id },
      data: {
        ...(input.front !== undefined ? { front: input.front.trim() } : {}),
        ...(input.back !== undefined ? { back: input.back.trim() } : {}),
        ...(input.example !== undefined
          ? { example: input.example?.trim() || null }
          : {}),
        ...(input.note !== undefined
          ? { note: input.note?.trim() || null }
          : {}),
      },
    });
  }

  async deleteCard(userId: string, id: string) {
    await this.assertCardOwner(userId, id);

    return this.prisma.card.delete({
      where: { id },
    });
  }

  private async assertDeckOwner(userId: string, deckId: string) {
    await this.prisma.deck.findFirstOrThrow({
      where: { id: deckId, userId },
      select: { id: true },
    });
  }

  private async assertCardOwner(userId: string, cardId: string) {
    await this.prisma.card.findFirstOrThrow({
      where: { id: cardId, deck: { userId } },
      select: { id: true },
    });
  }

  private toCardData(input: CreateCardInput) {
    return {
      deckId: input.deckId,
      front: input.front.trim(),
      back: input.back.trim(),
      example: input.example?.trim() || null,
      note: input.note?.trim() || null,
    };
  }
}

function toHeaderIndexes(header: string[]) {
  const normalized = header.map((cell) => cell.trim().toLowerCase());

  return {
    front: findHeader(normalized, ['front', 'word', 'english', 'term']),
    back: findHeader(normalized, ['back', 'meaning', 'japanese', 'answer']),
    example: findHeader(normalized, ['example', 'sentence']),
    note: findHeader(normalized, ['note', 'memo']),
  };
}

function findHeader(header: string[], candidates: string[]) {
  return candidates
    .map((candidate) => header.indexOf(candidate))
    .find((i) => i >= 0);
}

function toCsvRecords(rows: string[][]) {
  const [firstRow, ...rest] = rows;
  const indexes = toHeaderIndexes(firstRow);

  if (indexes.front !== undefined && indexes.back !== undefined) {
    return { indexes, records: rest };
  }

  return {
    indexes: {
      front: 0,
      back: 1,
      example: 2,
      note: 3,
    },
    records: rows,
  };
}

function isAnkiMetadataRow(row: string[]) {
  return row.length === 1 && row[0].trim().startsWith('#');
}

function readCell(record: string[], index: number | undefined) {
  if (index === undefined) {
    return undefined;
  }

  return record[index]?.trim() || undefined;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells) => cells.some((value) => value.trim()));
}
