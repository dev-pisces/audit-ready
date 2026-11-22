# Audit Ready: Privacy Policy

Last updated: 22 November 2026

Audit Ready is a Forge app for Jira that runs entirely on Atlassian's infrastructure (Runs on Atlassian).

- **What it reads:** for work items labeled `hipaa`, `sox` or `iso9001` (or given a checklist in the panel), it reads the summary, status, labels and its own issue property `audit-ready`. To record who confirmed evidence, it looks up the display name of the current user.
- **What it stores:** the evidence checklist state (which item was confirmed, by whom and when, plus a short history) is stored **inside your Jira site** as an issue property on the work item. The app keeps no database and stores nothing outside your Jira site.
- **Who it shares with:** nobody. The app makes no external network calls and has no analytics or tracking.
- **Permissions:** `read:jira-work`, `write:jira-work` (issue property and label only) and `read:jira-user` (display name). Before any change, the app checks that the current user has Edit permission on the work item.
- **Deletion:** uninstalling the app or deleting the `audit-ready` issue property removes the data.

Questions or data requests: open an issue in this repository.
