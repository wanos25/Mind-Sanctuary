import { describe, it, expect } from 'vitest';
import { validateAttachmentFile, MAX_ATTACHMENT_BYTES } from '@/lib/uploadAttachment';

describe('upload validation', () => {
  it('rejects oversized files', () => {
    const file = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.png', { type: 'image/png' });
    expect(validateAttachmentFile(file)).toBe('file_too_large');
  });

  it('rejects blocked extensions', () => {
    const file = new File(['x'], 'malware.exe', { type: 'application/octet-stream' });
    expect(validateAttachmentFile(file)).toBe('blocked_extension');
  });

  it('accepts pdf', () => {
    const file = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateAttachmentFile(file)).toBeNull();
  });
});
