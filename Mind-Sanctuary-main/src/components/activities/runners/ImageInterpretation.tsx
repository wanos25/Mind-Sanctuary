import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import type { ActivityAsset, ImageInterpretationContent } from '@/lib/activities/types';

interface Props {
  asset: ActivityAsset;
  onComplete: (response: Record<string, unknown>, score?: number) => void;
}

export default function ImageInterpretation({ asset, onComplete }: Props) {
  const { t } = useTranslation();
  const content = asset.content as ImageInterpretationContent;
  const [text, setText] = useState('');

  return (
    <Card className="p-6 space-y-4" role="region" aria-labelledby="image-activity-title">
      <h2 id="image-activity-title" className="text-lg font-semibold">{asset.title}</h2>
      {content.image_url && (
        <img
          src={content.image_url}
          alt={content.prompt ? `${asset.title}: ${content.prompt}` : asset.title}
          loading="lazy"
          decoding="async"
          className="w-full max-h-80 object-contain rounded-lg bg-muted"
        />
      )}
      {content.prompt && <p className="text-sm text-muted-foreground">{content.prompt}</p>}
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 4000))}
        placeholder={t('activities.runner.yourInterpretation') ?? ''}
        aria-label={t('activities.runner.yourInterpretation', { defaultValue: 'Your interpretation' })}
      />
      <div className="flex justify-end">
        <Button disabled={!text.trim()} onClick={() => onComplete({ interpretation: text })}>
          {t('activities.runner.finish')}
        </Button>
      </div>
    </Card>
  );
}
