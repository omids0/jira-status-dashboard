// Usage (all via env):
//   JIRA_BASE_URL=https://jira.example.com JIRA_TOKEN=... PROJECTS=DMA,DEKACP node scripts/build-static.js
// Optional: OUT_DIR (default dist), DATA_DIR (default ./data), PROJECTS_CONFIG.
import { loadConfig } from '../src/config.js';
import { buildStatic } from '../src/staticBuild.js';

try {
  const config = loadConfig();
  const { written, failed } = await buildStatic({
    baseUrl: config.jiraBaseUrl,
    token: process.env.JIRA_TOKEN,
    projects: String(process.env.PROJECTS || '').split(','),
    outDir: process.env.OUT_DIR || 'dist',
    dataDir: config.dataDir,
    projectConfig: config.projectConfig
  });

  for (const key of written) console.log(`built ${key}.html`);
  for (const f of failed) console.error(`FAILED ${f.key}: ${f.message}`);
  // A partial site would silently drop a project from the team's link: fail the job instead.
  process.exit(failed.length || !written.length ? 1 : 0);
} catch (err) {
  console.error(`Static build failed: ${err.message}`);
  process.exit(1);
}
