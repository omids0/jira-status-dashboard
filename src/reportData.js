import { computeInsights, loadReport, pickPlanningSprint } from './report.js';
import { loadDailyCompletions } from './daily.js';
import { loadSprints } from './sprints.js';
import { loadPeopleReport } from './people.js';

/**
 * Everything one report page needs, fetched from Jira. Sprints and the daily
 * charts are optional garnish: if either fails, the rest still renders.
 */
export async function collectReportData(session, projectKey, cfg, history) {
  const [report, sprints, people] = await Promise.all([
    loadReport(session, projectKey, cfg),
    loadSprints(session, projectKey, cfg).catch((err) => {
      console.error(`sprints skipped: ${err.message}`);
      return null;
    }),
    loadPeopleReport(session, projectKey, cfg, 7).catch((err) => {
      console.error(`people report skipped: ${err.message}`);
      return null;
    })
  ]);
  const daily = await loadDailyCompletions(session, projectKey, cfg, report.doneStoryKeys, 7).catch((err) => {
    console.error(`daily charts skipped: ${err.message}`);
    return { subtasks: null, stories: null };
  });

  const host = new URL(session.baseUrl).host;
  return {
    report,
    sprints,
    people,
    daily,
    insights: computeInsights(report, pickPlanningSprint(sprints)),
    previous: history.recordAndGetPrevious(`${host}__${projectKey}`, report)
  };
}
