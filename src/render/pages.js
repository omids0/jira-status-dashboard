import { shell } from './shell.js';
import { toolbar } from './toolbar.js';
import { esc } from './util.js';

const errorLine = (error) => (error ? `<p class="error">${esc(error)}</p>` : '');

/** Login = where Jira is and who you are. The project is picked afterwards, inside the app. */
export function renderLogin({ baseUrl = '', lockedBaseUrl = null, error = '' } = {}) {
  const urlField = lockedBaseUrl
    ? `<div class="field"><label>آدرس Jira</label><input value="${esc(lockedBaseUrl)}" readonly dir="ltr"></div>`
    : `<div class="field"><label for="baseUrl">آدرس Jira</label>
         <input id="baseUrl" name="baseUrl" type="url" value="${esc(baseUrl)}" placeholder="https://jira.example.com" required></div>`;

  return shell('ورود — ردیاب Jira', `
    <div class="login-wrap">
      <h1>ردیاب وضعیت پروژه Jira</h1>
      <p>Personal Access Token جیرا رو وارد کن. بعد از ورود، پروژه رو از لیست بالای صفحه انتخاب می‌کنی. توکن فقط تو حافظه‌ی همین سشن سرور می‌مونه، رو دیسک ذخیره نمی‌شه.</p>
      ${errorLine(error)}
      <form method="post" action="/login">
        ${urlField}
        <div class="field" style="margin-top:10px;">
          <label for="token">Personal Access Token</label>
          <input id="token" name="token" type="password" placeholder="paste token" autocomplete="off" required autofocus>
        </div>
        <button type="submit" style="margin-top:14px;width:100%;">ورود</button>
      </form>
    </div>`);
}

/** Logged in, no project chosen yet (or the chosen one failed): just the selector. */
export function renderHome({ projects, user = '', error = '' }) {
  return shell('ردیاب Jira', `
    <div class="page">
      ${toolbar({ projects, user })}
      <section>
        <h2>یه پروژه انتخاب کن</h2>
        ${errorLine(error)}
        <p class="section-note">از لیست بالای صفحه پروژه‌ای که می‌خوای ببینی رو انتخاب کن (${projects.length} پروژه در دسترسته).</p>
      </section>
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
