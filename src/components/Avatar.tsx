import VerifiedStamp from './VerifiedStamp';

interface AvatarProps {
  emoji: string;
  size?: number;
  verified?: boolean;
}

export default function Avatar({ emoji, size = 40, verified = false }: AvatarProps) {
  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div
        className="avatar"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden="true"
      >
        {emoji}
      </div>
      {verified && (
        <span className="avatar__verified" aria-label="Verified seller">
          <VerifiedStamp size={Math.max(14, Math.round(size * 0.34))} />
        </span>
      )}
    </div>
  );
}
