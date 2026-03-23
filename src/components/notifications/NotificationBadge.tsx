interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export default function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <span className={`absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-error rounded-full ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}
