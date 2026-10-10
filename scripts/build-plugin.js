// Builds the Jira Data Center plugin: dist/jira-status-dashboard-<version>.jar
//
// A resource-only "plugins-version 2" app: no Java, no OSGi manifest (Jira's
// plugin framework turns such jars into bundles itself), so it needs neither
// the Atlassian SDK nor a JDK to build. It contains:
//   - a web-item in Jira's top navigation bar ("ردیاب پروژه")
//   - a web-resource loaded on every page: the dashboard bundle, which opens
//     the full-screen overlay when that item is clicked
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createZip } from './zip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const KEY = 'io.github.omids0.jira-status-dashboard';

// Java .properties files are ISO-8859-1: escape everything else as \uXXXX.
const prop = (s) => s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const descriptor = `<?xml version="1.0" encoding="UTF-8"?>
<atlassian-plugin key="${KEY}" name="Jira Status Dashboard" plugins-version="2">
  <plugin-info>
    <description>Live project status: true completion from sub-tasks, sprints, daily trend and parallel-work suggestions.</description>
    <version>${pkg.version}</version>
    <vendor name="jira-status-dashboard" url="https://github.com/omids0/jira-status-dashboard"/>
  </plugin-info>

  <resource type="i18n" name="i18n" location="jira-status-dashboard"/>

  <web-resource key="dashboard" name="Status dashboard script">
    <resource type="download" name="jira-status-dashboard.js" location="js/jira-status-dashboard.js"/>
    <context>atl.general</context>
  </web-resource>

  <web-item key="dashboard-menu" name="Status dashboard menu item" section="system.top.navigation.bar" weight="210">
    <label key="jira-status-dashboard.menu"/>
    <tooltip key="jira-status-dashboard.tooltip"/>
    <link linkId="jira-status-dashboard-link">/secure/Dashboard.jspa#jira-status-dashboard</link>
    <condition class="com.atlassian.jira.plugin.webfragment.conditions.UserLoggedInCondition"/>
  </web-item>
</atlassian-plugin>
`;

const i18n = [
  `jira-status-dashboard.menu=${prop('ردیاب پروژه')}`,
  `jira-status-dashboard.tooltip=${prop('گزارش وضعیت پروژه، اسپرینت‌ها و روند')}`,
  ''
].join('\n');

const bundle = await build({
  entryPoints: [path.join(root, 'src/browser/plugin.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  legalComments: 'none',
  write: false
});

const jar = createZip([
  { name: 'META-INF/MANIFEST.MF', data: 'Manifest-Version: 1.0\r\nCreated-By: jira-status-dashboard build\r\n\r\n' },
  { name: 'atlassian-plugin.xml', data: descriptor },
  { name: 'jira-status-dashboard.properties', data: i18n },
  { name: 'js/jira-status-dashboard.js', data: Buffer.from(bundle.outputFiles[0].contents) }
]);

const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `jira-status-dashboard-${pkg.version}.jar`);
fs.writeFileSync(file, jar);
console.log(`${path.relative(root, file)} — ${(jar.length / 1024).toFixed(1)} KB`);
