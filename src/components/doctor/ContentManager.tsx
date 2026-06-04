import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Brain, Image as ImageIcon, Video, Search } from 'lucide-react';
import { listAllAssets, createAsset, updateAsset, archiveAsset } from '@/lib/activities/assets';
import type { ActivityAsset, ActivityKind, ActivityContent } from '@/lib/activities/types';
import {
  isVideoPlaylistContent,
  isSpotBuilderContent,
  type VideoPlaylistContent,
  type SpotDifferenceBuilderContent,
} from '@/lib/activities/builderTypes';
import { isCBTFlowV2, type CBTFlowV2Content } from '@/lib/activities/builderTypes';
import VideoPlaylistBuilder from './builders/VideoPlaylistBuilder';
import SpotDifferenceBuilder from './builders/SpotDifferenceBuilder';
import CBTFlowBuilder from './builders/CBTFlowBuilder';
import AIAssistPanel from './AIAssistPanel';
import { useToast } from '@/hooks/use-toast';

const KINDS: ActivityKind[] = ['cbt_flow', 'image_interpretation', 'educational_video', 'spot_difference'];

const KIND_ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  cbt_flow: Brain,
  image_interpretation: ImageIcon,
  educational_video: Video,
  spot_difference: Search,
};

type AnyContent = VideoPlaylistContent | SpotDifferenceBuilderContent | Record<string, any>;

function defaultContentFor(kind: ActivityKind): AnyContent {
  switch (kind) {
    case 'educational_video':
      return { version: 2, playlists: [{ id: `pl-${Date.now()}`, name: 'Default playlist', items: [] }] } satisfies VideoPlaylistContent;
    case 'spot_difference':
      return { version: 2, image_a_url: '', image_b_url: '', markers: [], tap_tolerance: 0.05 } satisfies SpotDifferenceBuilderContent;
    case 'cbt_flow': {
      const startId = `reflection-${Date.now().toString(36)}`;
      const v2: CBTFlowV2Content = {
        version: 2,
        start_node_id: startId,
        nodes: [{ id: startId, kind: 'reflection', title: 'Welcome', body: 'Take a slow breath. When ready, we will begin.' }],
        edges: [],
      };
      return v2;
    }
    case 'image_interpretation':
      return { image_url: '', prompt: '', hints: [] };
  }
}

export default function ContentManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [assets, setAssets] = useState<ActivityAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<ActivityKind>('educational_video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<AnyContent>(defaultContentFor('educational_video'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterKind, setFilterKind] = useState<ActivityKind | 'all'>('all');

  const refresh = async () => {
    setLoading(true);
    try { setAssets(await listAllAssets()); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setContent(defaultContentFor(kind));
  };

  useEffect(() => { if (!editingId) setContent(defaultContentFor(kind)); /* swap on kind change */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const beginEdit = (a: ActivityAsset) => {
    setEditingId(a.id);
    setKind(a.kind);
    setTitle(a.title);
    setDescription(a.description ?? '');
    setContent((a.content ?? defaultContentFor(a.kind)) as AnyContent);
  };

  const save = async () => {
    if (!title.trim()) { toast({ title: t('activities.manage.titleRequired', { defaultValue: 'Title is required' }), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateAsset(editingId, { title, description, content, locale: 'en' });
        toast({ title: t('activities.manage.updated', { defaultValue: 'Updated' }) });
      } else {
        await createAsset({ kind, title, description, content, published: false });
        toast({ title: t('activities.manage.created') });
      }
      resetForm();
      await refresh();
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: (e as Error)?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const togglePublish = async (a: ActivityAsset) => { await updateAsset(a.id, { published: !a.published }); await refresh(); };
  const archive = async (a: ActivityAsset) => { await archiveAsset(a.id); await refresh(); };

  const filtered = useMemo(
    () => filterKind === 'all' ? assets : assets.filter((a) => a.kind === filterKind),
    [assets, filterKind],
  );

  return (
    <div className="space-y-6">
      {/* Kind picker */}
      <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {editingId
              ? t('activities.manage.editing', { defaultValue: 'Editing activity' })
              : t('activities.manage.newTitle')}
          </h3>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {KINDS.map((k) => {
            const Icon = KIND_ICONS[k];
            const active = kind === k;
            return (
              <button
                key={k}
                disabled={!!editingId}
                onClick={() => setKind(k)}
                className={`group relative p-3 rounded-xl border text-start transition-all overflow-hidden ${
                  active
                    ? 'border-primary/50 bg-primary/10 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]'
                    : 'border-border/50 bg-card/40 hover:border-primary/30 hover:bg-primary/5'
                } ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-5 h-5 mb-2 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-xs font-medium leading-tight">{t(`activities.kind.${k}`)}</p>
                {active && (
                  <motion.span
                    layoutId="kind-glow"
                    className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t('activities.manage.assetTitle')}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t('activities.manage.description')}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={kind + (editingId ?? '')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {kind === 'educational_video' ? (
                <VideoPlaylistBuilder
                  value={isVideoPlaylistContent(content) ? content : (defaultContentFor('educational_video') as VideoPlaylistContent)}
                  onChange={setContent}
                />
              ) : kind === 'spot_difference' ? (
                <SpotDifferenceBuilder
                  value={isSpotBuilderContent(content) ? content : (defaultContentFor('spot_difference') as SpotDifferenceBuilderContent)}
                  onChange={setContent}
                />
              ) : kind === 'cbt_flow' ? (
                <CBTFlowBuilder
                  value={isCBTFlowV2(content) ? content : (defaultContentFor('cbt_flow') as CBTFlowV2Content)}
                  onChange={setContent}
                />
              ) : (
                <Card className="p-3 bg-background/40 border-border/60">
                  <label className="text-xs text-muted-foreground">{t('activities.manage.contentJson')}</label>
                  <Textarea
                    rows={8}
                    value={JSON.stringify(content, null, 2)}
                    onChange={(e) => {
                      try { setContent(JSON.parse(e.target.value)); } catch { /* keep typing */ }
                    }}
                    className="font-mono text-xs mt-1.5"
                  />
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-end pt-3">
          <Button onClick={save} disabled={saving || !title.trim()}>
            {editingId ? t('common.saveChanges') : t('common.save')}
          </Button>
        </div>
      </Card>

      {/* AI Assist (suggestion-only) */}
      <AIAssistPanel
        kind={kind}
        onApplyDraft={(draft) => {
          if (draft.title) setTitle(draft.title);
          if (draft.description) setDescription(draft.description);
          if (draft.content) setContent(draft.content as AnyContent);
        }}
      />

      {/* Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm">{t('activities.manage.existing')}</h3>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as ActivityKind | 'all')}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">{t('common.filters')}</option>
            {KINDS.map((k) => <option key={k} value={k}>{t(`activities.kind.${k}`)}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">{t('activities.manage.empty')}</Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((a) => {
              const Icon = KIND_ICONS[a.kind];
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`p-4 transition-all hover:border-primary/30 ${a.archived ? 'opacity-50' : ''} ${editingId === a.id ? 'border-primary/50 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.5)]' : ''}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t(`activities.kind.${a.kind}`)} · {a.published ? t('activities.manage.published') : t('activities.manage.draft')}{a.archived ? ` · ${t('activities.manage.archived')}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {!a.archived && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => beginEdit(a)}>{t('common.open')}</Button>
                            <Button size="sm" variant="outline" onClick={() => togglePublish(a)}>
                              {a.published ? t('activities.manage.unpublish') : t('activities.manage.publish')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => archive(a)}>
                              {t('activities.manage.archive')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
