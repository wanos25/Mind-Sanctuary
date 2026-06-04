import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, GripVertical, Loader2, Film, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { uploadActivityMedia } from '@/lib/activities/mediaUpload';
import type { VideoPlaylistContent, VideoPlaylistItem } from '@/lib/activities/builderTypes';
import { useToast } from '@/hooks/use-toast';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface Props {
  value: VideoPlaylistContent;
  onChange: (next: VideoPlaylistContent) => void;
}

export default function VideoPlaylistBuilder({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeListId, setActiveListId] = useState<string | null>(value.playlists[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeListId && value.playlists[0]) setActiveListId(value.playlists[0].id);
  }, [value.playlists, activeListId]);

  const active = value.playlists.find((p) => p.id === activeListId) ?? null;

  const update = (next: VideoPlaylistContent) => onChange(next);
  const updateActive = (mut: (items: VideoPlaylistItem[]) => VideoPlaylistItem[]) => {
    if (!active) return;
    update({
      ...value,
      playlists: value.playlists.map((p) => (p.id === active.id ? { ...p, items: mut(p.items) } : p)),
    });
  };

  const addPlaylist = () => {
    const id = newId();
    update({ ...value, playlists: [...value.playlists, { id, name: 'New playlist', items: [] }] });
    setActiveListId(id);
  };
  const removePlaylist = (id: string) => {
    update({ ...value, playlists: value.playlists.filter((p) => p.id !== id) });
    if (activeListId === id) setActiveListId(value.playlists[0]?.id ?? null);
  };
  const renamePlaylist = (id: string, patch: Partial<{ name: string; description: string }>) => {
    update({ ...value, playlists: value.playlists.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !active) return;
    setUploading(true);
    try {
      const newItems: VideoPlaylistItem[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) continue;
        const up = await uploadActivityMedia(file, { kind: 'educational_video', folder: active.id });
        newItems.push({
          id: newId(),
          title: file.name.replace(/\.[^.]+$/, ''),
          video_url: up.publicUrl,
          storage_path: up.path,
          difficulty: 'moderate',
        });
      }
      updateActive((items) => [...items, ...newItems]);
      toast({ title: t('activities.builder.video.uploaded', { defaultValue: 'Videos uploaded' }) });
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: (e as Error)?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    updateActive((items) => {
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return items;
      const j = i + dir;
      if (j < 0 || j >= items.length) return items;
      const next = items.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const patchItem = (id: string, patch: Partial<VideoPlaylistItem>) =>
    updateActive((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => updateActive((items) => items.filter((x) => x.id !== id));

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      {/* Playlist sidebar */}
      <Card className="p-3 space-y-2 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{t('activities.builder.video.playlists', { defaultValue: 'Playlists' })}</h4>
          <Button size="sm" variant="ghost" onClick={addPlaylist}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-1">
          {value.playlists.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {t('activities.builder.video.noPlaylists', { defaultValue: 'No playlists yet.' })}
            </p>
          )}
          {value.playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveListId(p.id)}
              className={`w-full text-start px-2.5 py-2 rounded-lg text-sm transition-all flex items-center justify-between gap-2 ${
                activeListId === p.id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'hover:bg-muted/60 border border-transparent'
              }`}
            >
              <span className="truncate">{p.name || t('common.untitled')}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{p.items.length}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Active playlist editor */}
      <Card className="p-4 space-y-4 bg-card/60 backdrop-blur border-border/60">
        {!active ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {t('activities.builder.video.selectOrCreate', { defaultValue: 'Select or create a playlist.' })}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input value={active.name} onChange={(e) => renamePlaylist(active.id, { name: e.target.value })}
                placeholder={t('activities.builder.video.namePh', { defaultValue: 'Playlist name' })} />
              <Input value={active.description ?? ''} onChange={(e) => renamePlaylist(active.id, { description: e.target.value })}
                placeholder={t('activities.builder.video.descPh', { defaultValue: 'Short description' })} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
                {t('activities.builder.video.upload', { defaultValue: 'Upload videos' })}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removePlaylist(active.id)}>
                <Trash2 className="w-4 h-4 me-1" />
                {t('activities.builder.video.removePlaylist', { defaultValue: 'Remove playlist' })}
              </Button>
              <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {active.items.map((it, idx) => (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-xl border border-border/60 bg-background/40 p-3 grid md:grid-cols-[220px_1fr_auto] gap-3"
                  >
                    <video src={it.video_url} controls preload="metadata" className="w-full rounded-lg bg-black aspect-video" />
                    <div className="space-y-1.5">
                      <Input value={it.title} onChange={(e) => patchItem(it.id, { title: e.target.value })}
                        placeholder={t('activities.builder.video.titlePh', { defaultValue: 'Title' })} />
                      <Textarea rows={2} value={it.description ?? ''} onChange={(e) => patchItem(it.id, { description: e.target.value })}
                        placeholder={t('activities.builder.video.descriptionPh', { defaultValue: 'Description' })} />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={(it.tags ?? []).join(', ')}
                          onChange={(e) => patchItem(it.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                          placeholder={t('activities.builder.video.tagsPh', { defaultValue: 'tags' })}
                        />
                        <select
                          value={it.difficulty ?? 'moderate'}
                          onChange={(e) => patchItem(it.id, { difficulty: e.target.value as VideoPlaylistItem['difficulty'] })}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="gentle">{t('activities.difficulty.gentle', { defaultValue: 'Gentle' })}</option>
                          <option value="moderate">{t('activities.difficulty.moderate', { defaultValue: 'Moderate' })}</option>
                          <option value="challenging">{t('activities.difficulty.challenging', { defaultValue: 'Challenging' })}</option>
                        </select>
                        <Input
                          value={it.emotional_goal ?? ''}
                          onChange={(e) => patchItem(it.id, { emotional_goal: e.target.value })}
                          placeholder={t('activities.builder.video.goalPh', { defaultValue: 'emotional goal' })}
                        />
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(it.id, -1)}><ChevronUp className="w-4 h-4" /></Button>
                      <GripVertical className="w-4 h-4 text-muted-foreground opacity-60" />
                      <Button size="icon" variant="ghost" disabled={idx === active.items.length - 1} onClick={() => move(it.id, 1)}><ChevronDown className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeItem(it.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {active.items.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-6">
                  {t('activities.builder.video.empty', { defaultValue: 'No videos in this playlist yet.' })}
                </p>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
