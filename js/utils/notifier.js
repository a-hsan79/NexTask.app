// ===========================
// NexTask — Browser Notifier
// ===========================

export const Notifier = {
  // Request permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Show notification
  show(title, options = {}) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Default icon
    if (!options.icon) {
      options.icon = '/favicon.ico'; // Fallback to favicon
    }

    // Default tag for grouping if needed
    if (!options.tag) {
      options.tag = 'nextask-notif';
    }

    try {
      return new Notification(title, options);
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  }
};
