import { shell } from './shell.js';
import { toolbar } from './toolbar.js';
import { esc } from './util.js';

const errorLine = (error) => (error ? `<p class="error">${esc(error)}</p>` : '');

const TOKEN_PATH = '/plugins/servlet/personal-access-tokens';

/** How to get a Personal Access Token from inside Jira (not Confluence — they keep separate tokens). */
function tokenHelp(lockedBaseUrl) {
  const direct = lockedBaseUrl
    ? `<a href="${esc(lockedBaseUrl + TOKEN_PATH)}" target="_blank" rel="noopener">باز کردن صفحه‌ی توکن</a>`
    : `مسیر مستقیم: آدرس Jira + <span class="num">${TOKEN_PATH}</span>`;
  return `<div class="help">
      <b>دریافت توکن</b>
      <ol>
        <li>وارد <b>Jira</b> شوید (نه Confluence؛ توکن‌های این دو سامانه جدا هستند).</li>
        <li>روی تصویر پروفایل کلیک کنید و گزینه‌ی <b>Profile</b> را انتخاب کنید.</li>
        <li>از منوی کناری، <b>Personal Access Tokens</b> را انتخاب کنید. ${direct}</li>
        <li>روی <b>Create token</b> کلیک کنید، یک نام (برای مثال <span class="num">jira-dashboard</span>) و تاریخ انقضا تعیین کنید.</li>
        <li>توکن فقط <b>یک بار</b> نمایش داده می‌شود؛ آن را همان لحظه کپی و در این فیلد وارد کنید.</li>
      </ol>
      <span class="pick-hint">توکن همان دسترسی‌های حساب کاربری شما را دارد؛ بنابراین فقط پروژه‌هایی نمایش داده می‌شوند که در Jira به آن‌ها دسترسی دارید. نسخه‌ی Jira باید Data Center یا Server (۸.۱۴ به بعد) باشد.</span>
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
      <p>Personal Access Token حساب Jira خود را وارد کنید. پس از ورود، پروژه از فهرست بالای صفحه انتخاب می‌شود. توکن فقط در حافظه‌ی همین نشست سرور نگه داشته می‌شود و روی دیسک ذخیره نمی‌شود.</p>
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
        <h2>${fatal ? 'اتصال به Jira ممکن نشد' : 'انتخاب پروژه'}</h2>
        ${errorLine(error)}
        ${fatal ? '' : `<p class="section-note">پروژه‌ی مورد نظر را از فهرست بالای صفحه انتخاب کنید (${projects.length} پروژه در دسترس است).</p>`}
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
