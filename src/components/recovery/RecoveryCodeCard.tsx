import { useState } from 'react';
import { Copy, Download, Check, AlertTriangle } from 'lucide-react';
import { downloadRecoveryCode } from '@/lib/recovery';
import { toast } from 'sonner';

interface Props {
  code: string;
  onContinue: () => void;
}

/** Modal shown once after anonymous signup — cannot dismiss without confirming save. */
export default function RecoveryCodeCard({ code, onContinue }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Recovery code copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Copy failed — please write it down');
    }
  };

  const download = () => {
    downloadRecoveryCode(code);
    setDownloaded(true);
    toast.success('Recovery code file downloaded');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-code-title"
    >
      <div className="glass rounded-2xl p-8 max-w-md w-full mx-auto shadow-2xl border border-amber-400/20">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 id="recovery-code-title" className="text-lg font-display text-foreground">
              Save your recovery code
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              This is the only way to restore your anonymous account on another device.
              We cannot show it again. We cannot recover it.
            </p>
          </div>
        </div>

        <div
          className={`bg-card/60 border rounded-xl p-4 my-6 text-center select-all transition-colors duration-300 ${
            copied
              ? 'border-emerald-500/60 ring-2 ring-emerald-500/25'
              : 'border-border/50'
          }`}
        >
          <code className="font-mono text-lg tracking-[0.25em] text-primary break-all">{code}</code>
          {copied && (
            <p className="mt-3 text-xs font-ui text-emerald-400 flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" aria-hidden />
              Copied successfully
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={copy}
            className={`sentinel-btn-outline flex items-center justify-center gap-2 py-2.5 text-sm ${
              copied ? 'border-emerald-500/40 text-emerald-400' : ''
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button
            type="button"
            onClick={download}
            className={`sentinel-btn-outline flex items-center justify-center gap-2 py-2.5 text-sm ${
              downloaded ? 'border-emerald-500/40 text-emerald-400' : ''
            }`}
          >
            {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            Download Recovery Code
          </button>
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>I have saved my recovery code in a safe place.</span>
        </label>

        <button
          type="button"
          onClick={onContinue}
          disabled={!acknowledged}
          className="sentinel-btn w-full disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}
