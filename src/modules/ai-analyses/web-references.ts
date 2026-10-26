import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { AnalysisReference } from './ai-analysis.entity';

/**
 * 웹 검색 응답에서 참고자료를 뽑고 실제로 열리는지 확인한다.
 * 환각을 막으려고 세 가지를 모두 만족한 URL 만 남긴다.
 *  1. 모델 답변의 url_citation 어노테이션에 달린 URL (모델이 본문에 직접 쓴 URL 은 보지 않는다)
 *  2. 같은 응답의 web_search_call 이 실제로 검색·열람한 URL 목록에 있는 URL
 *  3. 서버가 직접 요청했을 때 2xx/3xx 로 응답하는 공개 주소
 */

export const MAX_REFERENCES_PER_ITEM = 3;
const MAX_CITED_CHARS = 300;
const CHECK_TIMEOUT_MS = 5_000;

/** Responses API 응답 중 여기서 쓰는 부분만 (테스트에서 손으로 만들기 쉽게) */
export interface WebSearchResponse {
  output: Array<
    | { type: 'web_search_call'; action?: { type: string; sources?: { url: string }[]; url?: string | null } }
    | { type: 'message'; content: Array<{ type: string; text?: string; annotations?: Array<{ type: string; url?: string; title?: string; start_index?: number }> }> }
    | { type: string }
  >;
}

export type ReferenceCandidate = Omit<AnalysisReference, 'id' | 'checkedAt'>;

/** 비교용 URL. 검색 도구가 붙이는 utm_* 와 #, 끝의 / 를 지운다. http(s) 가 아니면 null. */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  u.hash = '';
  return u.toString().replace(/\/$/, '');
}

/** 인용 표시 바로 앞의 문장. 마크다운 링크 괄호나 목록 기호는 지운다. */
function sentenceBefore(text: string, end: number): string {
  // 앞선 인용 링크 안의 . 이나 ? 를 문장 끝으로 보지 않도록 링크부터 지운다.
  // "…입니다. ([출처](url))" 처럼 문장부호 뒤에 인용이 붙으므로 끝의 부호도 빼고 앞 문장 경계를 찾는다.
  const head = text
    .slice(0, end)
    .replace(/\(\[[^\]]*\]\([^)]*\)\)|\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[\s.!?。]+$/, '');
  const cut = Math.max(head.lastIndexOf('\n'), head.search(/[.!?。](?=[^.!?。]*$)/));
  return head
    .slice(cut + 1)
    .replace(/^[\s\-*•\d.]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CITED_CHARS);
}

/** 검색 응답에서 1·2번 조건을 통과한 후보를 뽑는다. 같은 URL 은 처음 것만. */
export function extractCandidates(res: WebSearchResponse, query: string): ReferenceCandidate[] {
  const seen = new Set<string>();
  for (const o of res.output) {
    if (o.type !== 'web_search_call' || !('action' in o) || !o.action) continue;
    for (const s of o.action.sources ?? []) {
      const c = canonicalUrl(s.url);
      if (c) seen.add(c);
    }
    if (o.action.type === 'open_page' && o.action.url) {
      const c = canonicalUrl(o.action.url);
      if (c) seen.add(c);
    }
  }

  const out = new Map<string, ReferenceCandidate>();
  for (const o of res.output) {
    if (o.type !== 'message' || !('content' in o)) continue;
    for (const part of o.content) {
      if (part.type !== 'output_text' || !part.text) continue;
      for (const a of part.annotations ?? []) {
        if (a.type !== 'url_citation' || !a.url) continue;
        const c = canonicalUrl(a.url);
        if (!c || !seen.has(c) || out.has(c)) continue;
        out.set(c, { url: c, title: (a.title ?? '').trim() || new URL(c).hostname, citedText: sentenceBefore(part.text, a.start_index ?? 0), query });
      }
    }
  }
  return [...out.values()];
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

/** 내부망 주소로 요청하지 않도록 공개 주소인지 확인한다. */
async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

export type UrlChecker = (url: string) => Promise<boolean>;

/** 3번 조건: 공개 주소이고 직접 요청했을 때 2xx/3xx 인지. 리다이렉트는 따라가지 않는다. */
export const checkUrl: UrlChecker = async (url) => {
  if (!(await isPublicHost(new URL(url).hostname))) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { 'user-agent': 'TestoryReferenceCheck/1.0', accept: 'text/html,*/*' },
    });
    await res.body?.cancel();
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
};

/** 후보를 열어 보고 통과한 것만 확인 시각과 함께 돌려준다. */
export async function verifyCandidates(candidates: ReferenceCandidate[], check: UrlChecker = checkUrl): Promise<Omit<AnalysisReference, 'id'>[]> {
  const ok = await Promise.all(candidates.map((c) => check(c.url).catch(() => false)));
  const checkedAt = new Date().toISOString();
  return candidates.filter((_, i) => ok[i]).slice(0, MAX_REFERENCES_PER_ITEM).map((c) => ({ ...c, checkedAt }));
}
