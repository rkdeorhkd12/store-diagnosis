import { useEffect, useState } from 'react';
import InventoryApp from './components/inventory/InventoryApp';
import ModeSelect, { type Mode } from './components/ModeSelect';
import SalesApp from './components/SalesApp';

const SUBTITLE: Record<Mode | 'none', string> = {
  none: '쇼핑몰 엑셀로 판매와 재고 상태를 한눈에 확인하세요',
  sales: '판매 진단 · 주문 엑셀로 매출과 판매 흐름을 확인합니다',
  inventory: '재고 진단 · 판매·재고 표로 부족·소진임박 옵션을 찾습니다',
};

/** 주소의 #sales / #inventory로 모드를 기억한다. 뒤로 가기로 선택 화면에 돌아올 수 있다. */
function modeFromHash(): Mode | null {
  const h = window.location.hash.slice(1);
  return h === 'sales' || h === 'inventory' ? h : null;
}

export default function App() {
  const [mode, setMode] = useState<Mode | null>(modeFromHash);

  useEffect(() => {
    const onHash = () => setMode(modeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (m: Mode | null) => {
    window.location.hash = m ?? '';
    if (!m) history.replaceState(null, '', window.location.pathname + window.location.search);
    setMode(m);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <h1>스토어 진단</h1>
          {mode && (
            <button type="button" className="btn-link" onClick={() => select(null)}>
              ← 진단 선택
            </button>
          )}
        </div>
        <p className="muted">{SUBTITLE[mode ?? 'none']}</p>
      </header>

      <main>
        {mode === null && <ModeSelect onSelect={select} />}
        {mode === 'sales' && <SalesApp />}
        {mode === 'inventory' && <InventoryApp />}
      </main>

      <footer className="app-footer muted small">
        파일은 이 브라우저 안에서만 처리되며 외부로 전송되지 않습니다.
      </footer>
    </div>
  );
}
