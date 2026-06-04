import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { FileText, Image as ImageIcon, Download, Sparkles, CornerUpLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmotionState } from '@/context/AppContext';
import Lightbox from './Lightbox';
import VoicePlayer from '@/components/voice/VoicePlayer';
import MessageActions from './MessageActions';
import { parseVoiceContent, isReflection, reflectionText } from '@/lib/voice/upload';
import { formatTime as fmtTime } from '@/lib/locale/format';
import { resolveChatAttachmentAccessUrl } from '@/lib/storage/chatAttachments';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';
import { useIsActiveSpeaker } from '@/lib/voice/audioOrchestrator';

export interface MessageAttachment {
  url: string;
  path?: string;
  name: string;
  type: string;
  size?: number;
}

interface Props {
  id: string;
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: EmotionState;
  timestamp?: number;
  attachments?: MessageAttachment[];
  /** True while this assistant message is actively streaming. */
  streaming?: boolean;
  /** Grouped with previous same-role message — hides avatar/header for compact stacking. */
  groupedWithPrev?: boolean;
  /** Grouped with next same-role message — hides timestamp until hover. */
  groupedWithNext?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onReplay?: () => void;
  autoplayVoice?: boolean;
  /** Optional hydrated parent message used to render the quoted-reply preview. Depth=1 only. */
  parent?: { id: string; role: 'user' | 'assistant'; preview: string; isVoice?: boolean } | null;
  onJumpToParent?: (id: string) => void;
}

