import { describe, it, expect } from 'vitest';
import { extractChatAttachmentPath, isChatAttachmentStorageRef } from '@/lib/storage/chatAttachments';

describe('chat attachment storage paths', () => {
  it('extracts path from legacy public URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/chat-attachments/user-1/voice.webm';
    expect(extractChatAttachmentPath(url)).toBe('user-1/voice.webm');
  });

  it('accepts raw storage paths', () => {
    expect(extractChatAttachmentPath('user-1/chats/c1/file.png')).toBe('user-1/chats/c1/file.png');
  });

  it('detects chat-attachment refs', () => {
    expect(isChatAttachmentStorageRef('https://x.co/storage/v1/object/public/chat-attachments/a')).toBe(true);
    expect(isChatAttachmentStorageRef('https://cdn.example.com/other.jpg')).toBe(false);
  });
});
