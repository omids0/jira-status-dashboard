import { shell } from './shell.js';
import { esc } from './util.js';

const errorLine = (error) => (error ? `<p class="error">${esc(error)}</p>` : '');

/**
 * Login = where Jira is, who you are (token) and which project to look at —
 * all in one step. The project is optional here; without it you get a picker.
 */
export function renderLogin({ baseUrl = '', lockedBaseUrl = null, project = '', error = '' } = {}) {
  const urlField = lockedBaseUrl
    ? `<div class="field"><label>آدرس Jira</label><input value="${esc(lockedBaseUrl)}" readonly dir="ltr"></div>`
    : `<div class="field"><label for="baseUrl">آدرس Jira</label>
         <input id="baseUrl" name="baseUrl" type="url" value="${esc(baseUrl)}" placeholder="https://jira.example.com" required></div>`;

  return shell('ورود — ردیاب Jira', `
    <div class="login-wrap">
      <h1>ردیاب وضعیت پروژه Jira</h1>
      <p>Personal Access Token جیرا رو وارد کن و بگو کدوم پروژه رو می‌خوای ببینی. توکن فقط تو حافظه‌ی همین سشن سرور می‌مونه، رو دیسک ذخیره نمی‌شه.</p>
      ${errorLine(error)}
      <form method="post" action="/login">
        ${urlField}
        <div class="field" style="margin-top:10px;">
          <label for="token">Personal Access Token</label>
          <input id="token" name="token" type="password" placeholder="paste token" autocomplete="off" required autofocus>
        </div>
        <div class="field" style="margin-top:10px;">
          <label for="project">کلید پروژه (اختیاری — مثلاً DMA)</label>
          <input id="project" name="project" type="text" value="${esc(project)}" placeholder="DMA" autocapitalize="characters" pattern="[A-Za-z][A-Za-z0-9_]{1,19}">
          <span class="pick-hint">خالی بذاری، بعد از ورود از لیست پروژه‌هات انتخاب می‌کنی.</span>
        </div>
        <button type="submit" style="margin-top:14px;width:100%;">ورود</button>
      </form>
    </div>`);
}

export function renderProjects({ projects, current = '', user = '', error = '' }) {
  const options = projects.map((p) => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join('');
  return shell('انتخاب پروژه — ردیاب Jira', `
    <div class="login-wrap">
      <h1>کدوم پروژه؟</h1>
      <p>${user ? `سلام ${esc(user)} — ` : ''}کلید یا اسم پروژه رو بنویس و از لیست انتخاب کن (${projects.length} پروژه در دسترسته).</p>
      ${errorLine(error)}
      <form method="post" action="/projects">
        <div class="field">
          <label for="project">پروژه</label>
          <input id="project" name="project" list="project-list" value="${esc(current)}" placeholder="DMA" autocapitalize="characters" required autofocus autocomplete="off">
          <datalist id="project-list">${options}</datalist>
        </div>
        <button type="submit" style="margin-top:14px;width:100%;">نمایش گزارش</button>
      </form>
      <form method="post" action="/logout"><button type="submit" class="tb-link" style="width:100%;">خروج</button></form>
    </div>`);
}

export function renderError({ title, message, backHref = '/', backLabel = 'برگشت' }) {
  return shell(title, `
    <div class="login-wrap">
      <h1>${esc(title)}</h1>
      <div class="err-box"><pre>${esc(message)}</pre></div>
      <a class="tb-link" href="${esc(backHref)}" style="text-align:center;">${esc(backLabel)}</a>
    </div>`);
}
