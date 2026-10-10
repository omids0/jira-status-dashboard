import { shell } from './shell.js';
import { toolbar } from './toolbar.js';
import { buildStoryChart, buildSubtaskChart } from './charts.js';
import { sprintSection } from './sprints.js';
import { inProgressGroups } from './verdicts.js';
import { deltaSpan, esc, pct } from './util.js';

const LIST_LIMIT = 15;

function moduleRow(m) {
  const d = pct(m.done, m.total), w = pct(m.inProgress, m.total), b = pct(m.backlog, m.total);
  return `
    <div class="module-row">
      <div><div class="module-name">${esc(m.label)}</div><span class="module-code">${esc(m.id)} · ${m.total}</span></div>
      <div class="bar-track" role="img" aria-label="${esc(m.label)}: ${Math.round(d)}% انجام‌شده">
        <span class="seg done" style="width:${d}%"></span>
        <span class="seg wip" style="width:${w}%"></span>
        <span class="seg backlog" style="width:${b}%"></span>
      </div>
      <div class="module-pct num"><b>${Math.round(d)}%</b> / ${Math.round(w)}% / ${Math.round(b)}%</div>
    </div>`;
}

function tableRow(m) {
  const d = pct(m.done, m.total), w = pct(m.inProgress, m.total), b = pct(m.backlog, m.total);
  return `<tr><td>${esc(m.label)}</td><td class="num"><span class="pill d">${m.done}</span></td><td class="num"><span class="pill w">${m.inProgress}</span></td><td class="num"><span class="pill b">${m.backlog}</span></td><td class="num">${m.total}</td><td class="num">${Math.round(d)}%</td><td class="num">${Math.round(w)}%</td><td class="num">${Math.round(b)}%</td></tr>`;
}

const keyList = (rows) => rows.map((r) => `<span class="num">${esc(r.key)}</span>`).join('، ');

function summaryBullets(insights) {
  const out = [];
  if (insights.readyForFrontend.length) out.push(`<li><b>${insights.readyForFrontend.length} استوری</b> بک‌اند تکمیل‌شده دارند و آماده‌ی شروع فرانت‌اند هستند: ${keyList(insights.readyForFrontend)}</li>`);
  if (insights.noSubtaskYet.length) out.push(`<li><b>${insights.noSubtaskYet.length} استوری</b> در وضعیت In Progress هستند اما ساب‌تسکی برای آن‌ها تعریف نشده است: ${keyList(insights.noSubtaskYet)}</li>`);
  if (insights.staleDone.length) out.push(`<li><b>${insights.staleDone.length} استوری</b> در عمل تکمیل شده‌اند اما وضعیت آن‌ها در Jira به‌روز نشده است: ${keyList(insights.staleDone)}</li>`);
  if (insights.zeroProgressModules.length) out.push(`<li>ماژول‌های بدون پیشرفت: <b>${insights.zeroProgressModules.map((m) => esc(m.label)).join('، ')}</b></li>`);
  if (insights.leadModule) out.push(`<li>بیشترین پیشرفت: ماژول <b>${esc(insights.leadModule.label)}</b> (${Math.round(pct(insights.leadModule.done, insights.leadModule.total))}%)</li>`);
  return out;
}

/** Compact story list with a cap, so a 60-story backlog doesn't swamp the page. */
function storyList(rows, baseUrl) {
  const shown = rows.slice(0, LIST_LIMIT).map((r) =>
    `<li><a class="num" href="${esc(`${baseUrl}/browse/${r.key}`)}" target="_blank" rel="noopener">${esc(r.key)}</a> — <bdi>${esc(r.summary)}</bdi></li>`
  ).join('');
  const more = rows.length > LIST_LIMIT ? `<li class="more">و ${rows.length - LIST_LIMIT} مورد دیگر</li>` : '';
  return `<ul class="task-list">${shown}${more}</ul>`;
}

function block(title, rows, baseUrl) {
  if (!rows.length) return '';
  return `<p class="role-item">${title} <span class="num">(${rows.length})</span></p>${storyList(rows, baseUrl)}`;
}

