// Browser twin of src/history.js: one snapshot per day per Jira+project, kept
// in localStorage instead of a JSON file.
import { localDateKey } from '../daily.js';

const MAX_ENTRIES = 90;
const PREFIX = 'jira-dashboard:history:';

export function createBrowserHistory(storage) {
  function read(key) {
    try {
      return JSON.parse(storage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function recordAndGetPrevious(scope, report) {
    const key = PREFIX + scope;
    const history = read(key);
    const today = localDateKey(new Date());
    const previous = [...history].reverse().find((h) => h.date !== today) || null;

    const snapshot = { date: today, totals: report.totals };
    const idx = history.findIndex((h) => h.date === today);
    if (idx >= 0) history[idx] = snapshot;
    else history.push(snapshot);
    while (history.length > MAX_ENTRIES) history.shift();

    try {
      storage.setItem(key, JSON.stringify(history));
    } catch {
      // storage full or blocked: trend simply isn't kept
    }
    return previous;
  }

  return { recordAndGetPrevious };
}
