// Pure (no fs, no node:*) so the browser bundle can use it too.

export const PROJECT_DEFAULTS = {
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

/** Turns the parsed projects.json into a `projectKey -> effective config` function. */
export function makeProjectConfig(file = {}) {
  const fileDefaults = file.defaults || {};
  const fileProjects = file.projects || {};
  return (key) => {
    const own = fileProjects[key] || {};
    return {
      ...PROJECT_DEFAULTS,
      ...fileDefaults,
      ...own,
      components: { ...PROJECT_DEFAULTS.components, ...fileDefaults.components, ...own.components },
      moduleLabels: { ...fileDefaults.moduleLabels, ...own.moduleLabels }
    };
  };
}
