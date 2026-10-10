import { verdictFor } from './verdicts.js';
import { byKey, esc } from './util.js';

const SPRINT_STATE = { active: 'فعال', future: 'آینده', closed: 'بسته‌شده' };

function sprintDates(sp) {
  const f = (d) => new Date(d).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  return sp.startDate && sp.endDate ? `${f(sp.startDate)} تا ${f(sp.endDate)}` : 'بدون تاریخ';
}

function storyBadge(st) {
  if (st.trueState === 'done') return '<span class="verdict go">انجام‌شده</span>';
  if (st.trueState === 'backlog') return '<span class="verdict blocked">شروع‌نشده</span>';
  return verdictFor(st.subtaskInfo);
}

/** What we did / didn't do / still have to do, per sprint — state from true completion. */
export function sprintSection(sprints, report) {
  if (!sprints) return '<p class="section-note">اطلاعات اسپرینت از Jira Agile خونده نشد (دسترسی یا خطا) — بقیه‌ی گزارش سالمه.</p>';
  if (sprints.length === 0) return '<p class="section-note">هیچ اسپرینتی برای این پروژه پیدا نشد.</p>';

  const notDoneBefore = new Map(); // story key -> earlier sprint it was planned into and left unfinished
  const firstOpenIdx = sprints.findIndex((x) => x.state !== 'closed');

  return sprints.map((sp, i) => {
    const stories = sp.keys.map((k) => report.storyIndex[k]).filter(Boolean);
    const done = stories.filter((x) => x.trueState === 'done');
    const wip = stories.filter((x) => x.trueState === 'inprogress');
    const backlog = stories.filter((x) => x.trueState === 'backlog');
    const rest = stories.length - done.length;
    const pctOf = (n) => (stories.length ? (n / stories.length) * 100 : 0);

    const headline = sp.state === 'closed'
      ? `<b class="num">${done.length}</b> از <span class="num">${stories.length}</span> انجام شد — <b class="num">${rest}</b> نزدیم`
      : `<b class="num">${rest}</b> باید بزنیم — <span class="num">${done.length}</span> از <span class="num">${stories.length}</span> انجام شده`;

    const ordered = [...wip, ...backlog, ...done]
      .sort((a, b) => (a.trueState === 'done') - (b.trueState === 'done') || byKey(a, b));
    const rows = ordered.map((st) => {
      const carried = notDoneBefore.get(st.key);
      const tag = carried ? `<span class="sp-carried">↪ از ${esc(carried)} مونده</span>` : '';
      return `<tr>
        <td class="num">${esc(st.key)}</td>
        <td style="text-align:right;white-space:normal;">${esc(st.summary)}${tag}</td>
        <td>${storyBadge(st)}</td>
        <td><a href="${esc(`${report.baseUrl}/browse/${st.key}`)}" target="_blank" rel="noopener">باز کن</a></td>
      </tr>`;
    }).join('');

    for (const st of [...wip, ...backlog]) if (!notDoneBefore.has(st.key)) notDoneBefore.set(st.key, sp.name);

    return `<details class="mod-acc"${i === firstOpenIdx ? ' open' : ''}>
      <summary>
        <span class="mod-acc-name">${esc(sp.name)}</span>
        <span class="sp-meta">${esc(SPRINT_STATE[sp.state] || sp.state)} · ${esc(sprintDates(sp))}</span>
        <span class="sp-bar" title="انجام‌شده / در حال انجام / شروع‌نشده">
          <span style="width:${pctOf(done.length)}%;background:var(--done)"></span>
          <span style="width:${pctOf(wip.length)}%;background:var(--wip)"></span>
          <span style="width:${pctOf(backlog.length)}%;background:var(--backlog)"></span>
        </span>
        <span class="mod-acc-chips"><span class="sp-meta">${headline}</span></span>
      </summary>
      <div class="mod-acc-body table-wrap">
        <table>
          <thead><tr><th>استوری</th><th>عنوان</th><th>وضعیت</th><th>لینک</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">استوری‌ای تو این اسپرینت نیست</td></tr>'}</tbody>
        </table>
      </div>
    </details>`;
  }).join('');
}
