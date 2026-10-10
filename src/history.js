// Tiny local trend tracker: one snapshot per calendar day per Jira+project,
// kept as JSON under DATA_DIR. Gives the report "since yesterday" deltas.

import fs from 'node:fs';
import path from 'node:path';
import { localDateKey } from './daily.js';

const MAX_ENTRIES = 90;

export function createHistory(dataDir) {
  const dir = path.join(dataDir, 'history');

  const fileFor = (scope) => path.join(dir, `${scope.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);

  function read(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  }

  /**
   * Stores today's snapshot (replacing today's earlier one) and returns the
   * latest snapshot from a *different* day, or null.
   */
  function recordAndGetPrevious(scope, report) {
    const file = fileFor(scope);
    const history = read(file);
    const today = localDateKey(new Date());
    const previous = [...history].reverse().find((h) => h.date !== today) || null;

    const snapshot = { date: today, totals: report.totals };
    const idx = history.findIndex((h) => h.date === today);
    if (idx >= 0) history[idx] = snapshot;
    else history.push(snapshot);
    while (history.length > MAX_ENTRIES) history.shift();

    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(history, null, 2));
    } catch (err) {
      console.error(`history not saved (${file}): ${err.message}`);
    }
    return previous;
  }

  return { recordAndGetPrevious };
}
