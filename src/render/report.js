import { shell } from './shell.js';
import { buildStoryChart, buildSubtaskChart } from './charts.js';
import { sprintSection } from './sprints.js';
import { inProgressGroups } from './verdicts.js';
import { deltaSpan, esc, pct } from './util.js';

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
  if (insights.readyForFrontend.length) out.push(`<li><b>${insights.readyForFrontend.length} استوری</b> بک‌اندشون کامله، آماده‌ی فرانتن: ${keyList(insights.readyForFrontend)}</li>`);
  if (insights.noSubtaskYet.length) out.push(`<li><b>${insights.noSubtaskYet.length} استوری</b> status‌شون In Progress‌ه ولی هیچ ساب‌تسکی ندارن — یا کار شروع نشده یا status اشتباه خورده: ${keyList(insights.noSubtaskYet)}</li>`);
  if (insights.staleDone.length) out.push(`<li><b>${insights.staleDone.length} استوری</b> واقعاً کامل بودن ولی status جیراشون هنوز نخورده (stale): ${keyList(insights.staleDone)}</li>`);
  if (insights.zeroProgressModules.length) out.push(`<li>ماژول‌های هنوز صفردرصد: <b>${insights.zeroProgressModules.map((m) => esc(m.label)).join('، ')}</b></li>`);
  if (insights.leadModule) out.push(`<li>جلوترین ماژول: <b>${esc(insights.leadModule.label)}</b> (${Math.round(pct(insights.leadModule.done, insights.leadModule.total))}%)</li>`);
  return out;
}

function parallelPlanHtml(insights, report) {
  const plan = insights?.parallelPlan;
  const now = plan?.now || [];
  const labelOf = (id) => report.modules.find((m) => m.id === id)?.label || id;
  const blocked = plan?.blockedModules?.length
    ? `<p class="section-note">ماژول‌های کنار گذاشته‌شده چون یه استوریشون فرانتش در حال انجامه، فایل مشترک می‌خورن: ${plan.blockedModules.map((id) => esc(labelOf(id))).join('، ')}</p>`
    : '';
  const sprint = plan?.sprint;
  const scope = sprint
    ? `<p class="section-note">فقط استوری‌های ${sprint.state === 'active' ? 'اسپرینت فعال' : 'اسپرینت بعدی (اسپرینت فعالی نیست)'}: <b>${esc(sprint.name)}</b></p>`
    : '<p class="section-note">اسپرینتی پیدا نشد (یا خونده نشد) — همه‌ی استوری‌های پروژه در نظر گرفته شدن.</p>';
  const outside = plan?.outsideSprint?.length
    ? `<p class="section-note">${plan.outsideSprint.length} استوری آماده‌ی فرانت دیگه هست که تو این اسپرینت نیست: ${plan.outsideSprint.map((r) => `<span class="num">${esc(r.key)}</span>`).join('، ')}</p>`
    : '';
  if (now.length === 0) return `${scope}<p class="section-note">الان هیچی برای صدا زدن موازی نیست.</p>${blocked}${outside}`;
  const rows = now.map((r) => `<tr>
        <td class="num">${esc(r.key)}</td>
        <td style="text-align:right;white-space:normal;">${esc(r.summary)}</td>
        <td><a href="${esc(`${report.baseUrl}/browse/${r.key}`)}" target="_blank" rel="noopener">باز کن</a></td>
      </tr>`).join('');
  return `${scope}<div class="table-wrap"><table><thead><tr><th>استوری</th><th>عنوان</th><th>لینک</th></tr></thead><tbody>${rows}</tbody></table></div>${blocked}${outside}`;
}

function statTile(label, color, value, sub) {
  return `<div class="stat"><div class="stat-top"><span class="stat-label">${label}</span><span class="dot" style="background:var(${color})"></span></div><div class="stat-value num" style="color:var(${color})">${Math.round(value)}%</div><div class="stat-sub num">${sub}</div></div>`;
}

