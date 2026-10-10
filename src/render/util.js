export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function pct(n, total) {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 10;
}

export function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shortFa(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

export function deltaSpan(current, previous) {
  if (previous === undefined || previous === null) return '';
  const diff = current - previous;
  if (diff === 0) return '<span class="delta flat">±0</span>';
  const cls = diff > 0 ? 'up' : 'down';
  return `<span class="delta ${cls}">${diff > 0 ? '+' : ''}${diff} از دیروز</span>`;
}

export const byKey = (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true });
