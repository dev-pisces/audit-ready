const assert = require('assert');
const { templateFor } = require('../src/templates');
const { issueStatus, projectReadiness } = require('../src/readiness');
assert.equal(templateFor(['frontend', 'HIPAA']), 'hipaa');
assert.equal(templateFor(['x']), null);
const s = issueStatus('sox', { items: { sod: { done: true }, approval: { done: true } } });
assert.equal(s.done, 2); assert.equal(s.total, 5); assert.equal(s.percent, 40); assert.equal(s.missing.length, 3);
const full = { items: Object.fromEntries(['ncr', 'rca', 'capa', 'verify', 'docs'].map(i => [i, { done: true }])) };
const r = projectReadiness([
  { key: 'A-1', summary: 'a', statusCategory: 'done', labels: ['sox'], state: { items: { sod: { done: true } } } },
  { key: 'A-2', summary: 'b', statusCategory: 'indeterminate', labels: ['hipaa'], state: null },
  { key: 'A-3', summary: 'c', statusCategory: 'done', labels: ['iso9001'], state: full },
  { key: 'A-4', summary: 'd', statusCategory: 'new', labels: ['other'], state: null },
]);
assert.equal(r.issues.length, 3);
assert.deepEqual(r.closedWithoutEvidence.map(i => i.key), ['A-1']);
assert.deepEqual(r.inProgress.map(i => i.key), ['A-2']);
assert.deepEqual(r.complete.map(i => i.key), ['A-3']);
assert.equal(r.status, 'AUDIT RISK'); assert.equal(r.score, 40);
assert.equal(projectReadiness([]).status, 'AUDIT READY');
console.log('readiness tests OK');