const emotionTone: Record<string, string> = {
  calm: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'mild stress': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'moderate anxiety': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'severe depression': 'bg-red-500/15 text-red-300 border-red-500/30',
  burnout: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentImage({ url, path, alt }: { url: string; path?: string; alt: string }) {
  const resolved = useResolvedStorageUrl(url, path);
  if (!resolved) return null;
  return (
    <img src={resolved} alt={alt} className="w-full h-auto max-h-64 object-cover" loading="lazy" />
  );
}

function AttachmentFileLink({ url, path, name, size }: { url: string; path?: string; name: string; size?: number }) {
  const resolved = useResolvedStorageUrl(url, path);
  if (!resolved) return null;
  return (
    <a
      href={resolved}
      target="_blank"
      rel="noreferrer"
      className="glass border border-border/40 rounded-xl p-2.5 flex items-center gap-2.5 hover:border-primary/40 transition-colors"
      title={`${name} · ${formatBytes(size)}`}
    >
      <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-ui text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {formatBytes(size)}
        </p>
      </div>
      <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

// Strips markdown/voice-tag noise and clamps for the quoted-parent preview.
function sanitizePreview(s: string): string {
  return (s || '')
    .replace(/\u0001VOICE\u0001[\s\S]*?\u0001\/VOICE\u0001/g, '')
    .replace(/[`*_>#~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function MessageBubble({
  id, sessionId, role, content, emotion, timestamp, attachments,
  streaming, groupedWithPrev, groupedWithNext, onRegenerate, onDelete, onReply, onReplay, autoplayVoice,
  parent, onJumpToParent,
}: Props) {
  const { t } = useTranslation();
  const isUser = role === 'user';
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const images = (attachments ?? []).filter((a) => a.type.startsWith('image/'));
  const files = (attachments ?? []).filter((a) => !a.type.startsWith('image/'));

  const reflection = !isUser && isReflection(content);
  const visibleContent = reflection ? reflectionText(content) : content;
  const { text: voiceText, voice } = parseVoiceContent(visibleContent);
  const isVoice = !!voice;
  const isSpeaking = useIsActiveSpeaker(id);
  const pulseGlow = streaming || (!isUser && isSpeaking);
  // Reply preview breaks grouping; never visually grouped if quoting parent
  const isGroupedTop = !!groupedWithPrev && !parent;
  const isGroupedBottom = !!groupedWithNext;
  const showAvatar = !isUser && !isGroupedTop;
  const showHeader = !isUser && !isGroupedTop;
  const showTimestamp = !isGroupedBottom || hover;

  return (
    <motion.div
      initial={{ opacity: 0, y: isGroupedTop ? 4 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isGroupedTop ? 0.22 : 0.35, ease: [0.22, 0.61, 0.36, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-message-id={id}
      data-grouped-top={isGroupedTop || undefined}
      data-grouped-bottom={isGroupedBottom || undefined}
      className={`group flex w-full scroll-mt-24 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex gap-3 max-w-[88%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && (
          showAvatar ? (
            <motion.div
              animate={pulseGlow ? {
                boxShadow: [
                  '0 0 16px hsl(var(--gold) / 0.35)',
                  '0 0 28px hsl(var(--gold) / 0.65)',
                  '0 0 16px hsl(var(--gold) / 0.35)',
                ],
              } : undefined}
              transition={pulseGlow ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm shadow-[0_0_16px_hsl(var(--gold)/0.35)]"
              aria-label={isSpeaking ? t('voice.speaking', { defaultValue: 'Speaking' }) : undefined}
            >
              🧠
            </motion.div>
          ) : (
            <div className="flex-shrink-0 w-8" aria-hidden />
          )
        )}
        <div className={`min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
          {showHeader && (
            <span className="text-[10px] font-ui tracking-[0.2em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
              {reflection && <Sparkles className="w-2.5 h-2.5 text-primary/80" />}
              {reflection ? t('chat.reflection') : t('chat.drSentinel')}
            </span>
          )}

          {parent && parent.id !== id && (
            <button
              type="button"
              onClick={() => onJumpToParent?.(parent.id)}
              className="max-w-full text-start glass border-s-2 border-primary/50 rounded-xl px-2.5 py-1.5 flex items-center gap-2 hover:border-primary transition-colors"
              aria-label={t('chat.repliedTo', { defaultValue: 'Replying to message — tap to jump' })}
            >
              <CornerUpLeft className="w-3 h-3 text-primary/80 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-ui uppercase tracking-[0.18em] text-primary/70">
                  {parent.role === 'assistant' ? t('chat.drSentinel') : t('common.you')}
                  {parent.isVoice ? ` · ${t('voice.voiceMessage')}` : ''}
                </p>
                <p className="text-[11px] font-ui text-foreground/80 truncate max-w-[260px]">
                  {sanitizePreview(parent.preview)}
                </p>
              </div>
            </button>
          )}

          {images.length > 0 && (
            <div className={`grid gap-1.5 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} max-w-sm`}>
              {images.map((img) => (
                <motion.button
                  key={img.path ?? img.url}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => {
                    void resolveChatAttachmentAccessUrl(img.url, { path: img.path }).then((u) => {
                      if (u) setLightbox(u);
                    });
                  }}
                  className="relative group/img rounded-xl overflow-hidden border border-border/40 bg-secondary/30"
                  title={img.name}
                >
                  <AttachmentImage url={img.url} path={img.path} alt={img.name} />
                  <div className="absolute inset-0 bg-background/0 group-hover/img:bg-background/25 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                    <ImageIcon className="w-5 h-5 text-white drop-shadow" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex flex-col gap-1.5 max-w-sm w-full">
              {files.map((f) => (
                <AttachmentFileLink
                  key={f.path ?? f.url}
                  url={f.url}
                  path={f.path}
                  name={f.name}
                  size={f.size}
                />
              ))}
            </div>
          )}

          {(visibleContent || (!images.length && !files.length)) && (
            <div
              className={`relative rounded-2xl transition-shadow ${isVoice ? 'px-3 py-2.5' : 'px-5 py-3.5'} ${
                reflection
                  ? 'border border-primary/25 bg-primary/[0.04] backdrop-blur-md shadow-[0_0_30px_-6px_hsl(var(--gold)/0.35)]'
                  : isUser
                  ? 'bg-secondary/60 border border-border/60 text-foreground'
                  : 'glass border border-primary/20 text-foreground'
              } ${
                streaming ? 'shadow-[0_0_28px_-6px_hsl(var(--gold)/0.5)]' : reflection ? '' : 'shadow-[0_0_20px_hsl(var(--gold)/0.06)]'
              }`}
            >
              {isVoice && voice ? (
                <div className="flex flex-col gap-1.5">
                  <VoicePlayer
                    url={voice.url}
                    path={voice.path}
                    duration={voice.duration}
                    waveform={voice.waveform}
                    pending={voice.pending}
                    autoplay={autoplayVoice && !isUser}
                    messageId={id}
                    sessionId={sessionId}
                    variant={isUser ? 'user' : 'assistant'}
                  />

                  {voiceText && voiceText !== '[Voice message]' && (
                    <p className="text-[11px] font-ui italic text-muted-foreground/80 px-1 line-clamp-3">
                      “{voiceText}”
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className={`text-sm font-body leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5 prose-strong:text-primary prose-code:text-primary prose-code:bg-secondary/60 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:before:hidden prose-code:after:hidden ${
                    reflection ? 'italic text-foreground/85' : ''
                  }`}
                >
                  {visibleContent ? (
                    <>
                      <ReactMarkdown>{visibleContent}</ReactMarkdown>
                      {streaming && (
                        <motion.span
                          aria-hidden
                          className="inline-block w-[2px] h-[1em] bg-primary align-text-bottom ms-0.5 rounded-sm"
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </>
                  ) : (
                    <span className="opacity-50">…</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Unified action bar */}
          {content && (
            <AnimatePresence>
              {hover && !streaming && (
                <MessageActions
                  role={role}
                  messageId={id}
                  sessionId={sessionId}
                  text={voiceText || visibleContent}
                  isVoice={isVoice}
                  voiceUrl={voice?.url}
                  onReply={onReply}
                  onReplay={isVoice && onReplay ? onReplay : undefined}
                  onRegenerate={onRegenerate}
                  onDelete={onDelete}
                  align={isUser ? 'end' : 'start'}
                />
              )}
            </AnimatePresence>
          )}

          {(emotion || timestamp) && (
            <div
              className={`flex items-center gap-2 flex-wrap px-1 transition-opacity duration-200 ${
                showTimestamp ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
              }`}
              aria-hidden={!showTimestamp}
            >
              {emotion && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-ui capitalize border ${
                    emotionTone[emotion.primary] ?? 'bg-primary/15 text-primary border-primary/30'
                  }`}
                >
                  {emotion.primary}
                </span>
              )}
              {emotion?.distortions.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded-full text-[10px] font-ui bg-secondary/60 border border-border text-muted-foreground capitalize"
                >
                  {d}
                </span>
              ))}
              {timestamp && (
                <span className="text-[10px] font-ui text-muted-foreground/70">
                  {fmtTime(timestamp)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </motion.div>
  );
}

// Fast, stable 32-bit string hash (FNV-1a variant) used to cheaply detect
// content changes without comparing potentially long strings byte-by-byte
// on every parent re-render.
export function hashContent(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function areMessagePropsEqual(prev: Props, next: Props): boolean {
  if (prev.id !== next.id) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.role !== next.role) return false;
  if (prev.timestamp !== next.timestamp) return false;
  if (prev.autoplayVoice !== next.autoplayVoice) return false;
  if (prev.groupedWithPrev !== next.groupedWithPrev) return false;
  if (prev.groupedWithNext !== next.groupedWithNext) return false;
  if (prev.emotion?.primary !== next.emotion?.primary) return false;
  if (prev.emotion?.intensity !== next.emotion?.intensity) return false;
  if ((prev.attachments?.length ?? 0) !== (next.attachments?.length ?? 0)) return false;
  if (prev.parent?.id !== next.parent?.id) return false;
  if (prev.onRegenerate !== next.onRegenerate) return false;
  if (prev.onDelete !== next.onDelete) return false;
  if (prev.onReply !== next.onReply) return false;
  if (prev.onReplay !== next.onReplay) return false;
  // Hash short-circuits long-string equality on stable messages; a matching
  // hash is then verified with exact string equality to defend against the
  // (rare) FNV-1a collision.
  if (prev.content.length !== next.content.length) return false;
  if (hashContent(prev.content) !== hashContent(next.content)) return false;
  return prev.content === next.content;
}

export default memo(MessageBubble, areMessagePropsEqual);
