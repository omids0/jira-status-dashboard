import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBaseUrl } from './jiraClient.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROJECT_DEFAULTS = {
  // Extra JQL ANDed onto the story query, e.g. 'summary ~ "US-"'. Empty = every story.
  storyJql: '',
  storyIssueTypes: ['Story'],
  // Jira component names that mark a sub-task as backend / frontend work.
  components: { backend: 'Back-End', frontend: 'Front-End' },
  // How stories are grouped into "modules": prefix | epic | none | auto.
  moduleBy: 'auto',
  modulePattern: 'US-([A-Z]+)-\\d+',
  moduleLabels: {},
  recentClosedSprints: 2
};

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
  const fileDefaults = file.defaults || {};
  const fileProjects = file.projects || {};

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
    projectConfig(key) {
      const own = fileProjects[key] || {};
      return {
        ...PROJECT_DEFAULTS,
        ...fileDefaults,
        ...own,
        components: { ...PROJECT_DEFAULTS.components, ...fileDefaults.components, ...own.components },
        moduleLabels: { ...fileDefaults.moduleLabels, ...own.moduleLabels }
      };
    }
  };
}
