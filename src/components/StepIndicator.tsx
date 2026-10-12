const STEPS = [
  { key: 'upload', label: '파일 업로드' },
  { key: 'mapping', label: '열 매칭' },
  { key: 'result', label: '진단 결과' },
] as const;

export default function StepIndicator({ current }: { current: (typeof STEPS)[number]['key'] }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="steps" aria-label="진행 단계">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={i === currentIdx ? 'is-current' : i < currentIdx ? 'is-done' : ''}
          aria-current={i === currentIdx ? 'step' : undefined}
        >
          <span className="step-num">{i < currentIdx ? '✓' : i + 1}</span>
          <span className="step-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
