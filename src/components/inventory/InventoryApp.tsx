import { useState } from 'react';
import { guessInventoryMapping } from '../../lib/guessMapping';
import { buildInventory } from '../../lib/inventory';
import type { InventoryBuildResult, InventoryMapping, ParsedSheet } from '../../types';
import FileUpload from '../FileUpload';
import ResultHead from '../ResultHead';
import StepIndicator, { type Step } from '../StepIndicator';
import InventoryMapper from './InventoryMapper';
import InventoryResult from './InventoryResult';

/** 재고 진단: 판매·재고 표 → 열 매칭 → 옵션별 판정 */
export default function InventoryApp() {
  const [step, setStep] = useState<Step>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<InventoryMapping | null>(null);
  const [built, setBuilt] = useState<InventoryBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (s: ParsedSheet, m: InventoryMapping): boolean => {
    try {
      const r = buildInventory(s, m);
      if (r.items.length === 0) {
        setError('판정할 수 있는 줄이 없습니다. 판매량·재고 열이 숫자인지, 열 매칭이 맞는지 확인해 주세요.');
        return false;
      }
      setBuilt(r);
      setError(null);
      setStep('result');
      window.scrollTo({ top: 0 });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
      return false;
    }
  };

  const handleLoaded = (parsed: ParsedSheet) => {
    setSheet(parsed);
    setMapping(guessInventoryMapping(parsed.headers));
    setBuilt(null);
    setError(null);
    setStep('mapping');
  };

  const handleSampleLoaded = (parsed: ParsedSheet) => {
    const guessed = guessInventoryMapping(parsed.headers);
    setSheet(parsed);
    setMapping(guessed);
    if (!run(parsed, guessed)) setStep('mapping');
  };

  const reset = () => {
    setSheet(null);
    setMapping(null);
    setBuilt(null);
    setError(null);
    setStep('upload');
  };

  return (
    <>
      <StepIndicator current={step} />

      {step === 'upload' && (
        <FileUpload
          onLoaded={handleLoaded}
          onSampleLoaded={handleSampleLoaded}
          fileLabel="판매·재고 표"
          sampleFile="sample-inventory.csv"
          sampleCaption="가상의 의류 쇼핑몰 옵션 25개(재고 음수 3개 포함)로 판정 결과를 바로 볼 수 있어요."
        />
      )}

      {step === 'mapping' && sheet && mapping && (
        <InventoryMapper
          sheet={sheet}
          mapping={mapping}
          onChange={setMapping}
          onBack={reset}
          onSubmit={() => run(sheet, mapping)}
          error={error}
        />
      )}

      {step === 'result' && sheet && built && (
        <div className="stack">
          <ResultHead fileName={sheet.fileName} onEditMapping={() => setStep('mapping')} onReset={reset} />
          <InventoryResult built={built} locationMapped={mapping?.location != null} sourceFile={sheet.fileName} />
        </div>
      )}
    </>
  );
}
