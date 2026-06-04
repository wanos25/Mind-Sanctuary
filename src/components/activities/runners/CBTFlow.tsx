import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Brain, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ActivityAsset, CBTFlowContent } from '@/lib/activities/types';
import {
  isCBTFlowV2, nextNodeId,
  type CBTFlowV2Content, type CBTNode,
} from '@/lib/activities/builderTypes';

interface Props {
  asset: ActivityAsset;
  onComplete: (response: Record<string, unknown>, score?: number) => void;
}

export default function CBTFlow({ asset, onComplete }: Props) {
  if (isCBTFlowV2(asset.content)) {
    return <CBTFlowV2Runner asset={asset} flow={asset.content} onComplete={onComplete} />;
  }
  return <CBTFlowV1Runner asset={asset} onComplete={onComplete} />;
}

/* --------------------------------- v1 fallback --------------------------------- */
function CBTFlowV1Runner({ asset, onComplete }: Props) {
  const { t } = useTranslation();
  const content = asset.content as CBTFlowContent;
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered = (content.steps ?? []).every((s) => (answers[s.id] ?? '').trim().length > 0);

  return (
    <Card className="p-6 space-y-4" role="region" aria-labelledby="cbt-v1-title">
      <div>
        <h2 id="cbt-v1-title" className="text-lg font-semibold">{asset.title}</h2>
        {content.prompt && <p className="text-sm text-muted-foreground mt-1">{content.prompt}</p>}
      </div>
      <div className="space-y-3">
        {(content.steps ?? []).map((s) => (
          <div key={s.id} className="space-y-1.5">
            <label className="text-sm font-medium">{s.question}</label>
            <Textarea
              value={answers[s.id] ?? ''}
              placeholder={s.placeholder ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [s.id]: e.target.value.slice(0, 2000) }))}
              rows={3}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button disabled={!allAnswered} onClick={() => onComplete({ answers })}>
          {t('activities.runner.finish')}
        </Button>
      </div>
    </Card>
  );
}

/* --------------------------------- v2 runner --------------------------------- */
function CBTFlowV2Runner({
  asset, flow, onComplete,
}: { asset: ActivityAsset; flow: CBTFlowV2Content; onComplete: Props['onComplete'] }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const nodeMap = useMemo(() => new Map(flow.nodes.map(n => [n.id, n])), [flow]);
  const [currentId, setCurrentId] = useState<string>(flow.start_node_id);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const current = nodeMap.get(currentId);
  const total = flow.nodes.length;
  const step = history.length + 1;

  const setValue = (id: string, v: unknown) => setValues(prev => ({ ...prev, [id]: v }));

  const score = useMemo(() => {
    const checkpoints = flow.nodes.filter(n => n.kind === 'checkpoint');
    if (checkpoints.length === 0) return null;
    const vals = checkpoints
      .map(n => values[n.id])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return null;
    const max = (checkpoints[0] as { scale_max?: number }).scale_max ?? 10;
    return Math.min(1, Math.max(0, vals.reduce((a, b) => a + b, 0) / (vals.length * max)));
  }, [flow, values]);

  const advance = () => {
    if (!current) return;
    const next = nextNodeId(flow, current.id, values);
    if (!next) {
      setDone(true);
      return;
    }
    setHistory(h => [...h, current.id]);
    setCurrentId(next);
  };

  if (done) {
    return (
      <Card className="p-8 text-center space-y-4 bg-card/60 backdrop-blur border-border/60">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="font-display text-lg">{t('activities.cbt.done', { defaultValue: 'Session complete' })}</h3>
        {score !== null && (
          <p className="text-sm text-muted-foreground">
            {t('activities.cbt.scoreLabel', { defaultValue: 'Emotional regulation score' })}: <span className="font-semibold">{Math.round(score * 100)}%</span>
          </p>
        )}
        <Button onClick={() => onComplete({ values, history }, score ?? undefined)}>
          {t('activities.runner.finish')}
        </Button>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {t('activities.cbt.brokenFlow', { defaultValue: 'This therapy flow is misconfigured.' })}
      </Card>
    );
  }

  const valid = isNodeValid(current, values);

  return (
    <Card className="p-6 space-y-5 bg-card/60 backdrop-blur border-border/60 relative overflow-hidden" role="region" aria-labelledby="cbt-v2-title">
      <div aria-hidden className="absolute inset-x-0 -top-20 h-40 bg-gradient-to-b from-primary/10 to-transparent blur-2xl pointer-events-none" />

      <div className="relative space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span id="cbt-v2-title" className="inline-flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-primary" />
            {asset.title}
          </span>
          <span>{t('activities.cbt.step', { defaultValue: 'Step {{step}} of {{total}}', step, total })}</span>
        </div>
        <Progress
          value={(step / Math.max(total, 1)) * 100}
          className="h-1.5"
          aria-label={t('activities.cbt.progress', { defaultValue: 'Activity progress' })}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={reduce ? undefined : { opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative space-y-3"
        >
          <NodeView node={current} value={values[current.id]} onChange={(v) => setValue(current.id, v)} />
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end pt-1">
        <Button disabled={!valid} onClick={advance}>
          {t('activities.cbt.next', { defaultValue: 'Continue' })}
          <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
        </Button>
      </div>
    </Card>
  );
}

function isNodeValid(node: CBTNode, values: Record<string, unknown>): boolean {
  const v = values[node.id];
  switch (node.kind) {
    case 'reflection': return true;
    case 'question': {
      const text = typeof v === 'string' ? v.trim() : '';
      return text.length >= (node.min_chars ?? 1);
    }
    case 'checkpoint': return typeof v === 'number';
    case 'scoring':
    case 'branch': return true;
  }
}

function NodeView({
  node, value, onChange,
}: { node: CBTNode; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useTranslation();
  switch (node.kind) {
    case 'reflection':
      return (
        <div className="space-y-2">
          {node.title && <h3 className="font-display text-lg">{node.title}</h3>}
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{node.body}</p>
        </div>
      );
    case 'question':
      return (
        <div className="space-y-2">
          {node.title && <h3 className="font-display text-base">{node.title}</h3>}
          <label className="text-sm font-medium block">{node.question}</label>
          <Textarea
            rows={4}
            value={typeof value === 'string' ? value : ''}
            placeholder={node.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value.slice(0, 2000))}
          />
        </div>
      );
    case 'checkpoint': {
      const min = node.scale_min ?? 0;
      const max = node.scale_max ?? 10;
      const v = typeof value === 'number' ? value : Math.round((min + max) / 2);
      return (
        <div className="space-y-3">
          {node.title && <h3 className="font-display text-base">{node.title}</h3>}
          <p className="text-sm text-muted-foreground">{node.label}</p>
          <Slider
            value={[v]}
            min={min}
            max={max}
            step={1}
            onValueChange={(arr) => onChange(arr[0])}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{min}</span>
            <span className="font-semibold text-foreground">{v}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }
    case 'scoring':
    case 'branch':
      return (
        <div className="text-xs text-muted-foreground italic">
          {t('activities.cbt.autoStep', { defaultValue: 'Computing…' })}
        </div>
      );
  }
}
