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

resolver.define('getProject', async ({ context }) => {
  const pkey = context.extension.project.key;
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
});

module.exports = { handler: resolver.getDefinitions() };
