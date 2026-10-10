import { STYLE } from './style.js';
import { esc } from './util.js';

export function shell(title, body, { noindex = false } = {}) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${noindex ? '<meta name="robots" content="noindex,nofollow">\n' : ''}<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}
