import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Stack, Inline, Text, Heading, Lozenge, Checkbox, ProgressBar, Button, User,
  SectionMessage, Spinner, Strong, Box, xcss } from '@forge/react';
import { invoke } from '@forge/bridge';

const isId = (s) => typeof s === 'string' && /^[0-9a-f]{6,}:|^[0-9a-f]{24}$/.test(s);
const Who = ({ v }) => (isId(v) ? <User accountId={v} /> : <Text>{v}</Text>);
const when = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const App = () => {
  const [d, setD] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const run = (name, payload) => { setBusy(true); setErr(null);
    invoke(name, payload).then(setD).catch(e => setErr(String(e.message || e))).finally(() => setBusy(false)); };
  useEffect(() => run('getIssue'), []);
  if (!d && err) return <SectionMessage appearance="warning"><Text>{err}</Text></SectionMessage>;
  if (!d) return <Spinner label="Loading checklist" />;
  if (!d.template) return (
    <Stack space="space.150">
      <Text>Pick the compliance checklist for this work item:</Text>
      <Inline space="space.100" shouldWrap>
        {d.templates.map(t => <Button key={t.key} isDisabled={busy} onClick={() => run('setTemplate', { template: t.key })}>{t.name}</Button>)}
      </Inline>
      <Text>Tip: adding the label hipaa, sox or iso9001 picks it automatically.</Text>
    </Stack>);
  const risk = d.closed && d.done < d.total;
  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center" spread="space-between">
        <Heading size="small">{d.templateName}</Heading>
        <Lozenge appearance={d.done === d.total ? 'success' : risk ? 'removed' : 'inprogress'} isBold>
          {d.done === d.total ? 'EVIDENCE COMPLETE' : risk ? 'CLOSED WITHOUT EVIDENCE' : `${d.done}/${d.total} EVIDENCE`}
        </Lozenge>
      </Inline>
      <ProgressBar value={d.done / d.total} appearance={d.done === d.total ? 'success' : 'default'} />
      {risk && <SectionMessage appearance="error"><Text>This work item is closed but {d.total - d.done} evidence item(s) are missing. Auditors will flag this.</Text></SectionMessage>}
      {err && <SectionMessage appearance="warning"><Text>{err}</Text></SectionMessage>}
      {d.items.map(i => (
        <Stack key={i.id} space="space.0">
          <Checkbox label={i.label} isChecked={!!i.done} isDisabled={busy}
            onChange={() => run('toggleItem', { id: i.id, done: !i.done })} />
          {i.done && i.by && <Box xcss={xcss({ paddingInlineStart: 'space.300' })}><Inline space="space.050" alignBlock="center"><Text size="small">Confirmed by</Text><Who v={i.by} /><Text size="small">on {when(i.at)}</Text></Inline></Box>}
        </Stack>))}
      {d.history.length > 0 && (
        <Stack space="space.050">
          <Strong>Audit trail</Strong>
          {d.history.map((h, n) => <Inline key={n} space="space.050" alignBlock="center" shouldWrap><Text size="small">{when(h.at)} ·</Text><Who v={h.by} /><Text size="small">{h.done ? 'confirmed' : 'unchecked'} “{(d.items.find(i => i.id === h.id) || {}).label}”</Text></Inline>)}
        </Stack>)}
    </Stack>);
};
ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
