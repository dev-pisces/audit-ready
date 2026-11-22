// Pure logic: evidence state -> readiness. state = { items: { id: { done, by, at, note } } }
const { TEMPLATES } = require('./templates');

function issueStatus(templateKey, state) {
  const t = TEMPLATES[templateKey];
  if (!t) return null;
  const items = (state && state.items) || {};
  const done = t.items.filter(([id]) => items[id] && items[id].done).length;
  const total = t.items.length;
  return { template: templateKey, done, total, percent: Math.round((done / total) * 100),
    missing: t.items.filter(([id]) => !(items[id] && items[id].done)).map(([, label]) => label) };
}

// rows: [{ key, summary, statusCategory, labels, state }]
function projectReadiness(rows) {
  const out = { issues: [], closedWithoutEvidence: [], inProgress: [], complete: [], byTemplate: {} };
  let done = 0, total = 0;
  for (const r of rows) {
    const { templateFor } = require('./templates');
    const t = templateFor(r.labels);
    if (!t) continue;
    const s = issueStatus(t, r.state);
    const row = { key: r.key, summary: r.summary, closed: r.statusCategory === 'done', ...s };
    out.issues.push(row); done += s.done; total += s.total;
    const bt = out.byTemplate[t] = out.byTemplate[t] || { name: TEMPLATES[t].name, issues: 0, complete: 0 };
    bt.issues++;
    if (s.done === s.total) { out.complete.push(row); bt.complete++; }
    else if (row.closed) out.closedWithoutEvidence.push(row);
    else out.inProgress.push(row);
  }
  out.score = total ? Math.round((done / total) * 100) : 100;
  out.status = out.closedWithoutEvidence.length ? 'AUDIT RISK' : out.score >= 90 ? 'AUDIT READY' : 'IN PROGRESS';
  return out;
}
module.exports = { issueStatus, projectReadiness };
