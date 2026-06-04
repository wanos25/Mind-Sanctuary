import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ActivityKind } from '@/lib/activities/types';
import type { CBTFlowV2Content, CBTNode } from '@/lib/activities/builderTypes';

type Mode =
  | 'suggest_prompts'
  | 'suggest_cbt_exercises'
  | 'suggest_content_tags'
  | 'draft_activity';

interface DraftPatch {
  title?: string;
  description?: string;
  content?: unknown;
}

interface Props {
  kind: ActivityKind;
  onApplyDraft?: (draft: DraftPatch) => void;
  /** Optional clinician-trend mode: scopes prompts to a single patient. */
  trendContext?: { patientId: string; nickname?: string | null };
}

const MODES_FOR_KIND: Record<ActivityKind, Mode[]> = {
  cbt_flow: ['suggest_prompts', 'suggest_cbt_exercises', 'draft_activity'],
  educational_video: ['suggest_content_tags', 'suggest_prompts'],
  image_interpretation: ['suggest_prompts'],
  spot_difference: ['suggest_prompts'],
};

const MODE_LABEL: Record<Mode, string> = {
  suggest_prompts: 'Suggest prompts',
  suggest_cbt_exercises: 'Suggest CBT exercises',
  suggest_content_tags: 'Suggest tags',
  draft_activity: 'Draft full activity',
};

export default function AIAssistPanel({ kind, onApplyDraft, trendContext }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState<Mode | null>(null);
  const [result, setResult] = useState<{ mode: Mode; data: any } | null>(null);

  const run = async (mode: Mode) => {
    setLoading(mode);
    setResult(null);
    try {
      const ctxParts = [`kind=${kind}`];
      if (trendContext) ctxParts.push(`patient=${trendContext.patientId}`, 'scope=patient_trend');
      const { data, error } = await supabase.functions.invoke('doctor-ai-assist', {
        body: { mode, hint, locale: 'en', context: ctxParts.join(' | ') },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ mode, data: data.result });
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const applyDraftActivity = () => {
    if (!result || result.mode !== 'draft_activity' || !onApplyDraft) return;
    const d = result.data;
    const startId = `r-${Date.now().toString(36)}`;
    const nodes: CBTNode[] = [];
    (d.nodes ?? []).forEach((n: any, i: number) => {
      const id = i === 0 ? startId : `${n.kind}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      if (n.kind === 'reflection') nodes.push({ id, kind: 'reflection', title: n.title ?? '', body: n.prompt });
      else if (n.kind === 'question') nodes.push({ id, kind: 'question', title: n.title ?? '', question: n.prompt, min_chars: 4 });
      else if (n.kind === 'checkpoint') nodes.push({ id, kind: 'checkpoint', title: n.title ?? '', label: n.prompt, scale_min: 0, scale_max: 10 });
    });
    const edges = nodes.slice(0, -1).map((n, i) => ({ id: `e-${i}`, from: n.id, to: nodes[i + 1].id }));
    const content: CBTFlowV2Content = { version: 2, start_node_id: startId, nodes, edges };
    onApplyDraft({ title: d.title, description: d.description, content });
    toast({ title: t('activities.ai.applied', { defaultValue: 'AI draft applied — review before publishing' }) });
  };

  const modes = trendContext
    ? (['suggest_prompts', 'suggest_cbt_exercises'] as Mode[])
    : (MODES_FOR_KIND[kind] ?? []);

  return (
    <Card className="p-4 space-y-3 bg-card/60 backdrop-blur border-accent/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">{t('activities.ai.title', { defaultValue: 'AI Assistance' })}</h3>
          <span className="text-[10px] uppercase tracking-wider text-accent/80 border border-accent/30 px-1.5 py-0.5 rounded-full">
            {t('activities.ai.suggestionOnly', { defaultValue: 'Suggestion only' })}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('activities.ai.disclaimer', { defaultValue: 'AI suggestions are never auto-published. Review carefully before saving.' })}
      </p>
      <Input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder={t('activities.ai.hintPh', { defaultValue: 'Optional context for the AI (e.g. "anxiety, evening rumination")' })}
      />
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <Button key={m} size="sm" variant="outline" disabled={loading !== null} onClick={() => run(m)}>
            {loading === m ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 me-1.5" />}
            {MODE_LABEL[m]}
          </Button>
        ))}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2"
          >
            <p className="text-[10px] uppercase tracking-wider text-accent">
              {t('activities.ai.aiGenerated', { defaultValue: 'AI-generated' })} · {MODE_LABEL[result.mode]}
            </p>
            <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-auto opacity-90">
              {JSON.stringify(result.data, null, 2)}
            </pre>
            {result.mode === 'draft_activity' && kind === 'cbt_flow' && onApplyDraft && (
              <Button size="sm" onClick={applyDraftActivity}>
                {t('activities.ai.applyDraft', { defaultValue: 'Apply as draft' })}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}