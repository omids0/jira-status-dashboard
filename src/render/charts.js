import { esc, localTodayKey, shortFa } from './util.js';

const NO_DATA = '<p class="section-note">دیتای این نمودار از Jira خونده نشد (مثلاً دسترسی به changelog نیست) — بقیه‌ی گزارش سالمه.</p>';

const dayLabel = (d, today) =>
  `<text x="LX" y="LY" text-anchor="middle" font-size="10.5" fill="${today ? 'var(--accent)' : 'var(--ink-faint)'}" font-weight="${today ? '700' : '400'}" font-family="Vazirmatn, sans-serif">${today ? 'امروز' : esc(shortFa(d.date))}</text>`;

const valueLabel = (x, y, v, size = 10, weight = 400, fill = 'var(--ink-muted)') =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="JetBrains Mono, monospace">${v}</text>`;

/** Grouped bar chart: two thin bars per day (backend / frontend), inline SVG. */
export function buildSubtaskChart(series, lanes) {
  if (!series) return NO_DATA;
  const W = 880, H = 210, padL = 30, padR = 10, padT = 16, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxVal = Math.max(1, ...series.map((d) => Math.max(d.backend, d.frontend)));
  const groupW = plotW / series.length;
  const barW = Math.max(4, Math.min(16, groupW * 0.28));
  const gap = 3;
  const today = localTodayKey();

  const bars = series.map((d, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const beH = (d.backend / maxVal) * plotH;
    const feH = (d.frontend / maxVal) * plotH;
    const beX = gx - barW - gap / 2;
    const feX = gx + gap / 2;
    const beY = padT + plotH - beH;
    const feY = padT + plotH - feH;
    const isToday = d.date === today;
    return `
      ${isToday ? `<rect x="${(gx - groupW / 2 + 2).toFixed(1)}" y="${padT}" width="${(groupW - 4).toFixed(1)}" height="${plotH}" fill="var(--surface-2)" opacity="0.6"></rect>` : ''}
      <rect x="${beX.toFixed(1)}" y="${beY.toFixed(1)}" width="${barW}" height="${beH.toFixed(1)}" rx="2" fill="var(--done)"></rect>
      <rect x="${feX.toFixed(1)}" y="${feY.toFixed(1)}" width="${barW}" height="${feH.toFixed(1)}" rx="2" fill="var(--accent)"></rect>
      ${valueLabel(beX + barW / 2, beY - 4, d.backend)}
      ${valueLabel(feX + barW / 2, feY - 4, d.frontend)}
      ${dayLabel(d, isToday).replace('LX', gx.toFixed(1)).replace('LY', padT + plotH + 16)}`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;direction:ltr;" role="img" aria-label="تعداد ساب‌تسک بک‌اند و فرانتی که هر روز Done شده">
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1"></line>
      ${bars}
    </svg>
    <div class="legend legend-big">
      <span class="legend-item"><span class="swatch" style="background:var(--done)"></span><b style="color:var(--done)">بک‌اند</b> · کامپوننت <span class="num">${esc(lanes.backend)}</span></span>
      <span class="legend-item"><span class="swatch" style="background:var(--accent)"></span><b style="color:var(--accent)">فرانت</b> · کامپوننت <span class="num">${esc(lanes.frontend)}</span></span>
    </div>`;
}

/** Single-series bar chart: how many stories reached true completion each day. */
export function buildStoryChart(series) {
  if (!series) return NO_DATA;
  const W = 880, H = 190, padL = 30, padR = 10, padT = 16, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxVal = Math.max(1, ...series.map((d) => d.count));
  const groupW = plotW / series.length;
  const barW = Math.max(10, Math.min(34, groupW * 0.55));
  const today = localTodayKey();

  const bars = series.map((d, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const h = (d.count / maxVal) * plotH;
    const y = padT + plotH - h;
    return `
      <rect x="${(gx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="3" fill="var(--done)"></rect>
      ${valueLabel(gx, y - 5, d.count, 11, 700, 'var(--ink)')}
      ${dayLabel(d, d.date === today).replace('LX', gx.toFixed(1)).replace('LY', padT + plotH + 16)}`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;direction:ltr;" role="img" aria-label="تعداد استوری‌هایی که هر روز کاملاً Done شدن">
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1"></line>
      ${bars}
    </svg>`;
}
