const STORAGE_KEY = 'shelfwise.items.v1';
const form = document.querySelector('#item-form');
const itemList = document.querySelector('#item-list');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#search-input');
const filterButtons = [...document.querySelectorAll('.filter-button')];
const today = new Date();
today.setHours(0, 0, 0, 0);
document.querySelector('#item-date').value = localDateString(today);

let items = loadItems();
let filter = 'all';

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && item.id && item.name && item.date) : [];
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    announce('This browser could not save your list. Your current items may be lost when you leave.');
  }
}

function announce(message) {
  let status = document.querySelector('#app-status');
  if (!status) {
    status = document.createElement('p');
    status.id = 'app-status';
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    document.body.append(status);
  }
  status.textContent = message;
}

function dayDifference(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Math.round((date - today) / 86400000);
}

function statusFor(item) {
  const days = dayDifference(item.date);
  if (days < 0) return { label: 'Past date', className: 'expired', urgency: 0 };
  if (days === 0) return { label: 'Use today', className: 'soon', urgency: 1 };
  if (days <= 3) return { label: `Use in ${days}d`, className: 'soon', urgency: 1 };
  return { label: 'Fresh', className: '', urgency: 2 };
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
}

function iconFor(category) {
  const shapes = {
    Produce: '<path d="M10 16c-4 0-6-2.5-6-6 3.5 0 6 2 6 6Z"/><path d="M10 16c0-4.5 2-7 6-7 0 4-2 7-6 7Z"/><path d="M10 16c0-6-1-9-4-11"/>',
    Dairy: '<path d="M6 5h8l2 3v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8l2-3Z"/><path d="M6 5v3h10M7 11h6"/>',
    'Meat & fish': '<path d="M4 10c3-5 8-5 11-2l2-2 1 1-2 2c1 3-1 7-5 8-4 1-8-1-8-5Z"/><circle cx="13" cy="11" r=".7"/>',
    Bakery: '<path d="M4 11c0-3.5 2.5-6 6-6s6 2.5 6 6v5H4v-5Z"/><path d="M8 8v2M12 7v2"/>',
    Pantry: '<path d="M5 5h10v12H5zM5 9h10M8 7h4"/>',
    Other: '<circle cx="10" cy="10" r="6"/><path d="M10 7v6M7 10h6"/>',
  };
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${shapes[category] || shapes.Other}</svg>`;
}

function createItemRow(item) {
  const status = statusFor(item);
  const row = document.createElement('article');
  row.className = 'item-row';
  const icon = document.createElement('span');
  icon.className = 'item-icon';
  icon.innerHTML = iconFor(item.category);
  const main = document.createElement('span');
  main.className = 'item-main';
  const name = document.createElement('strong');
  name.className = 'item-name';
  name.textContent = item.name;
  const meta = document.createElement('span');
  meta.className = 'item-meta';
  meta.textContent = `${item.category}${item.quantity ? ` · ${item.quantity}` : ''} · Best by ${formatDate(item.date)}`;
  main.append(name, meta);
  const badge = document.createElement('span');
  badge.className = `item-status ${status.className}`.trim();
  badge.textContent = status.label;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-button';
  remove.setAttribute('aria-label', `Remove ${item.name}`);
  remove.title = `Remove ${item.name}`;
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    items = items.filter((candidate) => candidate.id !== item.id);
    saveItems();
    render();
    announce(`${item.name} removed from your shelf.`);
  });
  row.append(icon, main, badge, remove);
  return row;
}

function render() {
  const total = items.length;
  const soon = items.filter((item) => dayDifference(item.date) <= 3).length;
  document.querySelector('#total-count').textContent = total;
  document.querySelector('#soon-count').textContent = soon;
  document.querySelector('#fresh-count').textContent = total - soon;
  document.querySelector('#clear-button').hidden = total === 0;

  const query = searchInput.value.trim().toLocaleLowerCase();
  const visible = items
    .filter((item) => filter === 'all' || dayDifference(item.date) <= 3)
    .filter((item) => `${item.name} ${item.category} ${item.quantity || ''}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  itemList.replaceChildren(...visible.map(createItemRow));
  const noItems = total === 0;
  emptyState.hidden = !noItems;
  itemList.hidden = noItems;
  if (!noItems && visible.length === 0) {
    const message = document.createElement('p');
    message.className = 'field-hint';
    message.textContent = 'No matching items. Try another search or filter.';
    itemList.append(message);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const date = String(data.get('date') || '');
  if (!name || !date) return;
  const item = {
    id: makeId(),
    name,
    category: String(data.get('category') || 'Other'),
    quantity: String(data.get('quantity') || '').trim(),
    date,
  };
  items.push(item);
  saveItems();
  form.reset();
  document.querySelector('#item-date').value = localDateString(today);
  render();
  document.querySelector('#item-name').focus();
  announce(`${name} added to your shelf.`);
});

searchInput.addEventListener('input', render);
filterButtons.forEach((button) => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  filterButtons.forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle('is-active', active);
    candidate.setAttribute('aria-pressed', String(active));
  });
  render();
}));

document.querySelector('#demo-button').addEventListener('click', () => {
  if (items.length) {
    document.querySelector('#item-name').focus();
    announce('Your shelf already has items. Add a sample only when the shelf is empty.');
    return;
  }
  const inDays = (amount) => {
    const date = new Date(today);
    date.setDate(date.getDate() + amount);
    return localDateString(date);
  };
  items = [
    { id: makeId(), name: 'Baby spinach', category: 'Produce', quantity: '1 bag', date: inDays(1) },
    { id: makeId(), name: 'Greek yogurt', category: 'Dairy', quantity: '2 cups', date: inDays(3) },
    { id: makeId(), name: 'Rolled oats', category: 'Pantry', quantity: '1 jar', date: inDays(90) },
  ];
  saveItems();
  render();
  announce('Three sample pantry items added.');
});

document.querySelector('#empty-add-button').addEventListener('click', () => document.querySelector('#item-name').focus());
document.querySelector('#clear-button').addEventListener('click', () => {
  if (!items.length) return;
  items = [];
  saveItems();
  render();
  announce('All items cleared from your shelf.');
});

render();
