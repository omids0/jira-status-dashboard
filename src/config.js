import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBaseUrl } from './jiraClient.js';
import { makeProjectConfig } from './projectConfig.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${file}: ${err.message}`);
  }
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${value}"`);
  return n;
}

export function loadConfig(env = process.env) {
  const file = readJson(env.PROJECTS_CONFIG || path.join(ROOT, 'config', 'projects.json'));

  const jiraBaseUrl = env.JIRA_BASE_URL ? normalizeBaseUrl(env.JIRA_BASE_URL) : null;
  if (env.JIRA_BASE_URL && !jiraBaseUrl) throw new Error(`JIRA_BASE_URL is not a valid http(s) URL: ${env.JIRA_BASE_URL}`);

  return {
    port: positiveInt(env.PORT, 4173, 'PORT'),
    host: env.HOST || '127.0.0.1',
    jiraBaseUrl,
    defaultProject: env.DEFAULT_PROJECT || '',
    dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
    sessionTtlMs: positiveInt(env.SESSION_TTL_MINUTES, 480, 'SESSION_TTL_MINUTES') * 60_000,
    reportCacheMs: positiveInt(env.REPORT_CACHE_SECONDS, 30, 'REPORT_CACHE_SECONDS') * 1000,
    trustProxy: env.TRUST_PROXY === 'true',
    projectConfig: makeProjectConfig(file)
  };
}
