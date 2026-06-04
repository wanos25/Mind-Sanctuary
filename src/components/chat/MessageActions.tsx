import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Share2, ThumbsUp, ThumbsDown, CornerUpLeft, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { emitVoiceEvent, type VoiceEventName } from '@/lib/voice/telemetry';
import { useFeedback } from '@/hooks/useFeedback';

interface Props {
  role: 'user' | 'assistant';
  messageId: string;
  sessionId?: string;
  /** Raw textual content to copy/share (transcript for voice). */
  text: string;
  isVoice?: boolean;
  voiceUrl?: string;
  onReply?: () => void;
  onReplay?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  align?: 'start' | 'end';
}

function emit(name: VoiceEventName, messageId: string, sessionId?: string, meta?: Record<string, unknown>) {
  emitVoiceEvent(name, { messageId, sessionId, meta });
}

export default function MessageActions({
  role, messageId, sessionId, text, isVoice, voiceUrl,
  onReply, onReplay, onRegenerate, onDelete, align = 'start',
}: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { rating: feedback, like: toggleLike, dislike: toggleDislike, pending: feedbackPending } = useFeedback(messageId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      emit('action_copy', messageId, sessionId, { role });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('chat.toasts.copyFailed'));
    }
  };

  const handleShare = async () => {
    emit('action_share', messageId, sessionId, { role });
    const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as
      (Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }) | undefined;
    if (nav?.share) {
      try { await nav.share({ text, url: voiceUrl }); return; } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(voiceUrl ? `${text}\n${voiceUrl}` : text);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('chat.toasts.copyFailed'));
    }
  };

  const handleLike = () => {
    if (feedbackPending) return;
    void toggleLike();
  };
  const handleDislike = () => {
    if (feedbackPending) return;
    void toggleDislike();
  };

  const handleReply = () => {
    emit('action_reply', messageId, sessionId, { role });
    onReply?.();
  };

  const handleReplay = () => {
    emit('replay_voice', messageId, sessionId, { role });
    onReplay?.();
  };

  const Btn = ({
    onClick, label, children, tone = 'default', active,
  }: {
    onClick: () => void; label: string; children: React.ReactNode;
    tone?: 'default' | 'destructive' | 'primary'; active?: boolean;
  }) => (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1.5 min-w-[28px] min-h-[28px] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        tone === 'destructive'
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : active
          ? 'text-primary bg-primary/15'
          : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
      }`}
    >
      {children}
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={`flex items-center gap-0.5 px-1 ${align === 'end' ? 'justify-end' : ''}`}
    >
      <Btn onClick={handleCopy} label={t('chat.copyMessage')}>
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      </Btn>
      {onReply && (
        <Btn onClick={handleReply} label={t('chat.replyTo')}>
          <CornerUpLeft className="w-3.5 h-3.5" />
        </Btn>
      )}
      {isVoice && onReplay && (
        <Btn onClick={handleReplay} label={t('voice.replayVoice', { defaultValue: 'Replay voice' })}>
          <Play className="w-3.5 h-3.5" />
        </Btn>
      )}
      {role === 'assistant' && (
        <>
          <Btn onClick={handleShare} label={t('common.share')}>
            <Share2 className="w-3.5 h-3.5" />
          </Btn>
          <Btn onClick={handleLike} label={t('chat.like')} active={feedback === 'like'}>
            <ThumbsUp className="w-3.5 h-3.5" />
          </Btn>
          <Btn onClick={handleDislike} label={t('chat.dislike')} active={feedback === 'dislike'}>
            <ThumbsDown className="w-3.5 h-3.5" />
          </Btn>
          {onRegenerate && (
            <Btn onClick={onRegenerate} label={t('chat.regenerateResponse')}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Btn>
          )}
        </>
      )}
      {role === 'user' && onDelete && (
        <Btn onClick={onDelete} label={t('chat.deleteMessage')} tone="destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Btn>
      )}
    </motion.div>
  );
}
