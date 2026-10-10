import { esc } from './util.js';

function options(projects, current) {
  const known = projects.some((p) => p.key === current);
  return [
    current ? '' : '<option value="" selected disabled>انتخاب پروژه…</option>',
    !known && current ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : '',
    ...projects.map((p) => `<option value="${esc(p.key)}"${p.key === current ? ' selected' : ''}>${esc(p.key)} — ${esc(p.name)}</option>`)
  ].join('');
}

/**
 * Two hosts for the same page:
 *  - server app: a GET form back to "/", plus refresh / logout links
 *  - embedded (bookmarklet overlay inside Jira): no navigation at all; the
 *    overlay script listens for #jd-project / #jd-refresh / #jd-close.
 */
export function toolbar({ projects, current = '', user = '', withReportActions = false, embedded = false }) {
  const select = embedded
    ? `<div class="proj-pick"><select id="jd-project" aria-label="پروژه">${options(projects, current)}</select></div>`
    : `<form class="proj-pick" method="get" action="/">
      <select name="project" aria-label="پروژه" onchange="this.form.submit()">${options(projects, current)}</select>
      <noscript><button type="submit">نمایش</button></noscript>
    </form>`;

  const refresh = embedded
    ? '<button type="button" id="jd-refresh" class="tb-link">تازه‌سازی</button>'
    : '<a class="tb-link" href="/?refresh=1">تازه‌سازی</a>';
  const actions = withReportActions ? `${refresh}<button type="button" onclick="window.print()">چاپ / PDF</button>` : '';
  const leave = embedded
    ? '<button type="button" id="jd-close" class="tb-link">بستن</button>'
    : '<form method="post" action="/logout"><button type="submit" class="tb-link">خروج</button></form>';

  return `<div class="toolbar">
      ${select}
      <span class="who">${user ? esc(user) : ''}</span>
      ${actions}
      ${leave}
    </div>`;
}
