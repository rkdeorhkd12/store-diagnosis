import { useState } from 'react';
import ColumnMapper from './components/ColumnMapper';
import ColorShareChart from './components/ColorShareChart';
import FileUpload from './components/FileUpload';
import ProductRanking from './components/ProductRanking';
import SalesTrendChart from './components/SalesTrendChart';
import StepIndicator from './components/StepIndicator';
import SummaryCards from './components/SummaryCards';
import { analyze } from './lib/analyze';
import { guessMapping } from './lib/guessMapping';
import type { ColumnMapping, DiagnosisResult, ParsedSheet } from './types';

type Step = 'upload' | 'mapping' | 'result';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoaded = (parsed: ParsedSheet) => {
    setSheet(parsed);
    setMapping(guessMapping(parsed.headers));
    setResult(null);
    setError(null);
    setStep('mapping');
  };

  const handleSampleLoaded = (parsed: ParsedSheet) => {
    const guessed = guessMapping(parsed.headers);
    setSheet(parsed);
    setMapping(guessed);
    setError(null);
    try {
      setResult(analyze(parsed, guessed));
      setStep('result');
    } catch {
      // 자동 매칭이 맞지 않으면 매칭 화면에서 고칠 수 있게 한다.
      setStep('mapping');
    }
  };

  const handleAnalyze = () => {
    if (!sheet || !mapping) return;
    try {
      const r = analyze(sheet, mapping);
      if (r.includedRows === 0) {
        setError('집계할 수 있는 줄이 없습니다. 열 매칭이 올바른지 확인해 주세요.');
        return;
      }
      setResult(r);
      setError(null);
      setStep('result');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
    }
  };

  const reset = () => {
    setSheet(null);
    setMapping(null);
    setResult(null);
    setError(null);
    setStep('upload');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>스토어 진단</h1>
        <p className="muted">주문 엑셀로 판매 상태를 한눈에 확인하세요</p>
      </header>

      <StepIndicator current={step} />

      <main>
        {step === 'upload' && <FileUpload onLoaded={handleLoaded} onSampleLoaded={handleSampleLoaded} />}

        {step === 'mapping' && sheet && mapping && (
          <ColumnMapper
            sheet={sheet}
            mapping={mapping}
            onChange={setMapping}
            onBack={reset}
            onSubmit={handleAnalyze}
            error={error}
          />
        )}

        {step === 'result' && sheet && result && (
          <div className="stack">
            <div className="result-head">
              <div>
                <h2>진단 결과</h2>
                <p className="muted small">{sheet.fileName}</p>
              </div>
              <div className="row-gap">
                <button className="btn btn-ghost" onClick={() => setStep('mapping')}>
                  열 매칭 수정
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  새 파일
                </button>
              </div>
            </div>

            <RowNotice result={result} statusMapped={mapping?.status != null} />
            <SummaryCards result={result} />
            <SalesTrendChart
              lines={result.datedLines}
              undatedRows={result.undatedRows}
              dateMapped={mapping?.orderDate != null}
            />
            <ProductRanking
              title={`매출 상위 ${result.top5.length}개`}
              products={result.top5}
              total={result.totalRevenue}
            />
            <BottomRanking result={result} />
            <ColorShareChart colors={result.colors} optionMapped={mapping?.option != null} />
          </div>
        )}
      </main>

      <footer className="app-footer muted small">
        파일은 이 브라우저 안에서만 처리되며 외부로 전송되지 않습니다.
      </footer>
    </div>
  );
}

/**
 * 하위 목록은 상위 5개와 겹치지 않는 상품만 보여 준다 (analyze에서 제외).
 * - 상품 5개 이하: 모두 상위에 들어가므로 안내 문구로 대체
 * - 6~9개: 상위 5개를 뺀 나머지만 있다는 것을 알린다
 */
function BottomRanking({ result }: { result: DiagnosisResult }) {
  const { productCount, bottom5, totalRevenue } = result;

  if (bottom5.length === 0) {
    return (
      <section className="card">
        <h3>매출 하위 상품</h3>
        <p className="muted small">
          판매된 상품이 {productCount}개라 모두 상위 목록에 들어 있습니다. 하위 목록은 상품이 6개 이상일 때
          표시됩니다.
        </p>
      </section>
    );
  }

  const partial = productCount < 10;
  return (
    <ProductRanking
      title={`매출 하위 ${bottom5.length}개`}
      note={
        partial
          ? `상품이 ${productCount}개라 상위 5개와 겹치지 않도록 나머지 ${bottom5.length}개만 보여 줍니다.`
          : undefined
      }
      products={bottom5}
      total={totalRevenue}
      tone="low"
    />
  );
}

function RowNotice({ result, statusMapped }: { result: DiagnosisResult; statusMapped: boolean }) {
  return (
    <section className="notice">
      <p>
        집계 <strong>{result.includedRows.toLocaleString('ko-KR')}줄</strong>
        {statusMapped ? (
          <>
            {' · '}취소·반품·환불 제외 <strong>{result.excludedByStatus.toLocaleString('ko-KR')}줄</strong>
          </>
        ) : (
          <span className="muted"> · 주문상태 열을 매칭하지 않아 취소·반품도 포함됐습니다</span>
        )}
        {result.skippedInvalid > 0 && (
          <>
            {' · '}값이 비어 건너뜀 <strong>{result.skippedInvalid.toLocaleString('ko-KR')}줄</strong>
          </>
        )}
      </p>
      {result.repeatedAmountSuspected && (
        <p className="warn">
          ⚠ 같은 주문의 서로 다른 상품 줄에 금액이 똑같이 반복되는 경우가 많습니다. 주문 단위 결제금액을
          고른 것은 아닌지 확인해 주세요. 줄 단위 상품금액 열이나 "판매가 × 수량" 방식을 권장합니다.
        </p>
      )}
    </section>
  );
}
