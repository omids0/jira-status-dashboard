import { esc } from './util.js';

const LANE = { backend: 'بک‌اند', frontend: 'فرانت‌اند', other: 'سایر' };

const faNum = (n) => Number(n).toLocaleString('fa-IR');

/** "3 ساعت" / "2 روز و 4 ساعت" — calendar time, not working hours. */
function duration(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return 'کمتر از ۱ ساعت';
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (!d) return `${faNum(h)} ساعت`;
  return h ? `${faNum(d)} روز و ${faNum(h)} ساعت` : `${faNum(d)} روز`;
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
const link = (baseUrl, key) => `<a class="num" href="${esc(`${baseUrl}/browse/${key}`)}" target="_blank" rel="noopener">${esc(key)}</a>`;

function personBody(p, baseUrl) {
  const done = p.done.length
    ? `<table><thead><tr><th>ساب‌تسک</th><th>عنوان</th><th>نوع</th><th>استوری</th><th>تاریخ انجام</th><th>مدت انجام</th></tr></thead><tbody>${
      p.done.map((d) => `<tr>
        <td>${link(baseUrl, d.key)}</td>
        <td style="text-align:right;white-space:normal;"><bdi>${esc(d.summary)}</bdi></td>
        <td>${LANE[d.lane]}</td>
        <td>${d.parentKey ? link(baseUrl, d.parentKey) : '—'}</td>
        <td>${esc(shortDate(d.doneAt))}</td>
        <td>${duration(d.hours)}</td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="role-empty">ساب‌تسکی در این بازه انجام نشده است.</p>';

  const list = (title, rows, render) => rows.length
    ? `<p class="role-item">${title} <span class="num">(${faNum(rows.length)})</span></p><ul class="task-list">${rows.map(render).join('')}</ul>`
    : '';

  return `
    <p class="role-item">ساب‌تسک‌های انجام‌شده</p>
    <div class="table-wrap">${done}</div>
    ${list('بازگشتی — پس از Done دوباره باز شده', p.reopened, (r) => `<li>${link(baseUrl, r.key)} — <bdi>${esc(r.summary)}</bdi> <span class="sp-meta">(${esc(shortDate(r.at))})</span></li>`)}
    ${list('در حال انجام (بار کاری فعلی)', p.inProgress, (r) => `<li>${link(baseUrl, r.key)} — <bdi>${esc(r.summary)}</bdi> <span class="sp-meta">${esc(r.type)} · ${esc(r.status)}</span></li>`)}`;
}

export function peopleSection(peopleReport, baseUrl) {
  if (!peopleReport) return '<p class="section-note">داده‌ی افراد از Jira دریافت نشد (عدم دسترسی یا خطا)؛ سایر بخش‌های گزارش معتبر است.</p>';
  const { people, days } = peopleReport;
  if (!people.length) return `<p class="section-note">در ${faNum(days)} روز گذشته فعالیتی ثبت نشده است.</p>`;

  const rows = people.map((p) => `<tr>
      <td style="text-align:right">${esc(p.name)}</td>
      <td class="num">${p.counts.done}</td>
      <td class="num">${p.counts.backend} / ${p.counts.frontend}${p.counts.other ? ` / ${p.counts.other}` : ''}</td>
      <td>${duration(p.medianHours)}</td>
      <td class="num">${p.reopened.length}</td>
      <td class="num">${p.loggedHours}</td>
      <td class="num">${p.inProgress.length}</td>
    </tr>`).join('');

  const cards = people.map((p) => {
    const chips = [
      `<span class="verdict go"><span class="num">${p.counts.done}</span>&nbsp;انجام‌شده</span>`,
      p.reopened.length ? `<span class="verdict wait"><span class="num">${p.reopened.length}</span>&nbsp;بازگشتی</span>` : '',
      `<span class="verdict fe"><span class="num">${p.inProgress.length}</span>&nbsp;در حال انجام</span>`,
      p.loggedHours ? `<span class="verdict blocked"><span class="num">${p.loggedHours}</span>&nbsp;ساعت ثبت‌شده</span>` : ''
    ].join('');
    return `<details class="mod-acc">
      <summary><span class="mod-acc-name">${esc(p.name)}</span><span class="mod-acc-chips">${chips}</span></summary>
      <div class="mod-acc-body">${personBody(p, baseUrl)}</div>
    </details>`;
  }).join('');

  return `
    <p class="section-note">بازه: ${faNum(days)} روز گذشته (از ${esc(shortDate(peopleReport.since))}). ترتیب الفبایی است، نه رتبه‌بندی.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>فرد</th><th>ساب‌تسک انجام‌شده</th><th>بک‌اند / فرانت‌اند</th><th>میانه‌ی مدت انجام</th><th>بازگشتی</th><th>ساعت ثبت‌شده</th><th>در حال انجام</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:14px">${cards}</div>
    <p class="role-note">این شاخص‌ها فقط فعالیت ثبت‌شده در Jira را نشان می‌دهند و به‌تنهایی معیار کیفیت یا عملکرد نیستند: اندازه و پیچیدگی کارها، بازبینی کد، همکاری و کارهای ثبت‌نشده در این اعداد دیده نمی‌شوند. «مدت انجام» زمان تقویمی از اولین ورود به وضعیت در حال انجام تا آخرین Done است، نه ساعت کاری. «بازگشتی» یعنی کاری که پس از Done دوباره باز شده و می‌تواند نشانه‌ی نیاز به بازبینی دقیق‌تر یا تغییر نیازمندی باشد.</p>`;
}
