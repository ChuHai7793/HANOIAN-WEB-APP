import { loadAnalytics } from './analytics';

const fakeDoc = (): Document => document.implementation.createHTMLDocument('t');

describe('loadAnalytics', () => {
  it('gắn script Cloudflare với token trên tên miền thật, chỉ một lần', () => {
    const doc = fakeDoc();
    loadAnalytics('datingmaster.onrender.com', doc);
    loadAnalytics('datingmaster.onrender.com', doc);
    const scripts = doc.querySelectorAll('script[data-cf-beacon]');
    expect(scripts.length).toBe(1);
    expect(scripts[0].getAttribute('src')).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(JSON.parse(scripts[0].getAttribute('data-cf-beacon')!).token).toBe('05b6b9e234b745e6b9abed672df46bb1');
  });

  it('tên miền khác (bản SSR) dùng token mặc định', () => {
    const doc = fakeDoc();
    loadAnalytics('hanoivibe.onrender.com', doc);
    expect(doc.querySelector('script[data-cf-beacon]')).not.toBeNull();
  });

  it('chạy trên máy (localhost) thì không đếm', () => {
    const doc = fakeDoc();
    loadAnalytics('localhost', doc);
    expect(doc.querySelector('script[data-cf-beacon]')).toBeNull();
  });
});
