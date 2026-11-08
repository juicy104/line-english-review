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
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminService } from '../../application/admin/admin.service';
import { AuthService } from '../../application/auth/auth.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  getAdminPage(@Req() request: Request, @Res() response: Response): void {
    if (!this.authService.getSessionUserId(request)) {
      response.redirect('/auth/line/start?returnTo=/admin');
      return;
    }

    response.type('html').send(adminHtml);
  }

  @Get('api/users')
  listUsers(@Req() request: Request) {
    return this.adminService.listUsers(this.requireUserId(request));
  }

  @Get('api/decks')
  listDecks(@Req() request: Request, @Query('userId') userId?: string) {
    if (userId) {
      this.requireMatchingUser(request, userId);
    }
    return this.adminService.listDecks(this.requireUserId(request));
  }

  @Post('api/decks/default')
  getOrCreateDefaultDeck(@Req() request: Request) {
    return this.adminService.getOrCreateDefaultDeck(
      this.requireUserId(request),
    );
  }

  @Post('api/decks')
  createDeck(
    @Req() request: Request,
    @Body() body: { name: string; description?: string },
  ) {
    return this.adminService.createDeck(this.requireUserId(request), body);
  }

  @Put('api/decks/:id/default')
  setDefaultDeck(@Req() request: Request, @Param('id') id: string) {
    return this.adminService.setDefaultDeck(this.requireUserId(request), id);
  }

  @Put('api/settings/delivery-deck')
  setDeliveryDeck(@Req() request: Request, @Body() body: { deckId?: unknown }) {
    return this.adminService.setDeliveryDeck(
      this.requireUserId(request),
      body?.deckId,
    );
  }

  @Get('api/decks/:id/export-csv')
  async exportCardsToCsv(
    @Req() request: Request,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const csv = await this.adminService.exportCardsToCsv(
      this.requireUserId(request),
      id,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="deck-' + encodeURIComponent(id) + '.csv"',
    );
    response.send(csv);
  }

  @Get('api/cards')
  listCards(
    @Req() request: Request,
    @Query('deckId') deckId: string,
    @Query('q') query?: string,
  ) {
    return this.adminService.listCards(
      this.requireUserId(request),
      deckId,
      query,
    );
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
      --panel: #fff;
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
      -webkit-text-size-adjust: 100%;
    }
    header {
      background: var(--panel);
      border-bottom: 1px solid var(--line);
      padding: 14px 18px 0;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .topbar {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    h1 { font-size: 19px; margin: 0; }
    nav { display: flex; gap: 6px; overflow-x: auto; }
    nav button {
      background: transparent;
      border: 0;
      border-bottom: 3px solid transparent;
      border-radius: 0;
      color: var(--muted);
      padding: 11px 12px;
    }
    nav button.active {
      border-color: var(--accent);
      color: var(--ink);
    }
    main {
      margin: 0 auto;
      max-width: 980px;
      padding: 18px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    section[hidden] { display: none; }
    h2 { font-size: 17px; margin: 0 0 14px; }
    h3 { font-size: 14px; margin: 0 0 10px; }
    label {
      color: var(--muted);
      display: block;
      font-size: 12px;
      margin: 10px 0 6px;
    }
    input, select, textarea {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 6px;
      font: inherit;
      font-size: 16px;
      padding: 10px;
      width: 100%;
    }
    textarea { min-height: 92px; resize: vertical; }
    button {
      align-items: center;
      background: var(--accent);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-weight: 700;
      gap: 8px;
      justify-content: center;
      min-height: 44px;
      padding: 10px 13px;
      white-space: nowrap;
    }
    button:hover { background: var(--accent-dark); }
    button:disabled {
      cursor: wait;
      opacity: 0.72;
    }
    button.secondary { background: #344054; }
    button.danger { background: var(--danger); }
    .spinner {
      animation: spin 0.75s linear infinite;
      border: 2px solid rgba(255, 255, 255, 0.45);
      border-top-color: #fff;
      border-radius: 999px;
      display: inline-block;
      height: 16px;
      width: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .muted { color: var(--muted); }
    .status { color: var(--muted); min-height: 21px; text-align: right; }
    .status.busy {
      align-items: center;
      display: inline-flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .status .spinner {
      border-color: rgba(102, 112, 133, 0.28);
      border-top-color: var(--accent-dark);
    }
    .toolbar {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .filter-row {
      align-items: end;
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) auto;
      margin-bottom: 12px;
    }
    .filter-row label { margin-top: 0; }
    .filter-count {
      color: var(--muted);
      font-size: 12px;
      padding-bottom: 11px;
      white-space: nowrap;
    }
    .form-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .full { grid-column: 1 / -1; }
    .deck-row {
      align-items: center;
      border-top: 1px solid var(--line);
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 10px 0;
    }
    .card-editor {
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-bottom: 16px;
      padding: 12px;
    }
    .card-editor > div { min-width: 0; }
    .card-editor textarea { overflow: hidden; overflow-wrap: anywhere; }
    .deck-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .export-link { color: var(--accent-dark); display: inline-block; padding: 10px 0; }
    @media (max-width: 760px) {
      .deck-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      body { padding-bottom: 70px; }
      header {
        padding: 12px 12px 0;
      }
      nav {
        background: var(--panel);
        border-top: 1px solid var(--line);
        bottom: 0;
        box-shadow: 0 -6px 18px rgba(16, 24, 40, 0.08);
        display: grid;
        gap: 0;
        grid-template-columns: repeat(3, 1fr);
        left: 0;
        padding: 6px 8px env(safe-area-inset-bottom);
        position: fixed;
        right: 0;
        z-index: 3;
      }
      nav button {
        border-bottom: 0;
        border-radius: 6px;
        color: var(--muted);
        padding: 10px 4px;
      }
      nav button.active {
        background: #e7f8ee;
        color: var(--accent-dark);
      }
      .form-grid { grid-template-columns: 1fr; }
      .filter-row { grid-template-columns: 1fr; }
      .filter-count { padding-bottom: 0; }
      .topbar { align-items: flex-start; flex-direction: column; }
      .status { text-align: left; }
      main { padding: 12px; }
      section {
        border-left: 0;
        border-radius: 0;
        border-right: 0;
        margin: 0 -12px;
        padding: 14px 12px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <h1>LINE English Admin</h1>
      <div id="status" class="status"></div>
    </div>
    <nav aria-label="Admin views">
      <button class="active" data-view="add" type="button">Add</button>
      <button data-view="decks" type="button">Decks</button>
      <button data-view="cards" type="button">Cards</button>
    </nav>
  </header>
  <main>
    <section id="view-add">
      <h2>Add Cards</h2>
      <label for="addDeckSelect">Deck</label>
      <select id="addDeckSelect"></select>
      <form id="cardForm" class="form-grid">
        <div>
          <label for="front">Front</label>
          <input id="front" required placeholder="apple">
        </div>
        <div>
          <label for="back">Back</label>
          <input id="back" required placeholder="りんご">
        </div>
        <div class="full">
          <label for="example">Example</label>
          <textarea id="example"></textarea>
        </div>
        <div class="full">
          <label for="note">Note</label>
          <textarea id="note"></textarea>
        </div>
        <div class="toolbar full">
          <button type="submit">Add Card</button>
        </div>
      </form>
      <hr>
      <form id="csvForm">
        <h3>CSV Import</h3>
        <p class="muted">Headers optional: front,back,example,note</p>
        <label for="csvFile">CSV File</label>
        <input id="csvFile" type="file" accept=".csv,text/csv">
        <label for="csvText">CSV Text</label>
        <textarea id="csvText" placeholder="front,back,example,note&#10;apple,りんご,I ate an apple.,noun"></textarea>
        <div class="toolbar">
          <button type="submit">Import CSV</button>
        </div>
      </form>
    </section>

    <section id="view-decks" hidden>
      <h2>Decks</h2>
      <form id="deliveryDeckForm">
        <h3>LINE配信デッキ</h3>
        <p class="muted">定期配信と「復習する」で出題するデッキを固定します。選択したデッキに出題できるカードがない場合は配信しません。</p>
        <label for="deliveryDeckSelect">配信するデッキ</label>
        <select id="deliveryDeckSelect"></select>
        <div class="toolbar"><button type="submit">配信デッキを保存</button></div>
      </form>
      <hr>
      <form id="deckForm" class="form-grid">
        <div>
          <label for="deckName">Name</label>
          <input id="deckName" required placeholder="Default">
        </div>
        <div>
          <label for="deckDescription">Description</label>
          <input id="deckDescription">
        </div>
        <div class="toolbar full">
          <button type="submit">Create Deck</button>
        </div>
      </form>
      <div id="deckList"></div>
    </section>

    <section id="view-cards" hidden>
      <h2>Cards</h2>
      <label for="cardsDeckSelect">Deck</label>
      <select id="cardsDeckSelect"></select>
      <a id="exportCsvLink" class="export-link" hidden>Export Deck CSV</a>
      <div class="filter-row">
        <div>
          <label for="cardFilter">Filter</label>
          <input id="cardFilter" type="search" placeholder="Search front, back, example, note">
        </div>
        <div id="cardFilterCount" class="filter-count"></div>
      </div>
      <div id="cardsBody"></div>
    </section>
  </main>
  <script>
    const state = { users: [], decks: [], cards: [] };
    let searchTimer;
    const $ = (id) => document.getElementById(id);
    const status = (message, busy = false) => {
      const element = $('status');
      element.classList.toggle('busy', busy);
      element.innerHTML = message
        ? (busy ? '<span class="spinner" aria-hidden="true"></span>' : '') + '<span>' + escapeHtml(message) + '</span>'
        : '';
    };
    const selectedAddDeckId = () => $('addDeckSelect').value;
    const selectedCardsDeckId = () => $('cardsDeckSelect').value;

    async function api(path, options = {}) {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      if (res.status === 401) {
        window.location.replace('/auth/line/start?returnTo=/admin');
        return undefined;
      }
      if (!res.ok) throw new Error(await res.text());
      return res.status === 204 ? null : res.json();
    }

    async function withLoading(target, message, action) {
      const button = target instanceof HTMLButtonElement ? target : target?.querySelector('button[type="submit"]');
      const originalHtml = button?.innerHTML;
      const controls = target instanceof HTMLFormElement
        ? Array.from(target.querySelectorAll('input, select, textarea, button'))
        : [];
      const originallyDisabled = new Map(controls.map((control) => [control, control.disabled]));
      if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + escapeHtml(message) + '</span>';
      }
      controls.forEach((control) => { control.disabled = true; });
      status(message + '...', true);
      try {
        return await action();
      } finally {
        controls.forEach((control) => { control.disabled = originallyDisabled.get(control); });
        if (button) {
          if (!controls.length) button.disabled = false;
          button.innerHTML = originalHtml;
        }
        $('status').classList.remove('busy');
      }
    }

    async function boot() {
      status('Loading...');
      state.users = await api('/admin/api/users');
      await loadDecks({ ensureDefault: true });
      renderDecks();
      await loadCards();
      status('');
    }

    async function loadDecks({ ensureDefault = false } = {}) {
      state.decks = await api('/admin/api/decks') || [];
      if (!state.decks.length && ensureDefault) {
        await withLoading(null, 'Preparing deck', () => api('/admin/api/decks/default', { method: 'POST' }));
        state.decks = await api('/admin/api/decks') || [];
      }
      renderDeckSelects();
    }

    function renderDeckSelects() {
      const addDeckId = selectedAddDeckId();
      const cardsDeckId = selectedCardsDeckId();
      const defaultDeckId = state.decks.find((deck) => deck.isDefault)?.id || state.decks[state.decks.length - 1]?.id;
      const options = state.decks.map((deck) => {
        return '<option value="' + escapeAttr(deck.id) + '">' + escapeHtml(deck.name) + (deck.isDefault ? ' · Default' : '') + ' (' + deck._count.cards + ')</option>';
      }).join('');
      $('addDeckSelect').innerHTML = options;
      $('cardsDeckSelect').innerHTML = options;
      $('deliveryDeckSelect').innerHTML = '<option value="">すべてのデッキ</option>' + options;
      $('deliveryDeckSelect').value = state.decks.find((deck) => deck.isDeliveryDeck)?.id || '';
      $('addDeckSelect').value = state.decks.some((deck) => deck.id === addDeckId) ? addDeckId : defaultDeckId || '';
      $('cardsDeckSelect').value = state.decks.some((deck) => deck.id === cardsDeckId) ? cardsDeckId : defaultDeckId || '';
      updateExportLink();
      renderDecks();
    }

    function renderDecks() {
      $('deckList').innerHTML = state.decks.map((deck) => {
        return '<div class="deck-row"><div><strong>' + escapeHtml(deck.name) + '</strong>' + (deck.isDefault ? ' · Default' : '') + '<div class="muted">' + (deck._count.cards || 0) + ' cards' + (deck.description ? ' · ' + escapeHtml(deck.description) : '') + '</div></div><div class="deck-actions">' +
          (deck.isDefault ? '' : '<button type="button" class="secondary" data-default-deck="' + escapeAttr(deck.id) + '">Set as Default</button>') +
          '<a class="export-link" href="/admin/api/decks/' + encodeURIComponent(deck.id) + '/export-csv">Export CSV</a></div></div>';
      }).join('') || '<p class="muted">No decks</p>';
    }

    function updateExportLink() {
      const deckId = selectedCardsDeckId();
      $('exportCsvLink').hidden = !deckId;
      $('exportCsvLink').href = '/admin/api/decks/' + encodeURIComponent(deckId) + '/export-csv';
    }

    async function loadCards() {
      updateExportLink();
      const deckId = selectedCardsDeckId() || selectedAddDeckId();
      const query = normalizeSearch($('cardFilter').value);
      const params = new URLSearchParams({ deckId });
      if (query) params.set('q', query);
      state.cards = deckId ? await api('/admin/api/cards?' + params.toString()) || [] : [];
      renderCards();
    }

    function renderCards() {
      const query = normalizeSearch($('cardFilter').value);
      $('cardsBody').innerHTML = state.cards.map(renderCardRow).join('') || '<p class="muted">' + (query ? 'No matching cards' : 'No cards') + '</p>';
      $('cardsBody').querySelectorAll('textarea').forEach(resizeTextarea);
      $('cardFilterCount').textContent = query
        ? state.cards.length + ' matching cards'
        : state.cards.length + ' cards';
    }

    function renderCardRow(card) {
      return '<article class="card-editor form-grid" data-card-id="' + escapeAttr(card.id) + '">' +
        ['front', 'back', 'example', 'note'].map((field) =>
          '<div' + (field === 'front' || field === 'back' ? ' class="full"' : '') + '><label>' + field[0].toUpperCase() + field.slice(1) +
          '<textarea data-field="' + field + '">' + escapeHtml(card[field] || '') + '</textarea></label></div>'
        ).join('') +
        '<div class="toolbar full"><button class="secondary" data-action="save" type="button">Save</button><button class="danger" data-action="delete" type="button">Delete</button></div>' +
      '</article>';
    }

    function resizeTextarea(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }

    $('cardsBody').addEventListener('input', (event) => {
      if (event.target.matches('textarea')) resizeTextarea(event.target);
    });
    window.addEventListener('resize', () => {
      if (!$('view-cards').hidden) $('cardsBody').querySelectorAll('textarea').forEach(resizeTextarea);
    });

    $('deckList').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-default-deck]');
      if (!button) return;
      try {
        await withLoading(button, 'Saving default', async () => {
          const deckId = button.dataset.defaultDeck;
          await api('/admin/api/decks/' + encodeURIComponent(deckId) + '/default', { method: 'PUT' });
          await loadDecks();
          $('addDeckSelect').value = deckId;
        });
        status('Default deck saved');
      } catch (error) { status(error.message); }
    });

    function normalizeSearch(value) {
      return String(value || '').trim().toLowerCase();
    }

    function queueCardSearch() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadCards().catch((error) => status(error.message));
      }, 250);
    }

    document.querySelectorAll('nav button').forEach((button) => {
      button.addEventListener('click', async () => {
        document.querySelectorAll('nav button').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('main section').forEach((section) => section.hidden = section.id !== 'view-' + button.dataset.view);
        if (button.dataset.view === 'cards') await loadCards();
      });
    });

    $('addDeckSelect').addEventListener('change', () => {
      $('cardsDeckSelect').value = selectedAddDeckId();
      updateExportLink();
    });
    $('cardsDeckSelect').addEventListener('change', loadCards);
    $('cardFilter').addEventListener('input', queueCardSearch);

    $('deliveryDeckForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const deckId = $('deliveryDeckSelect').value || null;
      try {
        await withLoading(event.target, '保存中', async () => {
          await api('/admin/api/settings/delivery-deck', {
            method: 'PUT', body: JSON.stringify({ deckId }),
          });
          await loadDecks();
        });
        status('LINE配信デッキを保存しました');
      } catch (error) { status(error.message); }
    });

    $('deckForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await withLoading(event.target, 'Creating deck', async () => {
        await api('/admin/api/decks', {
          method: 'POST',
          body: JSON.stringify({
            name: $('deckName').value,
            description: $('deckDescription').value,
          }),
        });
        event.target.reset();
        await loadDecks();
        renderDecks();
      });
      status('Deck created');
    });

    $('cardForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await withLoading(event.target, 'Adding card', async () => {
        await api('/admin/api/cards', {
          method: 'POST',
          body: JSON.stringify({
            deckId: selectedAddDeckId(),
            front: $('front').value,
            back: $('back').value,
            example: $('example').value,
            note: $('note').value,
          }),
        });
        event.target.reset();
        await loadDecks();
      });
      status('Card added');
    });

    $('csvFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) $('csvText').value = await file.text();
    });

    $('csvForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await withLoading(event.target, 'Importing CSV', async () => {
        const imported = await api('/admin/api/cards/import-csv', {
          method: 'POST',
          body: JSON.stringify({ deckId: selectedAddDeckId(), csv: $('csvText').value }),
        });
        await loadDecks();
        renderDecks();
        return imported;
      });
      status('Imported ' + result.imported + ', skipped ' + result.skipped);
    });

    $('cardsBody').addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const row = button.closest('[data-card-id]');
      const id = row.dataset.cardId;
      if (button.dataset.action === 'delete') {
        if (!confirm('Delete this card?')) return;
        await withLoading(button, 'Deleting', async () => {
          await api('/admin/api/cards/' + id, { method: 'DELETE' });
          await loadCards();
          await loadDecks();
        });
        status('Card deleted');
        return;
      }
      await withLoading(button, 'Saving', async () => {
        const data = {};
        row.querySelectorAll('[data-field]').forEach((input) => { data[input.dataset.field] = input.value; });
        await api('/admin/api/cards/' + id, { method: 'PUT', body: JSON.stringify(data) });
        await loadCards();
      });
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

    boot().catch((error) => status(error.message));
  </script>
</body>
</html>`;
