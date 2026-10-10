import { esc } from './util.js';

function options(projects, current) {
  const known = projects.some((p) => p.key === current);
  return [
    current ? '' : '<option value="" selected disabled>انتخاب پروژه…</option>',
    !known && current ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : '',
    ...projects.map((p) => `<option value="${esc(p.key)}"${p.key === current ? ' selected' : ''}>${esc(p.key)} — ${esc(p.name)}</option>`)
  ].join('');
}

/** Live app: a GET form back to "/". Static export: jump to the sibling KEY.html file. */
function projectSelect(projects, current, staticMode) {
  if (staticMode) {
    return `<div class="proj-pick"><select aria-label="پروژه" onchange="location.href=this.value+'.html'">${options(projects, current)}</select></div>`;
  }
  return `<form class="proj-pick" method="get" action="/">
      <select name="project" aria-label="پروژه" onchange="this.form.submit()">${options(projects, current)}</select>
      <noscript><button type="submit">نمایش</button></noscript>
    </form>`;
}

export function toolbar({ projects, current = '', user = '', withReportActions = false, staticMode = false }) {
  const actions = withReportActions
    ? `${staticMode ? '' : '<a class="tb-link" href="/?refresh=1">تازه‌سازی</a>'}<button type="button" onclick="window.print()">چاپ / PDF</button>`
    : '';
  return `<div class="toolbar">
      ${projectSelect(projects, current, staticMode)}
      <span class="who">${user ? esc(user) : ''}</span>
      ${actions}
      ${staticMode ? '' : '<form method="post" action="/logout"><button type="submit" class="tb-link">خروج</button></form>'}
    </div>`;
}
