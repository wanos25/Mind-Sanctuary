import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, AlertTriangle, CheckCircle2, ArrowDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  validateCBTFlow,
  type CBTFlowV2Content, type CBTNode, type CBTNodeKind, type CBTEdge,
} from '@/lib/activities/builderTypes';

interface Props {
  value: CBTFlowV2Content;
  onChange: (next: CBTFlowV2Content) => void;
}

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const NODE_TYPES: { kind: CBTNodeKind; label: string }[] = [
  { kind: 'reflection', label: 'Reflection' },
  { kind: 'question', label: 'Question' },
  { kind: 'checkpoint', label: 'Emotional checkpoint' },
  { kind: 'scoring', label: 'Scoring' },
  { kind: 'branch', label: 'Branch' },
];

function makeNode(kind: CBTNodeKind): CBTNode {
  const id = newId(kind);
  switch (kind) {
    case 'reflection': return { id, kind, title: 'Reflection', body: 'Take a slow breath…' };
    case 'question':   return { id, kind, title: 'Question', question: 'What thought are you noticing?', min_chars: 4 };
    case 'checkpoint': return { id, kind, title: 'Checkpoint', label: 'How intense is this feeling right now?', scale_min: 0, scale_max: 10 };
    case 'scoring':    return { id, kind, title: 'Scoring', component: 'overall', formula: 'avg_checkpoints' };
    case 'branch':     return { id, kind, title: 'Branch', description: 'Routes based on the previous checkpoint.' };
  }
}

