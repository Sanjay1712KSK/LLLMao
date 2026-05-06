import { create } from 'zustand';

export type NotificationKind = 'error' | 'info' | 'success';

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  details?: string;
};

type NotificationState = {
  notifications: Notification[];
  notify: (notification: Omit<Notification, 'id'>) => void;
  dismiss: (id: string) => void;
};

const notificationId = () => `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  notify: (notification) => {
    const id = notificationId();
    set((state) => ({ notifications: [{ ...notification, id }, ...state.notifications].slice(0, 4) }));
    window.setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) }));
    }, notification.kind === 'error' ? 7000 : 4200);
  },
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
}));
