// "True completion": a story counts as Done only when its sub-tasks say so,
// never on the story's own status alone (it regularly lags behind reality).

/**
 * @param {object} input
 * @param {'new'|'indeterminate'|'done'} input.rawCategory  story's own status category
 * @param {{done:boolean, component:string|null}[]} input.subs  the story's sub-tasks
 * @param {{backend:string, frontend:string}} input.components  component names per lane
 */
export function classifyStory({ rawCategory, subs, components }) {
  if (rawCategory === 'done') {
    return { trueState: 'done', subtaskInfo: null, backendDone: true, frontendDone: true };
  }
  if (rawCategory === 'new') {
    return { trueState: 'backlog', subtaskInfo: null, backendDone: false, frontendDone: false };
  }

  const be = subs.filter((t) => t.component === components.backend);
  const fe = subs.filter((t) => t.component === components.frontend);
  const other = subs.filter((t) => t.component !== components.backend && t.component !== components.frontend);
  const count = (list) => list.filter((t) => t.done).length;
  const beDone = count(be);
  const feDone = count(fe);
  const otherDone = count(other);

  const hasLanes = be.length + fe.length > 0;
  // Backend finished but no frontend sub-task yet is NOT complete: frontend
  // simply hasn't started (0 === 0 must not read as "all done").
  const allDone = hasLanes
    ? fe.length > 0 && feDone === fe.length && beDone === be.length && otherDone === other.length
    : subs.length > 0 && otherDone === other.length;

  const subtaskInfo = {
    beDone, beTotal: be.length,
    feDone, feTotal: fe.length,
    otherDone, otherTotal: other.length,
    stale: allDone
  };
  const backendDone = allDone || (be.length > 0 && beDone === be.length);
  const frontendDone = allDone || (fe.length > 0 && feDone === fe.length);
  return { trueState: allDone ? 'done' : 'inprogress', subtaskInfo, backendDone, frontendDone };
}
