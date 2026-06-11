// 로그인 화면과 통일된 인라인 돌아가기 버튼
export interface BackButtonProps {
  readonly onClick: () => void;
  readonly label?: string;
  readonly className?: string;
}

export function BackButton({ onClick, label = '돌아가기', className = '' }: BackButtonProps) {
  return (
    <button className={`page-back ${className}`} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
