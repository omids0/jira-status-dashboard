import { byKey, esc } from './util.js';

// kind -> badge class + full label (row badge) + short label (group header chip)
export const VERDICTS = {
  stale: { cls: 'go', label: 'کامل — فقط status جیرا نخورده', short: 'کامل، status نخورده' },
  nosub: { cls: 'blocked', label: 'بدون ساب‌تسک', short: 'بدون ساب‌تسک' },
  fe: { cls: 'fe', label: 'فرانت در حال انجام', short: 'فرانت در حال انجام' },
  ready: { cls: 'go', label: 'آماده برای فرانت', short: 'آماده برای فرانت' },
  be: { cls: 'wait', label: 'بک‌اند در حال انجام', short: 'بک‌اند در حال انجام' },
  other: { cls: 'wait', label: 'ساب‌تسک‌ها در حال انجام', short: 'در حال انجام' }
};
export const VERDICT_ORDER = ['ready', 'fe', 'be', 'other', 'nosub', 'stale'];

export function verdictKind(info) {
  if (info.stale) return 'stale';
  if (info.beTotal === 0 && info.feTotal === 0) return info.otherTotal > 0 ? 'other' : 'nosub';
  // Frontend sub-tasks exist -> frontend is already under way, whether or not
  // the backend has (or even needs) any sub-tasks.
  if (info.feTotal > 0) return 'fe';
  if (info.beDone === info.beTotal) return 'ready';
  return 'be';
}

export function verdictFor(info) {
  const kind = verdictKind(info);
  const v = VERDICTS[kind];
  let note = '';
  if (kind === 'fe' && info.beTotal === 0) note = ' — بدون بک‌اند';
  if (kind === 'other') note = ` (${info.otherDone}/${info.otherTotal})`;
  return `<span class="verdict ${v.cls}">${v.label}${note}</span>`;
}

function inProgressRow(r, jiraUrl) {
  const info = r.subtaskInfo;
  return `<tr>
    <td class="num">${esc(r.key)}</td>
    <td style="text-align:right;white-space:normal;">${esc(r.summary)}</td>
    <td class="num">${info.beDone}/${info.beTotal}</td>
    <td class="num">${info.feDone}/${info.feTotal}</td>
    <td>${verdictFor(info)}</td>
    <td><a href="${esc(`${jiraUrl}/browse/${r.key}`)}" target="_blank" rel="noopener">باز کن</a></td>
  </tr>`;
}

/** In-progress stories grouped per module, one closed accordion each. */
export function inProgressGroups(rows, modules, jiraUrl) {
  const byModule = {};
  for (const r of rows) (byModule[r.moduleId] ||= []).push(r);

  const groups = Object.entries(byModule).map(([id, items]) => {
    const counts = {};
    for (const r of items) {
      const k = verdictKind(r.subtaskInfo);
      counts[k] = (counts[k] || 0) + 1;
    }
    return { id, label: modules.find((m) => m.id === id)?.label || id, items, counts };
  });
  // Modules with something actionable (ready for frontend) float to the top.
  groups.sort((a, b) => (b.counts.ready || 0) - (a.counts.ready || 0) || b.items.length - a.items.length);

  return groups.map((g) => {
    const chips = VERDICT_ORDER.filter((k) => g.counts[k])
      .map((k) => `<span class="verdict ${VERDICTS[k].cls}"><span class="num">${g.counts[k]}</span>&nbsp;${VERDICTS[k].short}</span>`)
      .join('');
    return `<details class="mod-acc">
      <summary>
        <span class="mod-acc-name">${esc(g.label)}</span>
        <span class="mod-acc-count num">${g.items.length} استوری</span>
        <span class="mod-acc-chips">${chips}</span>
      </summary>
      <div class="mod-acc-body table-wrap">
        <table>
          <thead><tr><th>استوری</th><th>عنوان</th><th class="num">بک‌اند</th><th class="num">فرانت</th><th>نتیجه</th><th>لینک</th></tr></thead>
          <tbody>${[...g.items].sort(byKey).map((r) => inProgressRow(r, jiraUrl)).join('')}</tbody>
        </table>
      </div>
    </details>`;
  }).join('');
}
