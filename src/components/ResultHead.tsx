/** 결과 화면 맨 위: 제목·파일 이름과 "열 매칭 수정 / 새 파일" 버튼 */
export default function ResultHead({
  fileName,
  onEditMapping,
  onReset,
}: {
  fileName: string;
  onEditMapping: () => void;
  onReset: () => void;
}) {
  return (
    <div className="result-head">
      <div>
        <h2>진단 결과</h2>
        <p className="muted small">{fileName}</p>
      </div>
      <div className="row-gap">
        <button className="btn btn-ghost" onClick={onEditMapping}>
          열 매칭 수정
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          새 파일
        </button>
      </div>
    </div>
  );
}
