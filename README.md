# Audit Ready: evidence checklists for regulated teams in Jira (Atlassian Forge)

Healthcare, finance and manufacturing teams must prove that every regulated change followed the rules. In Jira, work often gets closed **without the evidence an auditor will ask for**. Audit Ready fixes that.

- **Issue panel:** a built-in evidence checklist for **HIPAA** (healthcare), **SOX** (finance) or **ISO 9001** (manufacturing). It picks the checklist from the label (`hipaa`, `sox`, `iso9001`) or you choose one. Every check records who confirmed it and when, and an audit trail shows the history. Closed work items with missing evidence get a red warning.
- **Project page "Audit Readiness":** readiness score, status (AUDIT READY / IN PROGRESS / AUDIT RISK) and a "Fix first" list of work items **closed without evidence**, plus progress per regulation.
- **Data stays in Jira:** evidence is stored as an issue property on the work item. No external storage, no external calls.

Built for Codegeist 2026 (Apps for Specialized Industries).

## Develop
```
npm install
node test/readiness.test.js
forge deploy && forge install --product jira --site <site>.atlassian.net
```
Privacy: [PRIVACY.md](PRIVACY.md). Support: open a GitHub issue. License: MIT.
