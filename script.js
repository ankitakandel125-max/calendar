(() => {
  'use strict';

  const STORE_KEY = 'calendar-events-v1';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const longDate = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  /* ---------- State ---------- */
  let events = load();
  const now = new Date();
  let view = { y: now.getFullYear(), m: now.getMonth() };
  let selected = keyOf(now);
  let use24h = true;
  const alerted = new Set();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(events)); }
    catch { toast('Could not save. Browser storage is unavailable.'); }
  }

  /* ---------- Digital clock ---------- */
  function tick() {
    const d = new Date();
    let h = d.getHours();
    let suffix = '';
    if (!use24h) { suffix = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
    const t = $('clockTime');
    t.textContent = `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (suffix) {
      const s = document.createElement('span');
      s.className = 'ampm';
      s.textContent = suffix;
      t.appendChild(s);
    }
    $('clockDate').textContent = longDate(d);
    checkReminders(d);
  }

  /* ---------- Reminders (events with a time) ---------- */
  function checkReminders(d) {
    const list = events[keyOf(d)] || [];
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    list.forEach((ev) => {
      const id = `${keyOf(d)}-${ev.id}`;
      if (ev.time === hm && !alerted.has(id)) {
        alerted.add(id);
        toast(`Reminder: ${ev.title} (${ev.time})`, 8000);
      }
    });
  }

  let toastTimer;
  function toast(msg, ms = 4000) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  /* ---------- Calendar grid ---------- */
  function renderGrid() {
    $('monthLabel').textContent = `${MONTHS[view.m]} ${view.y}`;
    const grid = $('grid');
    grid.replaceChildren();

    const first = new Date(view.y, view.m, 1);
    const start = new Date(view.y, view.m, 1 - first.getDay());
    const todayKey = keyOf(new Date());

    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const k = keyOf(d);
      const list = events[k] || [];

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'day';
      cell.dataset.date = k;
      if (d.getMonth() !== view.m) cell.classList.add('outside');
      if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add('weekend');
      if (k === todayKey) cell.classList.add('today');
      if (k === selected) cell.classList.add('selected');
      if (list.length) cell.classList.add('has-events');

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = d.getDate();
      cell.appendChild(num);

      const dots = document.createElement('span');
      dots.className = 'dots';
      list.slice(0, 3).forEach(() => {
        const dot = document.createElement('i');
        dot.className = 'dot';
        dots.appendChild(dot);
      });
      cell.appendChild(dots);

      if (list.length) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = list.length;
        cell.appendChild(b);
      }

      const count = list.length ? `, ${list.length} event${list.length > 1 ? 's' : ''}` : ', no events';
      cell.setAttribute('aria-label', `${longDate(d)}${count}`);
      grid.appendChild(cell);
    }
  }

  /* ---------- Selected-day panel ---------- */
  function renderPanel() {
    const d = parseKey(selected);
    const list = (events[selected] || []).slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const isToday = selected === keyOf(new Date());
    $('panelTitle').textContent = isToday ? 'Today' : DAYS[d.getDay()];
    $('panelSub').textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    const ul = $('eventList');
    ul.replaceChildren();

    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No events on this day. Double-click the date to add one.';
      ul.appendChild(li);
      return;
    }

    list.forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'event-item';

      const title = document.createElement('span');
      title.className = 'ev-title';
      title.textContent = ev.title;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'ev-del';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete ${ev.title}`);
      del.addEventListener('click', () => removeEvent(selected, ev.id));

      li.append(title, del);

      if (ev.time) {
        const t = document.createElement('span');
        t.className = 'ev-time';
        t.textContent = ev.time;
        li.appendChild(t);
      }
      if (ev.note) {
        const n = document.createElement('p');
        n.className = 'ev-note';
        n.textContent = ev.note;
        li.appendChild(n);
      }
      ul.appendChild(li);
    });
  }

  /* ---------- Selecting a date ---------- */
  // Single click updates classes in place instead of rebuilding the grid,
  // so the browser can still register the second click of a double-click.
  function selectDate(k) {
    selected = k;
    document.querySelectorAll('.day.selected').forEach((c) => c.classList.remove('selected'));
    const cell = document.querySelector(`.day[data-date="${k}"]`);
    if (cell) cell.classList.add('selected');
    renderPanel();
  }

  /* ---------- Events: add / remove ---------- */
  function addEvent(k, data) {
    (events[k] = events[k] || []).push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
    save();
    renderGrid();
    renderPanel();
  }
  function removeEvent(k, id) {
    events[k] = (events[k] || []).filter((e) => e.id !== id);
    if (!events[k].length) delete events[k];
    save();
    renderGrid();
    renderPanel();
  }

  /* ---------- Dialog ---------- */
  const dialog = $('eventDialog');
  const form = $('eventForm');
  let dialogDate = selected;

  function openDialog(k) {
    dialogDate = k;
    form.reset();
    $('titleError').hidden = true;
    $('dialogDate').textContent = longDate(parseKey(k));
    dialog.showModal();
    $('evTitle').focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('evTitle').value.trim();
    if (!title) { $('titleError').hidden = false; $('evTitle').focus(); return; }
    addEvent(dialogDate, { title, time: $('evTime').value, note: $('evNote').value.trim() });
    dialog.close();
    toast('Event added');
  });
  $('cancelBtn').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------- Wiring ---------- */
  const grid = $('grid');
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.day');
    if (cell) selectDate(cell.dataset.date);
  });
  grid.addEventListener('dblclick', (e) => {
    const cell = e.target.closest('.day');
    if (!cell) return;
    selectDate(cell.dataset.date);
    openDialog(cell.dataset.date);
  });

  $('addBtn').addEventListener('click', () => openDialog(selected));
  $('prevBtn').addEventListener('click', () => { view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 }; renderGrid(); });
  $('nextBtn').addEventListener('click', () => { view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }; renderGrid(); });
  $('todayBtn').addEventListener('click', () => {
    const t = new Date();
    view = { y: t.getFullYear(), m: t.getMonth() };
    selected = keyOf(t);
    renderGrid();
    renderPanel();
  });
  $('formatToggle').addEventListener('click', (e) => {
    use24h = !use24h;
    e.currentTarget.textContent = use24h ? '24-hour' : '12-hour';
    e.currentTarget.setAttribute('aria-pressed', String(!use24h));
    tick();
  });

  /* ---------- Init ---------- */
  renderGrid();
  renderPanel();
  tick();
  setInterval(tick, 1000);
})();