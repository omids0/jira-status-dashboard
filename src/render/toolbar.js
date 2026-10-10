import { esc } from './util.js';

/** Project <select>: choosing one reloads the page on that project's report. */
function projectSelect(projects, current) {
  const known = projects.some((p) => p.key === current);
  const options = [
    current ? '' : '<option value="" selected disabled>انتخاب پروژه…</option>',
    !known && current ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : '',
    ...projects.map((p) => `<option value="${esc(p.key)}"${p.key === current ? ' selected' : ''}>${esc(p.key)} — ${esc(p.name)}</option>`)
  ].join('');
  return `<form class="proj-pick" method="get" action="/">
      <select name="project" aria-label="پروژه" onchange="this.form.submit()">${options}</select>
      <noscript><button type="submit">نمایش</button></noscript>
    </form>`;
}

export function toolbar({ projects, current = '', user = '', withReportActions = false }) {
  return `<div class="toolbar">
      ${projectSelect(projects, current)}
      <span class="who">${user ? esc(user) : ''}</span>
      ${withReportActions ? '<a class="tb-link" href="/?refresh=1">تازه‌سازی</a><button type="button" onclick="window.print()">چاپ / PDF</button>' : ''}
      <form method="post" action="/logout"><button type="submit" class="tb-link">خروج</button></form>
    </div>`;
}