export default function CBTFlowBuilder({ value, onChange }: Props) {
  const { t } = useTranslation();
  const validation = useMemo(() => validateCBTFlow(value), [value]);

  const update = (patch: Partial<CBTFlowV2Content>) => onChange({ ...value, ...patch });
  const patchNode = (id: string, patch: Partial<CBTNode>) =>
    onChange({ ...value, nodes: value.nodes.map(n => n.id === id ? { ...n, ...patch } as CBTNode : n) });
  const removeNode = (id: string) =>
    onChange({
      ...value,
      nodes: value.nodes.filter(n => n.id !== id),
      edges: value.edges.filter(e => e.from !== id && e.to !== id),
      start_node_id: value.start_node_id === id ? (value.nodes.find(n => n.id !== id)?.id ?? '') : value.start_node_id,
    });
  const addNode = (kind: CBTNodeKind) => {
    const node = makeNode(kind);
    const nodes = [...value.nodes, node];
    const start_node_id = value.start_node_id || node.id;
    // chain: link previous last node to this one (unconditional)
    const prev = value.nodes[value.nodes.length - 1];
    const edges = prev
      ? [...value.edges, { id: newId('edge'), from: prev.id, to: node.id } as CBTEdge]
      : value.edges;
    onChange({ ...value, nodes, edges, start_node_id });
  };
  const addEdge = (from: string, to: string) =>
    update({ edges: [...value.edges, { id: newId('edge'), from, to }] });
  const removeEdge = (id: string) =>
    update({ edges: value.edges.filter(e => e.id !== id) });
  const patchEdge = (id: string, patch: Partial<CBTEdge>) =>
    update({ edges: value.edges.map(e => e.id === id ? { ...e, ...patch } : e) });

  return (
    <div className="space-y-4">
      {/* Validation banner */}
      <Card className={`p-3 border ${validation.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <div className="flex items-start gap-2 text-xs">
          {validation.ok
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
          <div className="space-y-1 flex-1">
            <p className="font-medium">
              {validation.ok
                ? t('activities.builder.cbt.valid', { defaultValue: 'Flow is publish-ready.' })
                : t('activities.builder.cbt.invalid', { defaultValue: 'Fix errors before publishing.' })}
            </p>
            {validation.errors.map((e, i) => <p key={`e-${i}`} className="text-destructive">• {e}</p>)}
            {validation.warnings.map((w, i) => <p key={`w-${i}`} className="text-muted-foreground">• {w}</p>)}
          </div>
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        {NODE_TYPES.map(({ kind, label }) => (
          <Button key={kind} size="sm" variant="outline" onClick={() => addNode(kind)}>
            <Plus className="w-3.5 h-3.5 me-1.5" /> {label}
          </Button>
        ))}
      </div>

      {/* Node list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {value.nodes.map((node, idx) => {
            const outgoing = value.edges.filter(e => e.from === node.id);
            const isStart = node.id === value.start_node_id;
            return (
              <motion.div
                key={node.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <Card className="p-3 space-y-2 border-border/60 bg-background/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                        {node.kind}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate" dir="ltr">#{idx + 1}</span>
                      <button
                        onClick={() => update({ start_node_id: node.id })}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${isStart ? 'bg-accent/20 text-accent border-accent/40' : 'border-border/60 hover:border-accent/40'}`}
                      >{isStart ? 'START' : 'set start'}</button>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => removeNode(node.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <NodeFields node={node} onChange={(p) => patchNode(node.id, p)} />

                  {/* outgoing edges */}
                  <div className="space-y-1 pt-1">
                    {outgoing.map(edge => (
                      <div key={edge.id} className="flex items-center gap-2 text-xs">
                        <ArrowRight className="w-3 h-3 text-muted-foreground rtl:rotate-180" />
                        <select
                          value={edge.to}
                          onChange={(e) => patchEdge(edge.id, { to: e.target.value })}
                          className="h-7 rounded border border-input bg-background px-2 text-xs flex-1 min-w-0"
                        >
                          {value.nodes.filter(n => n.id !== node.id).map(n => (
                            <option key={n.id} value={n.id}>{n.kind} — {n.title ?? n.id.slice(0, 6)}</option>
                          ))}
                        </select>
                        <select
                          value={edge.when?.op ?? 'always'}
                          onChange={(e) => {
                            const op = e.target.value;
                            if (op === 'always') patchEdge(edge.id, { when: undefined });
                            else patchEdge(edge.id, {
                              when: {
                                var: edge.when?.var ?? node.id,
                                op: op as NonNullable<CBTEdge['when']>['op'],
                                value: edge.when?.value,
                              },
                            });
                          }}
                          className="h-7 rounded border border-input bg-background px-2 text-xs"
                        >
                          <option value="always">always</option>
                          <option value="gte">≥</option><option value="lte">≤</option>
                          <option value="gt">{'>'}</option><option value="lt">{'<'}</option>
                          <option value="eq">=</option><option value="neq">≠</option>
                          <option value="contains">contains</option>
                          <option value="truthy">truthy</option>
                        </select>
                        {edge.when && edge.when.op !== 'truthy' && (
                          <Input
                            className="h-7 w-20 text-xs"
                            value={String(edge.when.value ?? '')}
                            onChange={(e) => patchEdge(edge.id, { when: { ...edge.when!, value: isNaN(Number(e.target.value)) || e.target.value === '' ? e.target.value : Number(e.target.value) } })}
                          />
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive h-6 w-6" onClick={() => removeEdge(edge.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {value.nodes.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                        const target = value.nodes.find(n => n.id !== node.id)!;
                        addEdge(node.id, target.id);
                      }}>
                        <Plus className="w-3 h-3 me-1" /> {t('activities.builder.cbt.addEdge', { defaultValue: 'add path' })}
                      </Button>
                    )}
                  </div>
                </Card>
                {idx < value.nodes.length - 1 && (
                  <div className="flex justify-center -my-1"><ArrowDown className="w-3.5 h-3.5 text-muted-foreground/60" /></div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {value.nodes.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-6">
            {t('activities.builder.cbt.empty', { defaultValue: 'No nodes yet. Add one above to start the flow.' })}
          </p>
        )}
      </div>
    </div>
  );
}

function NodeFields({ node, onChange }: { node: CBTNode; onChange: (p: Partial<CBTNode>) => void }) {
  const title = (
    <Input value={node.title ?? ''} placeholder="Title"
      onChange={(e) => onChange({ title: e.target.value } as Partial<CBTNode>)} />
  );
  switch (node.kind) {
    case 'reflection':
      return <>
        {title}
        <Textarea rows={3} value={node.body}
          onChange={(e) => onChange({ body: e.target.value } as Partial<CBTNode>)} />
      </>;
    case 'question':
      return <>
        {title}
        <Input value={node.question} placeholder="Question"
          onChange={(e) => onChange({ question: e.target.value } as Partial<CBTNode>)} />
      </>;
    case 'checkpoint':
      return <>
        {title}
        <Input value={node.label} placeholder="Prompt"
          onChange={(e) => onChange({ label: e.target.value } as Partial<CBTNode>)} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={node.scale_min ?? 0}
            onChange={(e) => onChange({ scale_min: Number(e.target.value) } as Partial<CBTNode>)} />
          <Input type="number" value={node.scale_max ?? 10}
            onChange={(e) => onChange({ scale_max: Number(e.target.value) } as Partial<CBTNode>)} />
        </div>
      </>;
    case 'scoring':
      return <>
        {title}
        <Input value={node.component} placeholder="Component name"
          onChange={(e) => onChange({ component: e.target.value } as Partial<CBTNode>)} />
      </>;
    case 'branch':
      return <>
        {title}
        <Textarea rows={2} value={node.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value } as Partial<CBTNode>)} />
      </>;
  }
}