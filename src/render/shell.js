import { STYLE } from './style.js';
import { esc } from './util.js';

export function shell(title, body) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<script>
// First thing in <head>: a script placed after a stylesheet waits for that stylesheet to load,
// which stalls the parser (and anything that touches the DOM right after document.write).
(function () {
  var KEY = 'jira-dashboard:theme';
  try { var saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved); } catch (e) {}
  window.__jdToggleTheme = function () {
    var root = document.documentElement;
    var current = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  };
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}