export function renderReport(report, { previous = null, insights = null, dailySubtasks = null, dailyStories = null, sprints = null, user = '' } = {}) {
  const t = report.totals;
  const d = pct(t.done, t.total), w = pct(t.inProgress, t.total), b = pct(t.backlog, t.total);
  const generated = new Date(report.generatedAt).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  const prevDelta = previous?.totals?.done !== undefined ? deltaSpan(t.done, previous.totals.done) : '<span class="delta flat">دیتای دیروز نیست</span>';
  const bullets = insights ? summaryBullets(insights) : [];
  const key = esc(report.projectKey);

  return shell(`ردیاب ${report.projectKey}`, `
    <div class="page">
      <div class="toolbar">
        <span class="who">${user ? esc(user) : ''}</span>
        <a class="tb-link" href="/?refresh=1">تازه‌سازی</a>
        <a class="tb-link" href="/projects">تغییر پروژه</a>
        <button type="button" onclick="window.print()">چاپ / PDF</button>
        <form method="post" action="/logout"><button type="submit" class="tb-link">خروج</button></form>
      </div>
      <header>
        <span class="eyebrow">${key} · LIVE</span>
        <h1>ردیاب پروژه ${key}</h1>
        <p class="subtitle">دیتای زنده از Jira · تولید شد: <span class="num">${esc(generated)}</span></p>
      </header>

      <div class="stats">
        ${statTile('انجام‌شده', '--done', d, `${t.done} از ${t.total} استوری &nbsp; ${deltaSpan(t.done, previous?.totals?.done)}`)}
        ${statTile('در حال انجام', '--wip', w, `${t.inProgress} از ${t.total} استوری &nbsp; ${deltaSpan(t.inProgress, previous?.totals?.inProgress)}`)}
        ${statTile('باقی‌مانده', '--backlog', b, `${t.backlog} از ${t.total} استوری &nbsp; ${deltaSpan(t.backlog, previous?.totals?.backlog)}`)}
      </div>

      <section>
        <h2>نمای کلی پیشرفت</h2>
        <p class="section-note">Done یعنی همه‌ی ساب‌تسک‌های بک‌اند و فرانت واقعاً Done باشن — نه status ظاهری استوری</p>
        <div class="overall-bar">
          <span style="width:${d}%;background:var(--done);">${Math.round(d)}%</span>
          <span style="width:${w}%;background:var(--wip);">${Math.round(w)}%</span>
          <span style="width:${b}%;background:var(--backlog);">${Math.round(b)}%</span>
        </div>
      </section>

      <section>
        <h2>روند ۷ روز گذشته — استوری‌های Done‌شده</h2>
        <p class="section-note">هر روز چندتا استوری واقعاً کامل شد — روزی که آخرین ساب‌تسکش Done شد، نه روزی که status خود استوری تغییر کرد</p>
        ${buildStoryChart(dailyStories)}
      </section>

      <section>
        <h2>روند ۷ روز گذشته — ساب‌تسک بک‌اند در برابر فرانت</h2>
        <p class="section-note">هر روز چندتا ساب‌تسک بک‌اند و چندتا فرانت Done شده — مستقیم از تاریخچه‌ی Jira (changelog)</p>
        ${buildSubtaskChart(dailySubtasks, report.lanes)}
      </section>

      <section>
        <h2>پیشرفت به تفکیک ماژول</h2>
        <p class="section-note">به‌ترتیب تعداد استوری — گروه‌بندی از پیشوند عنوان (US-XXX) یا اپیک استوری</p>
        <div class="modules">${report.modules.map(moduleRow).join('')}</div>
      </section>

      <section>
        <h2>تسک‌های در حال انجام</h2>
        <p class="section-note">به‌تفکیک ماژول — ماژولی که استوری آماده‌ی فرانت داره بالاتره. روی هر ماژول بزن تا استوری‌هاش باز شه</p>
        ${report.inProgressRows.length ? inProgressGroups(report.inProgressRows, report.modules, report.baseUrl) : '<p class="section-note">هیچ استوری In Progress‌ای نیست</p>'}
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
        <p class="section-note">چی تو هر اسپرینت زدیم، چی نزدیم، چی باید بزنیم — وضعیت واقعی از رو ساب‌تسک‌ها، نه status ظاهری استوری</p>
        ${sprintSection(sprints, report)}
      </section>

      <section>
        <h2>خلاصه اجرایی</h2>
        <p class="summary headline"><span class="num">${Math.round(d)}%</span> کل پروژه Done — ${t.done} از ${t.total} استوری. ${prevDelta}</p>
        ${bullets.length ? `<ul class="summary">${bullets.join('')}</ul>` : ''}
      </section>

      <section>
        <h2>الان می‌تونی این‌ها رو هم‌زمان صدا بزنی</h2>
        ${parallelPlanHtml(insights, report)}
      </section>

      <footer>
        <span>منبع: ${esc(report.baseUrl)} — پروژه ${key}</span>
      </footer>
    </div>`);
}
