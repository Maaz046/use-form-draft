// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useFormDraft } from './useFormDraft';
import { DraftBanner } from './DraftBanner';
import { useDraftBanner } from './useDraftBanner';

describe('SSR (no window)', () => {
  it('useFormDraft does not throw when rendered server-side', () => {
    function Form() {
      const draft = useFormDraft('ssr:form', { foo: 'bar' }, () => {});
      return <div data-restored={draft.restored ? 'yes' : 'no'} />;
    }
    expect(() => renderToString(<Form />)).not.toThrow();
  });

  it('useFormDraft.restored is false on the server (no localStorage access)', () => {
    function Form() {
      const draft = useFormDraft('ssr:form', { foo: 'bar' }, () => {});
      return <div data-restored={draft.restored ? 'yes' : 'no'} />;
    }
    const html = renderToString(<Form />);
    expect(html).toContain('data-restored="no"');
  });

  it('DraftBanner renders null on the server (avoids hydration mismatch)', () => {
    const html = renderToString(
      <DraftBanner savedAt={new Date()} onDiscard={() => {}} />,
    );
    expect(html).toBe('');
  });

  it('DraftBanner renders null on the server when savedAt is null', () => {
    const html = renderToString(
      <DraftBanner savedAt={null} onDiscard={() => {}} />,
    );
    expect(html).toBe('');
  });

  it('useDraftBanner returns relativeTime=null on the server', () => {
    function Banner() {
      const banner = useDraftBanner({ savedAt: new Date() });
      return <div data-time={String(banner.relativeTime)} />;
    }
    const html = renderToString(<Banner />);
    expect(html).toContain('data-time="null"');
  });
});
