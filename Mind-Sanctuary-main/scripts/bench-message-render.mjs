#!/usr/bin/env node
/**
 * Micro-benchmark: simulates how many MessageBubble renders are avoided by
 * the memo comparator when a parent re-renders a long chat history.
 *
 * Runs two scenarios over N synthetic messages:
 *   - "naive":     no memo — every parent render re-renders every child.
 *   - "memoized":  current comparator (id + length + FNV-1a + exact equal).
 *
 * We mutate only the LAST message's content on each parent render (typical
 * streaming pattern). Memoized renders should be O(1) instead of O(N).
 */

function hashContent(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function areEqual(prev, next) {
  if (prev.id !== next.id) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.role !== next.role) return false;
  if (prev.timestamp !== next.timestamp) return false;
  if (prev.content.length !== next.content.length) return false;
  if (hashContent(prev.content) !== hashContent(next.content)) return false;
  return prev.content === next.content;
}

const N = Number(process.argv[2] ?? 500);
const PARENT_RENDERS = Number(process.argv[3] ?? 200);

const base = Array.from({ length: N }, (_, i) => ({
  id: `m${i}`,
  role: i % 2 ? 'assistant' : 'user',
  content: `Message ${i} `.repeat(20),
  timestamp: 1_700_000_000 + i,
  streaming: false,
}));

function run(memoized) {
  let renders = 0;
  let prev = base.map((m) => ({ ...m }));
  const t0 = performance.now();
  for (let r = 0; r < PARENT_RENDERS; r++) {
    const next = prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, content: m.content + 'x' } : m,
    );
    for (let i = 0; i < next.length; i++) {
      if (!memoized || !areEqual(prev[i], next[i])) renders++;
    }
    prev = next;
  }
  return { renders, ms: +(performance.now() - t0).toFixed(2) };
}

const naive = run(false);
const memo = run(true);
const reduction = (((naive.renders - memo.renders) / naive.renders) * 100).toFixed(2);

console.log(`Messages: ${N}, parent renders: ${PARENT_RENDERS}`);
console.log(`naive    : renders=${naive.renders.toLocaleString()}  time=${naive.ms}ms`);
console.log(`memoized : renders=${memo.renders.toLocaleString()}  time=${memo.ms}ms`);
console.log(`reduction: ${reduction}%  (avoided ${(naive.renders - memo.renders).toLocaleString()} renders)`);
