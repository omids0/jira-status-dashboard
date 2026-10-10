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

صفحه‌ی ورود فقط آدرس Jira و توکن می‌خواد. بعد از ورود، بالای صفحه یه **سلکت‌باکس** با همه‌ی پروژه‌هایی که بهشون دسترسی داری هست؛ هر پروژه‌ای رو انتخاب کنی همون لحظه گزارشش باز می‌شه، و هر وقت خواستی از همون سلکت عوضش می‌کنی. انتخاب تا آخر سشن می‌مونه. لینک مستقیم هم داری: `/?project=KEY`.

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

## گزارش اشتراکی روی GitHub Pages (بدون سرور)

برای اینکه فقط با GitHub یه **لینک** به همکارا بدی: یه workflow زمان‌بندی‌شده (`.github/workflows/report.yml`) از Jira می‌خونه، برای هر پروژه یه صفحه‌ی HTML ثابت می‌سازه و روی GitHub Pages می‌ذاره. همکارا بدون لاگین و بدون نصب چیزی لینک رو باز می‌کنن و با سلکت‌باکس بین پروژه‌ها جابه‌جا می‌شن. گزارش یه **عکس لحظه‌ای**ـه که خودکار تازه می‌شه (پیش‌فرض: ساعتی، در ساعات کاری شنبه تا چهارشنبه)، نه زنده.

**یک‌بار راه‌اندازی** (تو ریپو → Settings):
1. **Pages → Build and deployment → Source: GitHub Actions**.
2. **Secrets and variables → Actions → Secrets:**
   - `JIRA_TOKEN` = Personal Access Token. بهتره از یه اکانت فقط‌خواندنی/سرویس بسازی؛ توکن همه‌ی دسترسی‌های صاحبش رو داره.
   - `REPORT_PASSWORD` = یه رمز برای تیم (پایین توضیح داده).
3. **Variables:**
   - `JIRA_BASE_URL` = `https://jira.entekhabgroup.com`
   - `PROJECTS` = `DMA,DEKACP` (کلید پروژه‌هایی که می‌خوای تو سلکت باشن)
4. **Actions → Publish report → Run workflow**. بعد از چند دقیقه لینک تو خروجی job (و تو Settings → Pages) میاد: `https://<user>.github.io/jira-status-dashboard/`.

**امنیت — مهم:**
- Pages روی ریپوی **public** برای کل اینترنت بازه، و عنوان استوری‌های شرکت تو گزارشه. برای همین اگه `REPORT_PASSWORD` ست باشه، صفحه‌ها قبل از انتشار با AES رمزنگاری می‌شن (staticrypt) و فقط با رمز تیم باز می‌شن. اگه ریپو public باشه و رمز نذاشته باشی، workflow عمداً fail می‌شه.
- Pages خصوصی (فقط اعضای ریپو) فقط تو پلن‌های Enterprise Cloud هست.
- رمز تیم رو جدا از لینک بده، و هر وقت یه نفر از تیم رفت عوضش کن.

**محدودیت اصلی:** runnerهای GitHub از اینترنت می‌خونن، پس Jira باید از بیرون شبکه‌ی شرکت در دسترس باشه. اگه نیست، job تو مرحله‌ی «Build pages from Jira» با `Cannot reach Jira` fail می‌شه (و صفحه‌ی قبلی سر جاش می‌مونه). اون موقع باید از نسخه‌ی لایو روی یه ماشین داخلی استفاده کنی.

**اجرای دستی و تست لوکال:**

```bash
JIRA_BASE_URL=https://jira.entekhabgroup.com JIRA_TOKEN=... PROJECTS=DMA,DEKACP npm run build:static
# خروجی: dist/DMA.html, dist/DEKACP.html, dist/index.html
```

تاریخچه‌ی «نسبت به دیروز» بین اجراها با cache خود GitHub Actions نگه داشته می‌شه.

## تنظیمات (متغیر محیطی)

| متغیر | پیش‌فرض | کار |
|---|---|---|
| `PORT` | `4173` | پورت |
| `HOST` | `127.0.0.1` | `0.0.0.0` برای سرور/داکر |
| `JIRA_BASE_URL` | — | اگه بذاری، اپ فقط به همین Jira وصل می‌شه و فیلد آدرس از صفحه‌ی ورود حذف می‌شه |
| `DEFAULT_PROJECT` | — | پروژه‌ای که بعد از ورود خودکار باز بشه (بدون این، اول فقط سلکت‌باکس می‌بینی) |
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
src/app.js             مسیرها: /login / (گزارش + سلکت پروژه) /logout
src/jiraClient.js      کلاینت REST
src/classify.js        منطق «Done واقعی»
src/report.js          گزارش + خلاصه + پیشنهاد اجرای موازی
src/daily.js           روند روزانه از changelog
src/sprints.js         اسپرینت‌ها (Jira Agile)
src/history.js         تاریخچه‌ی روزانه
src/render/            HTML
src/staticBuild.js     ساخت صفحه‌های ثابت برای Pages
scripts/build-static.js  CLI ساخت صفحه‌های ثابت
config/projects.json   تنظیمات هر پروژه
```
