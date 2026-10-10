import { createApp } from './src/app.js';
import { loadConfig } from './src/config.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}
const app = createApp(config);

const server = app.listen(config.port, config.host, () => {
  const shown = config.host === '0.0.0.0' ? 'localhost' : config.host;
  console.log(`Jira status dashboard listening on http://${shown}:${config.port}`);
  console.log(config.jiraBaseUrl ? `Jira locked to ${config.jiraBaseUrl}` : 'Jira URL is entered at login');
});

server.on('error', (err) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${config.port} is already in use — set another one with PORT=<number>`
      : err.message
  );
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    app.close();
    server.close(() => process.exit(0));
  });
}
