import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { useNotificationStore, type NotificationKind } from '../store/notificationStore';

const iconFor: Record<NotificationKind, typeof AlertCircle> = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

export function Notifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  if (!notifications.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((notification) => {
        const Icon = iconFor[notification.kind];
        return (
          <div key={notification.id} className="rounded-lg border border-line bg-panel p-3 shadow-soft">
            <div className="flex gap-3">
              <Icon className={notification.kind === 'error' ? 'text-red-300' : 'text-accent'} size={18} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{notification.title}</div>
                <div className="mt-1 text-xs leading-5 text-muted">{notification.message}</div>
                {notification.details && (
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer text-ink/80">Technical details</summary>
                    <div className="mt-1 rounded border border-line bg-surface p-2 font-mono text-[11px] leading-4">{notification.details}</div>
                  </details>
                )}
              </div>
              <button className="h-7 w-7 rounded-md text-muted hover:bg-white/5 hover:text-ink" type="button" onClick={() => dismiss(notification.id)} title="Dismiss">
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
