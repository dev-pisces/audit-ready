import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Stack, Inline, Text, Heading, Lozenge, DynamicTable, Link, Spinner, SectionMessage,
  Box, ProgressBar, xcss } from '@forge/react';
import { invoke } from '@forge/bridge';

const card = xcss({ padding: 'space.200', borderRadius: 'border.radius', borderWidth: 'border.width', borderStyle: 'solid', borderColor: 'color.border', minWidth: '180px' });
const STATUS = { 'AUDIT RISK': 'removed', 'AUDIT READY': 'success', 'IN PROGRESS': 'inprogress' };

const Table = ({ rows }) => (
  <DynamicTable
    head={{ cells: [{ key: 'k', content: 'Key' }, { key: 's', content: 'Summary' }, { key: 't', content: 'Checklist' },
      { key: 'p', content: 'Evidence' }, { key: 'm', content: 'Missing' }] }}
    rows={rows.map(r => ({ key: r.key, cells: [
      { key: 'k', content: <Link href={`/browse/${r.key}`}>{r.key}</Link> }, { key: 's', content: r.summary },
      { key: 't', content: r.template.toUpperCase() }, { key: 'p', content: `${r.done}/${r.total}` },
      { key: 'm', content: r.missing.slice(0, 2).join('; ') + (r.missing.length > 2 ? ` (+${r.missing.length - 2})` : '') }] }))} />);

const App = () => {
  const [d, setD] = useState(null);
  useEffect(() => { invoke('getProject').then(setD).catch(e => setD({ error: String(e.message || e) })); }, []);
  if (!d) return <Spinner label="Checking audit readiness" />;
  if (d.error) return <SectionMessage appearance="warning"><Text>{d.error}</Text></SectionMessage>;
  if (!d.issues.length) return <SectionMessage title="No regulated work items yet"><Text>Add the label hipaa, sox or iso9001 to a work item (or pick a checklist in its Audit Ready panel) to start tracking evidence.</Text></SectionMessage>;
  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050"><Heading size="large">Audit readiness: {String(d.score)}%</Heading>
          <Text>{d.issues.length} regulated work items in {d.project}</Text></Stack>
        <Lozenge appearance={STATUS[d.status]} isBold>{d.status}</Lozenge>
      </Inline>
      <ProgressBar value={d.score / 100} appearance={d.status === 'AUDIT READY' ? 'success' : 'default'} />
      <Inline space="space.200" shouldWrap>
        <Box xcss={card}><Stack space="space.050"><Heading size="medium">{String(d.closedWithoutEvidence.length)}</Heading><Lozenge appearance="removed">Closed without evidence</Lozenge></Stack></Box>
        <Box xcss={card}><Stack space="space.050"><Heading size="medium">{String(d.inProgress.length)}</Heading><Lozenge appearance="inprogress">Evidence in progress</Lozenge></Stack></Box>
        <Box xcss={card}><Stack space="space.050"><Heading size="medium">{String(d.complete.length)}</Heading><Lozenge appearance="success">Evidence complete</Lozenge></Stack></Box>
        {Object.values(d.byTemplate).map(t => (
          <Box key={t.name} xcss={card}><Stack space="space.050"><Heading size="medium">{`${t.complete}/${t.issues}`}</Heading><Lozenge>{t.name}</Lozenge></Stack></Box>))}
      </Inline>
      {d.closedWithoutEvidence.length > 0 && <Stack space="space.100"><Heading size="small">Fix first: closed without evidence</Heading><Table rows={d.closedWithoutEvidence} /></Stack>}
      {d.inProgress.length > 0 && <Stack space="space.100"><Heading size="small">Evidence in progress</Heading><Table rows={d.inProgress} /></Stack>}
      {d.complete.length > 0 && <Stack space="space.100"><Heading size="small">Evidence complete</Heading><Table rows={d.complete} /></Stack>}
    </Stack>);
};
ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