function roleActions(insights, report) {
  const a = insights?.actions;
  if (!a) return '<p class="section-note">داده‌ای برای پیشنهاد اقدامات در دسترس نیست.</p>';
  const base = report.baseUrl;
  const labelOf = (id) => report.modules.find((m) => m.id === id)?.label || id;
  const sprint = insights.parallelPlan?.sprint;

  const scope = !sprint
    ? 'اطلاعات اسپرینت در دسترس نیست؛ همه‌ی استوری‌های پروژه در نظر گرفته شده‌اند.'
    : sprint.state === 'active'
      ? `مبنا: اسپرینت فعال <b>${esc(sprint.name)}</b>`
      : `اسپرینت فعالی وجود ندارد؛ مبنا اسپرینت بعدی است: <b>${esc(sprint.name)}</b>`;

  const fe = a.frontend;
  const frontend = [
    fe.readyNow.length
      ? block('قابل شروع به‌صورت هم‌زمان — بک‌اند تکمیل شده و از هر ماژول یک مورد انتخاب شده تا در فایل‌های مشترک تداخل ایجاد نشود', fe.readyNow, base)
      : '<p class="role-empty">در حال حاضر استوری آماده‌ای برای شروع فرانت‌اند وجود ندارد.</p>',
    block('پس از ادغام موارد بالا قابل شروع است (هم‌ماژول با موارد بالا)', fe.afterThose, base),
    block('در حال انجام', fe.inProgress, base),
    fe.blockedModules.length
      ? `<p class="role-note">تا پایان کار فرانت‌اند جاری، استوری جدیدی در این ماژول‌ها شروع نشود (فایل‌های مشترک): ${fe.blockedModules.map((id) => esc(labelOf(id))).join('، ')}</p>`
      : '',
    fe.readyOutsideSprint.length
      ? `<p class="role-note">${fe.readyOutsideSprint.length} استوری آماده‌ی فرانت‌اند نیز خارج از این اسپرینت وجود دارد: ${keyList(fe.readyOutsideSprint)}</p>`
      : ''
  ].join('');

  const be = a.backend;
  const backend = (be.inProgress.length || be.notStarted.length)
    ? [
      block('در حال انجام — اولویت با تکمیل این موارد است، زیرا فرانت‌اند به آن‌ها وابسته است', be.inProgress, base),
      block('برنامه‌ریزی‌شده در اسپرینت و هنوز شروع‌نشده', be.notStarted, base)
    ].join('')
    : '<p class="role-empty">کار باقی‌مانده‌ای برای بک‌اند در این محدوده وجود ندارد.</p>';

  const mg = a.management;
  const management = (mg.staleDone.length || mg.noSubtasks.length)
    ? [
      block('تکمیل شده‌اند اما وضعیت آن‌ها در Jira هنوز Done نشده است — وضعیت به‌روز شود', mg.staleDone, base),
      block('در وضعیت In Progress هستند اما ساب‌تسک ندارند — ساب‌تسک‌های بک‌اند و فرانت‌اند تعریف شود', mg.noSubtasks, base)
    ].join('')
    : '<p class="role-empty">مورد نیازمند اقدام وجود ندارد.</p>';

  return `
    <p class="section-note">${scope}</p>
    <div class="roles">
      <div class="role"><h3>تیم فرانت‌اند</h3>${frontend}</div>
      <div class="role"><h3>تیم بک‌اند</h3>${backend}</div>
      <div class="role"><h3>مدیریت پروژه / راهبر تیم</h3>${management}</div>
    </div>`;
}

function statTile(label, color, value, sub) {
  return `<div class="stat"><div class="stat-top"><span class="stat-label">${label}</span><span class="dot" style="background:var(${color})"></span></div><div class="stat-value num" style="color:var(${color})">${Math.round(value)}%</div><div class="stat-sub num">${sub}</div></div>`;
}

