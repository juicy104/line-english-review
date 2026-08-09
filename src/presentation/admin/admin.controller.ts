import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from '../../application/admin/admin.service';
import { AuthService } from '../../application/auth/auth.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  getAdminPage(): string {
    return adminHtml;
  }

  @Get('api/users')
  listUsers(@Req() request: Request) {
    return this.adminService.listUsers(this.requireUserId(request));
  }

  @Get('api/decks')
  listDecks(@Req() request: Request, @Query('userId') userId: string) {
    this.requireMatchingUser(request, userId);
    return this.adminService.listDecks(userId);
  }

  @Post('api/decks')
  createDeck(
    @Req() request: Request,
    @Body() body: { name: string; description?: string },
  ) {
    return this.adminService.createDeck(this.requireUserId(request), body);
  }

  @Get('api/cards')
  listCards(@Req() request: Request, @Query('deckId') deckId: string) {
    return this.adminService.listCards(this.requireUserId(request), deckId);
  }

  @Post('api/cards')
  createCard(
    @Req() request: Request,
    @Body()
    body: {
      deckId: string;
      front: string;
      back: string;
      example?: string;
      note?: string;
    },
  ) {
    return this.adminService.createCard(this.requireUserId(request), body);
  }

  @Post('api/cards/import-csv')
  importCardsFromCsv(
    @Req() request: Request,
    @Body() body: { deckId: string; csv: string },
  ) {
    return this.adminService.importCardsFromCsv(
      this.requireUserId(request),
      body.deckId,
      body.csv,
    );
  }

  @Put('api/cards/:id')
  updateCard(
    @Req() request: Request,
    @Param('id') id: string,
    @Body()
    body: { front?: string; back?: string; example?: string; note?: string },
  ) {
    return this.adminService.updateCard(this.requireUserId(request), id, body);
  }

  @Delete('api/cards/:id')
  deleteCard(@Req() request: Request, @Param('id') id: string) {
    return this.adminService.deleteCard(this.requireUserId(request), id);
  }

  private requireMatchingUser(request: Request, userId: string) {
    const sessionUserId = this.requireUserId(request);
    if (sessionUserId !== userId) {
      throw new UnauthorizedException('Invalid user');
    }
  }

  private requireUserId(request: Request) {
    const userId = this.authService.getSessionUserId(request);
    if (!userId) {
      throw new UnauthorizedException('LINE login is required');
    }
    return userId;
  }
}

const adminHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LINE English Admin</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #667085;
      --line: #d6dbe3;
      --accent: #06c755;
      --accent-dark: #049f44;
      --danger: #d92d20;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    h1 { margin: 0; font-size: 20px; }
    main {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 18px;
      padding: 18px;
    }
    section, aside {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    aside { padding: 14px; }
    section { padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    h3 { margin: 0 0 10px; font-size: 14px; }
    label { display: block; margin: 10px 0 6px; color: var(--muted); font-size: 12px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px 10px;
      font: inherit;
      background: #fff;
    }
    textarea { min-height: 90px; resize: vertical; }
    button {
      border: 0;
      border-radius: 6px;
      padding: 9px 12px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: var(--accent-dark); }
    button.secondary { background: #344054; }
    button.danger { background: var(--danger); }
    button:disabled { background: #98a2b3; cursor: not-allowed; }
    .stack { display: grid; gap: 12px; }
    .row { display: flex; gap: 8px; align-items: center; }
    .row > * { flex: 1; }
    .toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    .muted { color: var(--muted); }
    .status { min-height: 21px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 9px 8px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; font-weight: 700; }
    td.actions { width: 150px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      header { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <header>
    <h1>LINE English Admin</h1>
    <div id="status" class="status"></div>
  </header>
  <main>
    <aside class="stack">
      <div>
        <h2>Context</h2>
        <label for="userSelect">User</label>
        <select id="userSelect"></select>
        <label for="deckSelect">Deck</label>
        <select id="deckSelect"></select>
      </div>
      <form id="deckForm">
        <h3>New Deck</h3>
        <label for="deckName">Name</label>
        <input id="deckName" required placeholder="Default">
        <label for="deckDescription">Description</label>
        <textarea id="deckDescription"></textarea>
        <div class="toolbar">
          <button type="submit">Create</button>
        </div>
      </form>
    </aside>
    <section>
      <div class="grid">
        <form id="cardForm">
          <h2>Add Card</h2>
          <label for="front">Front</label>
          <input id="front" required placeholder="apple">
          <label for="back">Back</label>
          <input id="back" required placeholder="りんご">
          <label for="example">Example</label>
          <textarea id="example"></textarea>
          <label for="note">Note</label>
          <textarea id="note"></textarea>
          <div class="toolbar">
            <button type="submit">Add</button>
          </div>
        </form>
        <form id="csvForm">
          <h2>CSV Import</h2>
          <p class="muted">Headers: front,back,example,note</p>
          <label for="csvFile">CSV File</label>
          <input id="csvFile" type="file" accept=".csv,text/csv">
          <label for="csvText">CSV Text</label>
          <textarea id="csvText" placeholder="front,back,example,note&#10;apple,りんご,I ate an apple.,名詞"></textarea>
          <div class="toolbar">
            <button type="submit">Import</button>
          </div>
        </form>
      </div>
      <h2>Cards</h2>
      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Front</th>
              <th>Back</th>
              <th>Example</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="cardsBody"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const state = { users: [], decks: [], cards: [] };
    const $ = (id) => document.getElementById(id);
    const status = (message) => { $('status').textContent = message || ''; };
    const api = async (path, options = {}) => {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      if (res.status === 401) {
        window.location.href = '/auth/line/start?returnTo=/admin';
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      return res.status === 204 ? null : res.json();
    };
    const selectedUserId = () => $('userSelect').value;
    const selectedDeckId = () => $('deckSelect').value;

    async function loadUsers() {
      state.users = await api('/admin/api/users');
      $('userSelect').innerHTML = state.users.map((user) => {
        const line = user.authAccounts.find((account) => account.provider === 'LINE');
        const label = user.displayName || line?.providerUserId || user.id;
        return '<option value="' + user.id + '">' + escapeHtml(label) + '</option>';
      }).join('');
      if (!state.users.length) {
        $('userSelect').innerHTML = '<option value="">No users yet</option>';
      }
      await loadDecks();
    }

    async function loadDecks() {
      const userId = selectedUserId();
      state.decks = userId ? await api('/admin/api/decks?userId=' + encodeURIComponent(userId)) : [];
      $('deckSelect').innerHTML = state.decks.map((deck) => {
        return '<option value="' + deck.id + '">' + escapeHtml(deck.name) + ' (' + deck._count.cards + ')</option>';
      }).join('');
      if (!state.decks.length) {
        $('deckSelect').innerHTML = '<option value="">No decks yet</option>';
      }
      await loadCards();
    }

    async function loadCards() {
      const deckId = selectedDeckId();
      state.cards = deckId ? await api('/admin/api/cards?deckId=' + encodeURIComponent(deckId)) : [];
      $('cardsBody').innerHTML = state.cards.map(renderCardRow).join('') || '<tr><td colspan="5" class="muted">No cards</td></tr>';
    }

    function renderCardRow(card) {
      return '<tr data-card-id="' + card.id + '">' +
        '<td><input data-field="front" value="' + escapeAttr(card.front) + '"></td>' +
        '<td><input data-field="back" value="' + escapeAttr(card.back) + '"></td>' +
        '<td><textarea data-field="example">' + escapeHtml(card.example || '') + '</textarea></td>' +
        '<td><textarea data-field="note">' + escapeHtml(card.note || '') + '</textarea></td>' +
        '<td class="actions"><div class="row"><button class="secondary" data-action="save" type="button">Save</button><button class="danger" data-action="delete" type="button">Delete</button></div></td>' +
      '</tr>';
    }

    $('userSelect').addEventListener('change', loadDecks);
    $('deckSelect').addEventListener('change', loadCards);

    $('deckForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedUserId()) return;
      status('Creating deck...');
      await api('/admin/api/decks', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId(),
          name: $('deckName').value,
          description: $('deckDescription').value,
        }),
      });
      event.target.reset();
      await loadDecks();
      status('Deck created');
    });

    $('cardForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedDeckId()) return;
      status('Adding card...');
      await api('/admin/api/cards', {
        method: 'POST',
        body: JSON.stringify({
          deckId: selectedDeckId(),
          front: $('front').value,
          back: $('back').value,
          example: $('example').value,
          note: $('note').value,
        }),
      });
      event.target.reset();
      await loadCards();
      status('Card added');
    });

    $('csvFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) $('csvText').value = await file.text();
    });

    $('csvForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedDeckId()) return;
      status('Importing CSV...');
      const result = await api('/admin/api/cards/import-csv', {
        method: 'POST',
        body: JSON.stringify({ deckId: selectedDeckId(), csv: $('csvText').value }),
      });
      await loadCards();
      status('Imported ' + result.imported + ', skipped ' + result.skipped);
    });

    $('cardsBody').addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const row = button.closest('tr');
      const id = row.dataset.cardId;
      if (button.dataset.action === 'delete') {
        if (!confirm('Delete this card?')) return;
        status('Deleting card...');
        await api('/admin/api/cards/' + id, { method: 'DELETE' });
        await loadCards();
        status('Card deleted');
        return;
      }
      status('Saving card...');
      const data = {};
      row.querySelectorAll('[data-field]').forEach((input) => { data[input.dataset.field] = input.value; });
      await api('/admin/api/cards/' + id, { method: 'PUT', body: JSON.stringify(data) });
      await loadCards();
      status('Card saved');
    });

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[char]);
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/\\n/g, '&#10;');
    }

    loadUsers().catch((error) => status(error.message));
  </script>
</body>
</html>`;
