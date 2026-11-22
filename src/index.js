const api = require('@forge/api');
const { route } = api;
const Resolver = require('@forge/resolver').default;
const { TEMPLATES, LABELS, templateFor } = require('./templates');
const { issueStatus, projectReadiness } = require('./readiness');

const PROP = 'audit-ready';

async function jira(path, opts = {}) {
  const who = opts.asApp ? api.asApp() : api.asUser();
  const res = await who.requestJira(path, {
    ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : {};
}

async function loadIssue(key) {
  const issue = await jira(route`/rest/api/3/issue/${key}?fields=labels,summary,status`);
  const prop = await jira(route`/rest/api/3/issue/${key}/properties/${PROP}`, { allow404: true });
  const state = (prop && prop.value) || { items: {}, history: [] };
  const t = state.template || templateFor(issue.fields.labels);
  return { issue, state, template: t };
}

function view(key, { issue, state, template }) {
  if (!template) return { key, template: null, templates: LABELS.map(k => ({ key: k, name: TEMPLATES[k].name })) };
  const s = issueStatus(template, state);
  return { key, template, templateName: TEMPLATES[template].name, ...s,
    closed: issue.fields.status.statusCategory.key === 'done',
    items: TEMPLATES[template].items.map(([id, label]) => ({ id, label, ...(state.items[id] || { done: false }) })),
    history: (state.history || []).slice(-6).reverse() };
}

// Writes run as the app, but only after confirming the current user may edit the work item.
async function assertCanEdit(key) {
  const p = await jira(route`/rest/api/3/mypermissions?issueKey=${key}&permissions=EDIT_ISSUES`);
  if (!(p.permissions && p.permissions.EDIT_ISSUES && p.permissions.EDIT_ISSUES.havePermission))
    throw new Error('You need Edit permission on this work item to change its evidence.');
}
async function userName(accountId) {
  const u = await jira(route`/rest/api/3/user?accountId=${accountId}`, { asApp: true });
  return u.displayName || 'Unknown user';
}

const resolver = new Resolver();
const issueKey = (context) => context.extension.issue.key;

resolver.define('getIssue', async ({ context }) => {
  const key = issueKey(context); return view(key, await loadIssue(key));
});

resolver.define('setTemplate', async ({ payload, context }) => {
  const key = issueKey(context); const t = payload.template;
  if (!TEMPLATES[t]) throw new Error('Unknown template');
  const cur = await loadIssue(key);
  await assertCanEdit(key);
  const state = { ...cur.state, template: t };
  await jira(route`/rest/api/3/issue/${key}/properties/${PROP}`, { method: 'PUT', body: JSON.stringify(state), asApp: true });
  // label keeps the project report and JQL in sync
  await jira(route`/rest/api/3/issue/${key}`, { method: 'PUT', body: JSON.stringify({ update: { labels: [{ add: t }] } }), asApp: true });
  return view(key, { ...cur, state, template: t });
});

resolver.define('toggleItem', async ({ payload, context }) => {
  const key = issueKey(context);
  const cur = await loadIssue(key);
  if (!cur.template) throw new Error('No checklist on this work item');
  await assertCanEdit(key);
  const by = await userName(context.accountId);
  const at = new Date().toISOString();
  const items = { ...cur.state.items, [payload.id]: { done: !!payload.done, by, at, note: payload.note || '' } };
  const history = [...(cur.state.history || []), { id: payload.id, done: !!payload.done, by, at }].slice(-50);
  const state = { ...cur.state, template: cur.template, items, history };
  await jira(route`/rest/api/3/issue/${key}/properties/${PROP}`, { method: 'PUT', body: JSON.stringify(state), asApp: true });
  return view(key, { ...cur, state });
});

async function computeProject(pkey) {
  pkey = String(pkey || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(pkey)) throw new Error('projectKey is required, e.g. PP');
  const jql = `project = "${pkey}" AND labels in (${LABELS.join(',')}) ORDER BY updated DESC`;
  let rows = [], token;
  do {
    const d = token
      ? await jira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=summary,status,labels&properties=${PROP}&nextPageToken=${token}`)
      : await jira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=summary,status,labels&properties=${PROP}`);
    rows = rows.concat((d.issues || []).map(i => {
      const st = (i.properties && i.properties[PROP]) || null;
      return { key: i.key, summary: i.fields.summary, statusCategory: i.fields.status.statusCategory.key,
        labels: st && st.template ? [st.template] : i.fields.labels, state: st };
    }));
    token = d.nextPageToken;
  } while (token && rows.length < 500);
  return { project: pkey, ...projectReadiness(rows) };
}

resolver.define('getProject', async ({ context }) => computeProject(context.extension.project.key));

// Rovo actions
const slim = (r) => ({ key: r.key, summary: r.summary, checklist: r.template, evidence: `${r.done}/${r.total}`, closed: r.closed, missing: r.missing });
async function getAuditReadiness(payload) {
  try {
    const d = await computeProject(payload.projectKey);
    return { project: d.project, readinessPercent: d.score, status: d.status, regulatedItems: d.issues.length,
      byRegulation: Object.values(d.byTemplate),
      closedWithoutEvidence: d.closedWithoutEvidence.map(slim), inProgress: d.inProgress.map(slim).slice(0, 20),
      complete: d.complete.map(r => r.key) };
  } catch (e) { return { error: e.message }; }
}
async function getEvidenceStatus(payload) {
  try {
    const key = String(payload.issueKey || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) throw new Error('issueKey is required, e.g. PP-1');
    const v = view(key, await loadIssue(key));
    if (!v.template) return { key, checklist: null, note: 'No compliance checklist on this work item (label it hipaa, sox or iso9001).' };
    return { key, checklist: v.templateName, closed: v.closed, evidence: `${v.done}/${v.total}`,
      items: v.items.map(i => ({ item: i.label, done: !!i.done, confirmedBy: i.by || null, on: i.at ? i.at.slice(0, 10) : null })) };
  } catch (e) { return { error: e.message }; }
}

module.exports = { handler: resolver.getDefinitions(), getAuditReadiness, getEvidenceStatus };
