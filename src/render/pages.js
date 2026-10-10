import { shell } from './shell.js';
import { toolbar } from './toolbar.js';
import { esc } from './util.js';

const errorLine = (error) => (error ? `<p class="error">${esc(error)}</p>` : '');

const TOKEN_PATH = '/plugins/servlet/personal-access-tokens';

/** How to get a Personal Access Token from inside Jira (not Confluence — they keep separate tokens). */
function tokenHelp(lockedBaseUrl) {
  const direct = lockedBaseUrl
    ? `<a href="${esc(lockedBaseUrl + TOKEN_PATH)}" target="_blank" rel="noopener">مستقیم باز کن</a>`
    : `یا مستقیم: آدرس Jira + <span class="num">${TOKEN_PATH}</span>`;
  return `<div class="help">
      <b>توکن رو از کجا بیارم؟</b>
      <ol>
        <li>وارد <b>Jira</b> بشو (نه Confluence یا ویکی — توکن‌هاشون جداست).</li>
        <li>روی آواتار پروفایلت کلیک کن و <b>Profile</b> رو بزن.</li>
        <li>از منوی کناری <b>Personal Access Tokens</b> رو انتخاب کن. ${direct}</li>
        <li><b>Create token</b> رو بزن، یه اسم بده (مثلاً <span class="num">jira-dashboard</span>) و تاریخ انقضا انتخاب کن.</li>
        <li>توکن فقط <b>یه بار</b> نشون داده می‌شه — همون لحظه کپی کن و اینجا paste کن.</li>
      </ol>
      <span class="pick-hint">توکن همون دسترسی‌های حساب خودت رو داره، یعنی فقط پروژه‌هایی رو می‌بینی که تو Jira بهشون دسترسی داری. نسخه‌ی Jira باید Data Center یا Server (۸.۱۴ به بعد) باشه.</span>
    </div>`;
}

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
          ${tokenHelp(lockedBaseUrl)}
        </div>
        <button type="submit" style="margin-top:14px;width:100%;">ورود</button>
      </form>
    </div>`);
}

/** Logged in, no project chosen yet (or the chosen one failed): just the selector. */
export function renderHome({ projects, user = '', error = '', embedded = false, fatal = false }) {
  return shell('ردیاب Jira', `
    <div class="page">
      ${toolbar({ projects, user, embedded, hideProjects: fatal })}
      <section>
        <h2>${fatal ? 'اتصال به Jira ممکن نشد' : 'یه پروژه انتخاب کن'}</h2>
        ${errorLine(error)}
        ${fatal ? '' : `<p class="section-note">از لیست بالای صفحه پروژه‌ای که می‌خوای ببینی رو انتخاب کن (${projects.length} پروژه در دسترسته).</p>`}
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