export function renderReport(report, { previous = null, insights = null, dailySubtasks = null, dailyStories = null, sprints = null, user = '', projects = [], embedded = false } = {}) {
  const t = report.totals;
  const d = pct(t.done, t.total), w = pct(t.inProgress, t.total), b = pct(t.backlog, t.total);
  const generated = new Date(report.generatedAt).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  const prevDelta = previous?.totals?.done !== undefined ? deltaSpan(t.done, previous.totals.done) : '<span class="delta flat">داده‌ی روز قبل موجود نیست</span>';
  const bullets = insights ? summaryBullets(insights) : [];
  const key = esc(report.projectKey);

  return shell(`ردیاب ${report.projectKey}`, `
    <div class="page">
      ${toolbar({ projects, current: report.projectKey, user, withReportActions: true, embedded })}
      <header>
        <span class="eyebrow">${key} · LIVE</span>
        <h1>ردیاب پروژه ${key}</h1>
        <p class="subtitle">داده‌ی زنده از Jira · زمان تولید: <span class="num">${esc(generated)}</span></p>
      </header>

      <div class="stats">
        ${statTile('انجام‌شده', '--done', d, `${t.done} از ${t.total} استوری &nbsp; ${deltaSpan(t.done, previous?.totals?.done)}`)}
        ${statTile('در حال انجام', '--wip', w, `${t.inProgress} از ${t.total} استوری &nbsp; ${deltaSpan(t.inProgress, previous?.totals?.inProgress)}`)}
        ${statTile('باقی‌مانده', '--backlog', b, `${t.backlog} از ${t.total} استوری &nbsp; ${deltaSpan(t.backlog, previous?.totals?.backlog)}`)}
      </div>

      <section>
        <h2>نمای کلی پیشرفت</h2>
        <p class="section-note">«انجام‌شده» یعنی همه‌ی ساب‌تسک‌های بک‌اند و فرانت‌اند انجام شده باشند، نه صرفاً وضعیت ظاهری استوری.</p>
        <div class="overall-bar">
          <span style="width:${d}%;background:var(--done);">${Math.round(d)}%</span>
          <span style="width:${w}%;background:var(--wip);">${Math.round(w)}%</span>
          <span style="width:${b}%;background:var(--backlog);">${Math.round(b)}%</span>
        </div>
      </section>

      <section>
        <h2>روند ۷ روز گذشته — استوری‌های تکمیل‌شده</h2>
        <p class="section-note">تعداد استوری‌هایی که هر روز به‌طور کامل انجام شده‌اند؛ مبنا تاریخ انجام آخرین ساب‌تسک است، نه تغییر وضعیت خود استوری.</p>
        ${buildStoryChart(dailyStories)}
      </section>

      <section>
        <h2>روند ۷ روز گذشته — ساب‌تسک‌های بک‌اند و فرانت‌اند</h2>
        <p class="section-note">تعداد ساب‌تسک‌های بک‌اند و فرانت‌اند انجام‌شده در هر روز، بر اساس تاریخچه‌ی Jira.</p>
        ${buildSubtaskChart(dailySubtasks, report.lanes)}
      </section>

      <section>
        <h2>پیشرفت به تفکیک ماژول</h2>
        <p class="section-note">مرتب‌شده بر اساس تعداد استوری؛ گروه‌بندی بر اساس پیشوند عنوان (US-XXX) یا اپیک.</p>
        <div class="modules">${report.modules.map(moduleRow).join('')}</div>
      </section>

      <section>
        <h2>استوری‌های در حال انجام</h2>
        <p class="section-note">به تفکیک ماژول؛ ماژول‌های دارای استوری آماده‌ی فرانت‌اند در ابتدا آمده‌اند. برای مشاهده‌ی جزئیات، روی هر ماژول کلیک کنید.</p>
        ${report.inProgressRows.length ? inProgressGroups(report.inProgressRows, report.modules, report.baseUrl) : '<p class="section-note">استوری در حال انجامی وجود ندارد.</p>'}
      </section>

      <section>
        <h2>جدول کامل</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ماژول</th><th class="num">Done</th><th class="num">In&nbsp;Progress</th><th class="num">Backlog</th><th class="num">جمع</th><th class="num">٪Done</th><th class="num">٪In&nbsp;Progress</th><th class="num">٪Backlog</th></tr></thead>
            <tbody>
              ${report.modules.map(tableRow).join('')}
              <tr class="total-row"><td>جمع</td><td class="num">${t.done}</td><td class="num">${t.inProgress}</td><td class="num">${t.backlog}</td><td class="num">${t.total}</td><td class="num">${Math.round(d)}%</td><td class="num">${Math.round(w)}%</td><td class="num">${Math.round(b)}%</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>اسپرینت‌ها</h2>
        <p class="section-note">برای هر اسپرینت: موارد انجام‌شده، انجام‌نشده و باقی‌مانده. وضعیت بر اساس ساب‌تسک‌ها محاسبه شده است.</p>
        ${sprintSection(sprints, report)}
      </section>

      <section>
        <h2>خلاصه اجرایی</h2>
        <p class="summary headline"><span class="num">${Math.round(d)}%</span> از کل پروژه انجام شده است (${t.done} از ${t.total} استوری). ${prevDelta}</p>
        ${bullets.length ? `<ul class="summary">${bullets.join('')}</ul>` : ''}
      </section>

      <section>
        <h2>اقدامات پیشنهادی به تفکیک نقش</h2>
        ${roleActions(insights, report)}
      </section>

      <footer>
        <span>منبع: ${esc(report.baseUrl)} — پروژه ${key}</span>
      </footer>
    </div>`);
}
