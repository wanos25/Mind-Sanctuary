import { useEffect, useRef, useState, DragEvent, ClipboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, Send, X, FileText, Image as ImageIcon, Loader2, RotateCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VoiceRecorderButton from '@/components/voice/VoiceRecorderButton';
import ReplyPreview, { type ReplyTarget } from './ReplyPreview';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { uploadChatAttachment, isAccepted, UploadedAttachment } from '@/lib/uploadAttachment';
import type { VoiceRecording } from '@/lib/voice/recorder';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onVoice: (text: string) => void;
  onVoiceMessage?: (rec: VoiceRecording, transcript: string) => void;
  onMicToggle?: () => void;
  onAttachmentsChange?: (attachments: UploadedAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: ReplyTarget | null;
  onClearReply?: () => void;
  onJumpToReply?: (id: string) => void;
}

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  uploaded?: UploadedAttachment;
  error?: string;
}

const ACCEPT = 'image/*,application/pdf,text/plain,.txt,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function ChatInput({
  value, onChange, onSend, onAttach, onVoice, onVoiceMessage, onMicToggle, onAttachmentsChange, disabled, placeholder,
  replyTo, onClearReply, onJumpToReply,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentSessionId, currentChatId } = useApp();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  useEffect(() => {
    onAttachmentsChange?.(
      attachments.filter((a) => a.status === 'success' && a.uploaded).map((a) => a.uploaded!),
    );
  }, [attachments, onAttachmentsChange]);

  const uploadOne = async (id: string, file: File) => {
    if (!user) return;
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'uploading', progress: 0, error: undefined } : a));
    try {
      const uploaded = await uploadChatAttachment(file, user.id, (pct) => {
        setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, progress: pct } : a));
      }, { chatId: currentChatId, sessionId: currentSessionId });
      setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'success', progress: 100, uploaded } : a));
    } catch (err) {
      const msg = (err as Error).message || t('chat.uploadFailed');
      setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'error', error: msg } : a));
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) {
      toast.error(t('chat.toasts.signInToUpload'));
      return;
    }
    for (const file of Array.from(files)) {
      if (!isAccepted(file)) { toast.error(t('chat.toasts.unsupported', { name: file.name })); continue; }
      if (file.size > 20 * 1024 * 1024) { toast.error(t('chat.toasts.tooLarge', { name: file.name })); continue; }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setAttachments((prev) => [...prev, { id, file, previewUrl, progress: 0, status: 'uploading' }]);
      uploadOne(id, file);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = () => {
    onSend();
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items).map((i) => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const successCount = attachments.filter((a) => a.status === 'success').length;
  const canSend = (value.trim() || successCount > 0) && !disabled;

  return (
    <div
      data-testid="chat-input"
      className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sticky bottom-0 z-20 bg-gradient-to-t from-background via-background/85 to-transparent"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="max-w-3xl mx-auto relative">
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 flex items-center justify-center pointer-events-none backdrop-blur-sm"
            >
              <p className="text-sm font-ui text-primary">{t('chat.dropFiles')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply quote */}
        <ReplyPreview
          target={replyTo ?? null}
          onClear={() => onClearReply?.()}
          onJump={(id) => onJumpToReply?.(id)}
        />

        {/* Attachment chips */}
        <div className="flex gap-2 flex-wrap mb-2">
          <AnimatePresence initial={false}>
            {attachments.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`relative overflow-hidden glass border rounded-xl p-2 pr-3 flex items-center gap-2 min-w-[200px] max-w-[280px] ${
                  a.status === 'error' ? 'border-destructive/50' : 'border-border/40'
                }`}
              >
                {/* shimmer progress bar */}
                {a.status === 'uploading' && (
                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40"
                    style={{ width: `${a.progress}%` }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-secondary/60 flex items-center justify-center flex-shrink-0">
                    {a.file.type.startsWith('image/')
                      ? <ImageIcon className="w-4 h-4 text-primary/70" />
                      : <FileText className="w-4 h-4 text-primary/70" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-ui text-foreground truncate" title={a.file.name}>{a.file.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {a.status === 'uploading' && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
                    {a.status === 'error' && <AlertCircle className="w-3 h-3 text-destructive" />}
                    <p className={`text-[10px] font-ui tracking-wide ${
                      a.status === 'error' ? 'text-destructive' :
                      a.status === 'success' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {a.status === 'uploading' && `${t('chat.uploading')} · ${a.progress}%`}
                      {a.status === 'success' && t('chat.ready')}
                      {a.status === 'error' && (a.error ?? t('chat.uploadFailed'))}
                    </p>
                  </div>
                </div>
                {a.status === 'error' && (
                  <button
                    onClick={() => uploadOne(a.id, a.file)}
                    className="p-1 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-primary"
                    aria-label={t('common.retry')}
                    title={t('common.retry')}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="p-1 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  aria-label={t('chat.remove')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative glass-strong rounded-2xl p-2.5 border transition-all duration-300 flex gap-1.5 items-end ${
            focused
              ? 'border-primary/50 shadow-[0_8px_50px_-10px_hsl(var(--gold)/0.55)]'
              : 'border-primary/20 shadow-[0_8px_40px_-14px_hsl(var(--gold)/0.35)]'
          }`}
        >
          {/* animated focus ring */}
          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary/30"
              />
            )}
          </AnimatePresence>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
            className="hidden"
          />
          <button
            onClick={() => { onAttach(); fileInputRef.current?.click(); }}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors flex-shrink-0"
            title={t('chat.attach')}
            aria-label={t('chat.attach')}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) handleSend();
              }
            }}
            placeholder={placeholder ?? t('chat.placeholder')}
            rows={1}
            className="flex-1 bg-transparent text-foreground font-ui text-sm placeholder:text-muted-foreground/50 focus:outline-none resize-none py-2.5 px-1 max-h-[200px] leading-relaxed"
          />

          <div className="flex-shrink-0">
            <VoiceRecorderButton
              disabled={disabled}
              onRecorded={(rec, transcript) => {
                onMicToggle?.();
                if (onVoiceMessage) onVoiceMessage(rec, transcript);
                else if (transcript) onVoice(transcript);
              }}
            />
          </div>

          <motion.button
            whileHover={canSend ? { scale: 1.08 } : undefined}
            whileTap={canSend ? { scale: 0.92 } : undefined}
            animate={{
              backgroundColor: canSend ? 'hsl(var(--gold) / 0.95)' : 'hsl(var(--secondary) / 0.4)',
              color: canSend ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
              boxShadow: canSend
                ? '0 0 22px -4px hsl(var(--gold) / 0.55), 0 2px 10px -2px hsl(var(--gold) / 0.4)'
                : '0 0 0px hsl(var(--gold) / 0)',
            }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={handleSend}
            disabled={!canSend}
            className="p-3 disabled:cursor-not-allowed rounded-xl flex-shrink-0 relative overflow-hidden"
            aria-label={t('common.send')}
            title={t('common.send')}
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <motion.span
                key={canSend ? 'ready' : 'idle'}
                initial={{ scale: 0.7, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="block"
              >
                <Send className="w-4 h-4" />
              </motion.span>
            )}
          </motion.button>
        </motion.div>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-2 font-ui">
          {t('chat.inputHint')}
        </p>
      </div>
    </div>
  );
}
