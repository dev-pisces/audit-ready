// Built-in evidence checklists for regulated industries. Label on the work item picks the template.
const TEMPLATES = {
  hipaa: { name: 'HIPAA (Healthcare)', items: [
    ['risk', 'Security risk assessment updated for this change'],
    ['phi', 'PHI data flow documented (what PHI, where it goes)'],
    ['access', 'Access review: only minimum necessary roles can see PHI'],
    ['baa', 'Business Associate Agreement checked for any new vendor'],
    ['officer', 'Security / Privacy Officer approval recorded'],
  ]},
  sox: { name: 'SOX (Finance)', items: [
    ['sod', 'Segregation of duties: author is not the approver'],
    ['approval', 'Change approved by the control owner'],
    ['test', 'Test evidence attached (results / screenshots)'],
    ['deploy', 'Deployment approval and date logged'],
    ['recon', 'Post-change reconciliation or review completed'],
  ]},
  iso9001: { name: 'ISO 9001 (Manufacturing)', items: [
    ['ncr', 'Nonconformance described and contained'],
    ['rca', 'Root cause analysis recorded'],
    ['capa', 'Corrective / preventive action defined with owner'],
    ['verify', 'Effectiveness of the action verified'],
    ['docs', 'Controlled documents / work instructions updated'],
  ]},
};
const LABELS = Object.keys(TEMPLATES);
function templateFor(labels = []) {
  const l = labels.map(x => String(x).toLowerCase()).find(x => TEMPLATES[x]);
  return l || null;
}
module.exports = { TEMPLATES, LABELS, templateFor };
