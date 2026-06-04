import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, Eye, EyeOff, Loader2, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { uploadActivityMedia } from '@/lib/activities/mediaUpload';
import type { SpotDifferenceBuilderContent, SpotMarker } from '@/lib/activities/builderTypes';
import { useToast } from '@/hooks/use-toast';

interface Props {
  value: SpotDifferenceBuilderContent;
  onChange: (next: SpotDifferenceBuilderContent) => void;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_R = 0.04;

function hasOverlap(markers: SpotMarker[], tol: number): boolean {
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const a = markers[i], b = markers[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < Math.max(a.r, b.r, tol) * 1.4) return true;
    }
  }
  return false;
}

export default function SpotDifferenceBuilder({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [uploadingSide, setUploadingSide] = useState<'a' | 'b' | null>(null);
  const [preview, setPreview] = useState(false);
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);

  const upload = async (side: 'a' | 'b', file?: File | null) => {
    if (!file) return;
    setUploadingSide(side);
    try {
      const up = await uploadActivityMedia(file, { kind: 'spot_difference', folder: side });
      onChange({
        ...value,
        ...(side === 'a' ? { image_a_url: up.publicUrl, image_a_path: up.path } : { image_b_url: up.publicUrl, image_b_path: up.path }),
      });
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: (e as Error)?.message, variant: 'destructive' });
    } finally {
      setUploadingSide(null);
    }
  };

  const addMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (preview) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onChange({ ...value, markers: [...value.markers, { id: newId(), x, y, r: DEFAULT_R }] });
  };

  const removeMarker = (id: string) => onChange({ ...value, markers: value.markers.filter((m) => m.id !== id) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {preview
            ? t('activities.builder.spot.previewHint', { defaultValue: 'Preview: simulate patient gameplay.' })
            : t('activities.builder.spot.editHint', { defaultValue: 'Click on the left image to place a difference marker.' })}
        </p>
        <Button size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>
          {preview ? <EyeOff className="w-4 h-4 me-2" /> : <Eye className="w-4 h-4 me-2" />}
          {preview ? t('activities.builder.spot.exitPreview', { defaultValue: 'Exit preview' }) : t('activities.builder.spot.preview', { defaultValue: 'Preview' })}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {(['a', 'b'] as const).map((side) => {
          const url = side === 'a' ? value.image_a_url : value.image_b_url;
          const inputRef = side === 'a' ? refA : refB;
          return (
            <Card key={side} className="overflow-hidden bg-card/60 border-border/60">
              <div className="px-3 py-2 flex items-center justify-between border-b border-border/40">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{side === 'a' ? 'Image A' : 'Image B'}</span>
                <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploadingSide !== null}>
                  {uploadingSide === side ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                  {t('activities.builder.spot.upload', { defaultValue: 'Upload' })}
                </Button>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => upload(side, e.target.files?.[0])} />
              </div>
              <div
                onClick={side === 'a' ? addMarker : undefined}
                className={`relative aspect-[4/3] bg-muted ${side === 'a' && !preview ? 'cursor-crosshair' : ''}`}
              >
                {url ? (
                  <img src={url} alt={`Spot ${side}`} className="w-full h-full object-contain pointer-events-none select-none" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    {t('activities.builder.spot.noImage', { defaultValue: 'No image uploaded' })}
                  </div>
                )}
                <AnimatePresence>
                  {value.markers.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      style={{
                        left: `${m.x * 100}%`,
                        top: `${m.y * 100}%`,
                        width: `${m.r * 200}%`,
                        height: `${m.r * 200}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/15 shadow-[0_0_18px_hsl(var(--primary)/0.45)] flex items-center justify-center"
                    >
                      <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      {!preview && side === 'a' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          aria-label="remove marker"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Gameplay configuration */}
      <Card className="p-3 bg-card/40 border-border/40 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {t('activities.builder.spot.gameplay', { defaultValue: 'Gameplay configuration' })}
        </p>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">{t('activities.builder.spot.difficulty', { defaultValue: 'Difficulty' })}</span>
            <select
              value={value.difficulty ?? 'medium'}
              onChange={(e) => onChange({ ...value, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="easy">{t('activities.difficulty.easy', { defaultValue: 'Easy' })}</option>
              <option value="medium">{t('activities.difficulty.medium', { defaultValue: 'Medium' })}</option>
              <option value="hard">{t('activities.difficulty.hard', { defaultValue: 'Hard' })}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">{t('activities.builder.spot.timeLimit', { defaultValue: 'Time (sec)' })}</span>
            <Input
              type="number" min={15} max={600}
              value={value.time_limit_sec ?? ''}
              onChange={(e) => onChange({ ...value, time_limit_sec: e.target.value ? Math.max(15, Math.min(600, Number(e.target.value))) : undefined })}
              placeholder="auto"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">{t('activities.builder.spot.hintPenalty', { defaultValue: 'Hint penalty %' })}</span>
            <Input
              type="number" min={0} max={50}
              value={value.hint_penalty != null ? Math.round(value.hint_penalty * 100) : ''}
              onChange={(e) => onChange({ ...value, hint_penalty: e.target.value ? Math.max(0, Math.min(0.5, Number(e.target.value) / 100)) : undefined })}
              placeholder="auto"
            />
          </label>
          <label className="flex items-center gap-2 text-xs pt-5">
            <input
              type="checkbox"
              checked={value.hints_enabled !== false}
              onChange={(e) => onChange({ ...value, hints_enabled: e.target.checked })}
              className="accent-primary"
            />
            {t('activities.builder.spot.hintsEnabled', { defaultValue: 'Allow hints' })}
          </label>
        </div>
        {hasOverlap(value.markers, value.tap_tolerance ?? 0.06) && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('activities.builder.spot.overlapWarn', { defaultValue: 'Some markers overlap — consider spacing them apart.' })}
          </p>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('activities.builder.spot.count', { defaultValue: '{{n}} difference(s) defined', n: value.markers.length })}</span>
        {value.markers.length > 0 && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ ...value, markers: [] })}>
            <Trash2 className="w-4 h-4 me-1" />
            {t('activities.builder.spot.clear', { defaultValue: 'Clear all' })}
          </Button>
        )}
      </div>
    </div>
  );
}
