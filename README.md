# ردیاب وضعیت پروژه Jira

داشبورد زنده برای هر پروژه‌ی Jira (Data Center). با Personal Access Token وارد می‌شی، پروژه رو انتخاب می‌کنی (DMA، DEKACP، هرچی)، و گزارش مستقیم از Jira ساخته می‌شه:

- **پیشرفت واقعی** — استوری فقط وقتی Done حساب می‌شه که ساب‌تسک‌هاش (بک‌اند و فرانت) Done باشن، نه status ظاهری خود استوری.
- **روند ۷ روز گذشته** — از changelog خود Jira: چندتا استوری و چندتا ساب‌تسک بک‌اند/فرانت هر روز Done شد.
- **اسپرینت‌ها** — هر اسپرینت: چی زدیم، چی نزدیم، چی باید بزنیم، چی از اسپرینت قبل مونده.
- **ماژول‌ها** — گروه‌بندی از پیشوند عنوان (`US-XXX-01`) یا از اپیک، هرکدوم برای پروژه‌ای که داره.
- **خلاصه اجرایی و لیست «همین الان هم‌زمان بزن»** — کدوم استوری‌ها بک‌اندشون تمومه و فرانتشون شروع نشده، بدون تداخل با کار در حال انجام.
- چاپ / PDF، مقایسه با دیروز.

## اجرا

```bash
npm install
npm start            # http://localhost:4173
```

پورت رو با `PORT` عوض کن: `PORT=5000 npm start` (PowerShell: `$env:PORT=5000; npm start`).

صفحه‌ی ورود سه چیز می‌خواد: آدرس Jira، توکن، و (اختیاری) کلید پروژه. کلید رو ندی، بعد از ورود از لیست پروژه‌هات انتخاب می‌کنی. هر وقت خواستی از «تغییر پروژه» یا `/?project=KEY` عوضش کن.

### ساخت توکن
Jira → آواتار پروفایل → **Personal Access Tokens** (`/plugins/servlet/personal-access-tokens`) → Create token.

> فقط **Jira Server / Data Center** (احراز هویت Bearer). Jira Cloud با email + API token کار می‌کنه و API جستجوش فرق داره — پشتیبانی نمی‌شه.

## اجرا با Docker

```bash
docker compose up -d --build        # http://localhost:4173
```

یا بدون compose:

```bash
docker build -t jira-dashboard .
docker run -d -p 4173:4173 -v jira-dashboard-data:/data jira-dashboard
```

ولوم `/data` تاریخچه‌ی روزانه رو نگه می‌داره (برای «نسبت به دیروز»).

## تنظیمات (متغیر محیطی)

| متغیر | پیش‌فرض | کار |
|---|---|---|
| `PORT` | `4173` | پورت |
| `HOST` | `127.0.0.1` | `0.0.0.0` برای سرور/داکر |
| `JIRA_BASE_URL` | — | اگه بذاری، اپ فقط به همین Jira وصل می‌شه و فیلد آدرس از صفحه‌ی ورود حذف می‌شه |
| `DEFAULT_PROJECT` | — | پیش‌فرض فیلد پروژه تو صفحه‌ی ورود |
| `DATA_DIR` | `./data` | مسیر تاریخچه |
| `SESSION_TTL_MINUTES` | `480` | عمر سشن بی‌فعالیت |
| `REPORT_CACHE_SECONDS` | `30` | کش کوتاه گزارش؛ دکمه‌ی «تازه‌سازی» دورش می‌زنه |
| `TRUST_PROXY` | `false` | پشت reverse proxy با HTTPS، `true` بذار تا کوکی `Secure` بشه |
| `PROJECTS_CONFIG` | `config/projects.json` | مسیر کانفیگ پروژه‌ها |

**اگه روی سرور مشترک می‌ذاریش:** حتماً `JIRA_BASE_URL` رو ست کن (وگرنه هر کاربر می‌تونه سرور رو به هر آدرسی وصل کنه) و پشت HTTPS بذار. توکن فقط تو حافظه‌ی سرور می‌مونه، با ری‌استارت پاک می‌شه.

## کانفیگ هر پروژه — `config/projects.json`

بدون هیچ کانفیگی هم هر پروژه‌ای کار می‌کنه. برای دقیق‌تر شدن:

```json
{
  "defaults": { "components": { "backend": "Back-End", "frontend": "Front-End" }, "moduleBy": "auto" },
  "projects": {
    "DEKACP": {
      "storyJql": "labels = panel",
      "moduleBy": "epic",
      "components": { "backend": "API", "frontend": "UI" },
      "moduleLabels": { "ABC": "نام فارسی ماژول" }
    }
  }
}
```

| کلید | معنی |
|---|---|
| `storyJql` | JQL اضافه برای فیلتر استوری‌ها (مثلاً `summary ~ "US-"`). خالی = همه‌ی استوری‌ها |
| `storyIssueTypes` | نوع issue استوری، پیش‌فرض `["Story"]` |
| `components` | اسم کامپوننت‌های Jira که ساب‌تسک بک‌اند / فرانت رو مشخص می‌کنن |
| `moduleBy` | `prefix` (از `US-XXX-01` تو عنوان) · `epic` · `none` · `auto` (پیش‌فرض: اگه ≥۵۰٪ عنوان‌ها پیشوند داشتن prefix، وگرنه epic، وگرنه یه گروه) |
| `modulePattern` | regex پیشوند، پیش‌فرض `US-([A-Z]+)-\d+` |
| `moduleLabels` | اسم نمایشی ماژول‌ها |
| `recentClosedSprints` | چندتا اسپرینت بسته‌ی آخر نشون داده بشه (پیش‌فرض ۲) |

پروژه‌ای که ساب‌تسک‌هاش کامپوننت بک‌اند/فرانت ندارن هم کار می‌کنه: استوری وقتی Done حساب می‌شه که همه‌ی ساب‌تسک‌هاش Done باشن.

## تست

```bash
npm test
```

با یه Jira ساختگی (`test-support/fakeJira.js`) لاگین، انتخاب پروژه، گروه‌بندی با اپیک، کش، تاریخچه و خروج رو تست می‌کنه.

## ساختار

```
server.js              راه‌اندازی
src/app.js             مسیرها: /login /projects / /logout
src/jiraClient.js      کلاینت REST
src/classify.js        منطق «Done واقعی»
src/report.js          گزارش + خلاصه + پیشنهاد اجرای موازی
src/daily.js           روند روزانه از changelog
src/sprints.js         اسپرینت‌ها (Jira Agile)
src/history.js         تاریخچه‌ی روزانه
src/render/            HTML
config/projects.json   تنظیمات هر پروژه
```
