// 네비게이션바·설정·관리자 공용 계정 이미지 (사진 없으면 첫 글자 배지)
interface AvatarProps {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly photo?: string | undefined;
  readonly size?: number;
}

export function Avatar({ name, email, photo, size = 38 }: AvatarProps) {
  const label = name && name.length > 0 ? name : email && email.length > 0 ? email : '나';
  const initial = label.slice(0, 1).toUpperCase();
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (photo && photo.length > 0) {
    return (
      <img
        src={photo}
        alt={label}
        className="avatar"
        style={{ ...dim, objectFit: 'cover' }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return <div className="avatar" style={dim}>{initial}</div>;
}
