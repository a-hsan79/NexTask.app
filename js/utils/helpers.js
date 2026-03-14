// ===========================
// NEXT TASK — Helper Utilities
// ===========================

// Format date to readable string
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format date to relative time (e.g., "2 hours ago")
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'min', seconds: 60 }
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

// Format currency
export function formatCurrency(amount, currency = 'PKR') {
  if (!amount) return '0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Get initials from name (e.g., "John Doe" → "JD")
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate random avatar color based on name
export function getAvatarColor(name) {
  const colors = [
    '#6C5CE7', '#00CEC9', '#E17055', '#00B894',
    '#FDCB6E', '#74B9FF', '#A29BFE', '#55EFC4',
    '#FD79A8', '#636E72'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Show toast notification
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getToastIcon(type)}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getToastIcon(type) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return icons[type] || icons.info;
}

// Debounce function for search inputs
export function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Sanitize HTML to prevent XSS
export function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Status display info
export function getStatusInfo(status) {
  const statuses = {
    pending: { label: 'Pending', class: 'badge-neutral', icon: '⏳' },
    in_progress: { label: 'In Progress', class: 'badge-info', icon: '🔄' },
    review: { label: 'In Review', class: 'badge-warning', icon: '👀' },
    completed: { label: 'Completed', class: 'badge-success', icon: '✅' },
    new: { label: 'New', class: 'badge-primary', icon: '🆕' },
    delivered: { label: 'Delivered', class: 'badge-info', icon: '📦' },
    cancelled: { label: 'Cancelled', class: 'badge-danger', icon: '❌' }
  };
  return statuses[status] || { label: status, class: 'badge-neutral', icon: '📋' };
}

// Priority display info
export function getPriorityInfo(priority) {
  const priorities = {
    low: { label: 'Low', class: 'badge-success', color: 'green' },
    medium: { label: 'Medium', class: 'badge-warning', color: 'orange' },
    high: { label: 'High', class: 'badge-danger', color: 'red' },
    urgent: { label: 'Urgent', class: 'badge-danger', color: 'red' }
  };
  return priorities[priority] || priorities.medium;
}
