import { useRef, useState } from 'react';
import { parseFile } from '../lib/parseFile';
import type { ParsedSheet } from '../types';

const ACCEPT = '.xlsx,.xls,.csv';

interface Props {
  onLoaded: (sheet: ParsedSheet) => void;
  /** 샘플은 열 매칭을 건너뛰고 바로 결과까지 보여 준다. */
  onSampleLoaded: (sheet: ParsedSheet) => void;
  /** 안내 문구에 쓰는 파일 이름 (예: "주문 엑셀", "판매·재고 표") */
  fileLabel: string;
  /** public/ 아래 샘플 파일 이름 */
  sampleFile: string;
  sampleCaption: string;
}

export default function FileUpload({ onLoaded, onSampleLoaded, fileLabel, sampleFile, sampleCaption }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('xlsx, xls, csv 파일만 올릴 수 있습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sheet = await parseFile(file);
      if (sheet.headers.length === 0 || sheet.rows.length === 0) {
        setError(`파일에서 데이터를 찾지 못했습니다. 첫 번째 시트에 ${fileLabel} 내용이 있는지 확인해 주세요.`);
        return;
      }
      onLoaded(sheet);
    } catch {
      setError('파일을 읽지 못했습니다. 암호가 걸려 있거나 손상된 파일일 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${sampleFile}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      onSampleLoaded(await parseFile(new File([blob], sampleFile, { type: 'text/csv' })));
    } catch {
      setError('샘플 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card stack">
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="dropzone-icon" aria-hidden>
          📄
        </div>
        <p className="dropzone-title">{loading ? '파일을 읽는 중…' : `${fileLabel} 파일을 선택하거나 끌어다 놓으세요`}</p>
        <p className="muted small">xlsx · xls · csv (EUC-KR 인코딩 CSV도 지원)</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="privacy">
        <strong>🔒 파일은 외부로 전송되지 않습니다.</strong>
        <span className="muted small">모든 분석은 지금 보고 계신 브라우저 안에서만 이루어집니다.</span>
      </div>

      <div className="sample-cta">
        <button className="btn btn-primary" onClick={loadSample} disabled={loading}>
          샘플 데이터로 체험하기
        </button>
        <p className="muted small">{sampleCaption}</p>
      </div>
    </section>
  );
}
