import { describe, expect, it } from 'vitest';
import { canonicalUrl, checkUrl, extractCandidates, verifyCandidates, type WebSearchResponse } from './web-references';

const TEXT = '안드로이드는 절전 모드에서 알람 실행을 늦출 수 있어요. ([developer.android.com](https://developer.android.com/doze?utm_source=openai)) 정확한 시간이 필요하면 정확한 알람 권한이 필요해요. ([가짜](https://made-up.example/page))';

const response = (over?: Partial<{ sources: string[]; text: string; annotations: unknown[] }>): WebSearchResponse => ({
  output: [
    { type: 'web_search_call', action: { type: 'search', sources: (over?.sources ?? ['https://developer.android.com/doze']).map((url) => ({ url })) } },
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: over?.text ?? TEXT,
          annotations: (over?.annotations as never) ?? [
            { type: 'url_citation', url: 'https://developer.android.com/doze?utm_source=openai', title: 'Doze 모드', start_index: TEXT.indexOf('(['), end_index: 0 },
            { type: 'url_citation', url: 'https://made-up.example/page', title: '가짜', start_index: TEXT.lastIndexOf('(['), end_index: 0 },
          ],
        },
      ],
    },
  ],
});

describe('canonicalUrl', () => {
  it('utm_* 와 #, 끝의 / 를 지우고 http(s) 만 받는다', () => {
    expect(canonicalUrl('https://a.dev/x/?utm_source=openai&q=1#top')).toBe('https://a.dev/x/?q=1');
    expect(canonicalUrl('https://a.dev/x/')).toBe('https://a.dev/x');
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalUrl('not a url')).toBeNull();
  });
});

describe('extractCandidates', () => {
  it('인용됐고 실제 검색 소스에도 있는 URL 만 남기고, 인용 앞 문장을 근거로 둔다', () => {
    const c = extractCandidates(response(), '알림 지연');
    expect(c).toEqual([
      { url: 'https://developer.android.com/doze', title: 'Doze 모드', citedText: '안드로이드는 절전 모드에서 알람 실행을 늦출 수 있어요', query: '알림 지연' },
    ]);
  });

  it('앞선 인용 링크 안의 ? 나 . 를 문장 끝으로 보지 않는다', () => {
    const text = '첫 문장이에요. ([a.dev](https://a.dev/x?utm_source=openai)) 또한, 둘째 문장이에요. ([b.dev](https://b.dev/y?utm_source=openai))';
    const c = extractCandidates(
      response({
        sources: ['https://b.dev/y'],
        text,
        annotations: [{ type: 'url_citation', url: 'https://b.dev/y?utm_source=openai', title: 'B', start_index: text.lastIndexOf('([') }],
      }),
      'q',
    );
    expect(c[0].citedText).toBe('또한, 둘째 문장이에요');
  });

  it('검색 소스가 없으면 인용이 있어도 아무것도 남기지 않는다', () => {
    expect(extractCandidates(response({ sources: [] }), 'q')).toEqual([]);
  });

  it('본문에만 쓰인 URL(인용 어노테이션이 없는 것)은 무시한다', () => {
    expect(extractCandidates(response({ text: '자세한 건 https://developer.android.com/doze 참고', annotations: [] }), 'q')).toEqual([]);
  });

  it('모델이 직접 연 페이지(open_page)도 검색 소스로 본다', () => {
    const res = response({ sources: [] });
    res.output.unshift({ type: 'web_search_call', action: { type: 'open_page', url: 'https://developer.android.com/doze' } });
    expect(extractCandidates(res, 'q').map((c) => c.url)).toEqual(['https://developer.android.com/doze']);
  });
});

describe('verifyCandidates', () => {
  it('열리지 않는 URL 은 버리고 확인 시각을 붙인다', async () => {
    const base = { title: 't', citedText: 'c', query: 'q' };
    const out = await verifyCandidates(
      [
        { ...base, url: 'https://ok.dev' },
        { ...base, url: 'https://dead.dev' },
      ],
      async (url) => url === 'https://ok.dev',
    );
    expect(out.map((r) => r.url)).toEqual(['https://ok.dev']);
    expect(Date.parse(out[0].checkedAt)).not.toBeNaN();
  });

  it('내부망 주소는 요청하지 않고 거절한다', async () => {
    expect(await checkUrl('http://127.0.0.1:4000/health')).toBe(false);
    expect(await checkUrl('http://localhost/x')).toBe(false);
    expect(await checkUrl('http://[::1]/x')).toBe(false);
    expect(await checkUrl('http://192.168.0.1/')).toBe(false);
  });
});
