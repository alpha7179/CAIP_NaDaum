// 나다움 로고 이미지 컴포넌트
export interface LogoImgProps {
  readonly height?: number;
  readonly className?: string;
}

export function LogoImg({ height = 36, className = '' }: LogoImgProps) {
  return (
    <img
      src="/logo.png"
      alt="나다움 로고"
      height={height}
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
      className={className}
    />
  );
}
