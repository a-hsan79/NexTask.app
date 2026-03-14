// ===========================
// NexTask — Notifications Page
// ===========================

import { NotificationsService } from '../services/notifications.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { showToast, timeAgo, sanitize } from '../utils/helpers.js';

let allNotifications = [];

const NOTIF_ICONS = {
  task:     '📋',
  order:    '📦',
  expense:  '💰',
  system:   '🔔',
  reminder: '⏰'
};

export async function renderNotificationsPage(userProfile) {
  const mainContent = document.getElementById('main-content');
  const isAdmin = ['owner', 'admin'].includes(userProfile.role);

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>🔔 Notifications</h1>
          <p class="subtitle">Stay updated on tasks, orders, and team activity</p>
        </div>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn-secondary" id="btn-mark-all-read">✓ Mark All Read</button>
          ${isAdmin ? `<button class="btn btn-primary" id="btn-send-notif">📣 Send Notification</button>` : ''}
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="filter-bar">
        <div class="filter-chips">
          <button class="filter-chip active" data-nfilter="all">All</button>
          <button class="filter-chip" data-nfilter="unread">🔵 Unread</button>
          <button class="filter-chip" data-nfilter="task">📋 Tasks</button>
          <button class="filter-chip" data-nfilter="order">📦 Orders</button>
          <button class="filter-chip" data-nfilter="system">🔔 System</button>
          <button class="filter-chip" data-nfilter="reminder">⏰ Reminders</button>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-clear-all" style="color:var(--text-muted)">🗑️ Clear All</button>
      </div>

      <!-- Notifications List -->
      <div id="notifications-list">
        <div class="skeleton" style="height:80px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:80px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    <!-- Send Notification Modal (Admin only) -->
    <div class="modal-overlay" id="notif-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>📣 Send Notification</h2>
          <button class="modal-close" id="notif-modal-close">✕</button>
        </div>
        <form id="notif-form">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="notif-title" placeholder="e.g., Team Meeting at 3 PM" required />
          </div>
          <div class="form-group">
            <label class="form-label">Message *</label>
            <textarea class="form-textarea" id="notif-message" placeholder="Write your notification message..." required style="min-height:80px"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" id="notif-type">
                <option value="system">🔔 System</option>
                <option value="task">📋 Task Update</option>
                <option value="order">📦 Order Update</option>
                <option value="expense">💰 Expense</option>
                <option value="reminder">⏰ Reminder</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Send To</label>
              <select class="form-select" id="notif-target">
                <option value="all">📢 Everyone</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="notif-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="notif-btn-text">Send</span>
              <div class="spinner hidden" id="notif-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadNotifications(userProfile);
  initNotifEvents(userProfile);
}

async function loadNotifications(userProfile, filter = 'all') {
  try {
    const unreadOnly = filter === 'unread';
    let notifications = await NotificationsService.getNotifications(userProfile.id, { unreadOnly });

    // Filter by type if needed
    if (filter !== 'all' && filter !== 'unread') {
      notifications = notifications.filter(n => n.type === filter);
    }

    allNotifications = notifications;
    renderNotificationsList(notifications, userProfile);

    // Update sidebar badge
    const unreadCount = await NotificationsService.getUnreadCount(userProfile.id);
    updateBadge(unreadCount);
  } catch (err) {
    console.error('Notifications error:', err);
    renderNotificationsList([], userProfile);
  }
}

function renderNotificationsList(notifications, userProfile) {
  const container = document.getElementById('notifications-list');

  if (!notifications.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔔</div>
        <h3>No notifications</h3>
        <p>You're all caught up! Notifications about tasks, orders, and team activity will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(n => {
    const icon = NOTIF_ICONS[n.type] || '🔔';
    const unreadClass = n.is_read ? '' : 'notif-unread';
    return `
      <div class="item-card ${unreadClass}" data-notif-id="${n.id}" style="cursor:pointer;${!n.is_read ? 'border-left:3px solid var(--primary);' : ''}">
        <div class="item-card-header" style="align-items:flex-start">
          <div style="display:flex;gap:var(--space-md);align-items:flex-start">
            <div style="font-size:1.5rem;flex-shrink:0;margin-top:2px">${icon}</div>
            <div>
              <div class="item-card-title" style="font-size:var(--font-sm)">${sanitize(n.title)}</div>
              <p style="font-size:var(--font-xs);color:var(--text-secondary);margin-top:4px;line-height:1.5">${sanitize(n.message)}</p>
              <div class="item-card-meta" style="margin-top:6px">
                <span>${timeAgo(n.created_at)}</span>
                ${!n.is_read ? '<span class="badge badge-primary" style="font-size:9px">NEW</span>' : ''}
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" data-delete-notif="${n.id}" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Click to mark as read
  container.querySelectorAll('[data-notif-id]').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('[data-delete-notif]')) return;
      const notifId = card.dataset.notifId;
      const notif = allNotifications.find(n => n.id === notifId);
      if (notif && !notif.is_read) {
        await NotificationsService.markAsRead(notifId);
        notif.is_read = true;
        card.classList.remove('notif-unread');
        card.style.borderLeft = '';
        card.querySelector('.badge-primary')?.remove();
        const unreadCount = await NotificationsService.getUnreadCount(userProfile.id);
        updateBadge(unreadCount);
      }
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-delete-notif]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await NotificationsService.deleteNotification(btn.dataset.deleteNotif);
        const activeFilter = document.querySelector('[data-nfilter].active')?.dataset.nfilter || 'all';
        await loadNotifications(userProfile, activeFilter);
        showToast('Notification deleted', 'success');
      } catch (err) { showToast('Failed to delete', 'error'); }
    });
  });
}

function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

function initNotifEvents(userProfile) {
  // Filter chips
  document.querySelectorAll('[data-nfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-nfilter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadNotifications(userProfile, chip.dataset.nfilter);
    });
  });

  // Mark all read
  document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
    try {
      await NotificationsService.markAllAsRead(userProfile.id);
      showToast('All marked as read ✅', 'success');
      const activeFilter = document.querySelector('[data-nfilter].active')?.dataset.nfilter || 'all';
      await loadNotifications(userProfile, activeFilter);
    } catch (err) { showToast('Failed', 'error'); }
  });

  // Clear all
  document.getElementById('btn-clear-all')?.addEventListener('click', async () => {
    if (!confirm('Clear all notifications? This cannot be undone.')) return;
    try {
      await NotificationsService.clearAll(userProfile.id);
      showToast('All notifications cleared', 'success');
      await loadNotifications(userProfile);
    } catch (err) { showToast('Failed', 'error'); }
  });

  // Send notification modal
  document.getElementById('btn-send-notif')?.addEventListener('click', async () => {
    await populateTargetDropdown(userProfile);
    document.getElementById('notif-form').reset();
    document.getElementById('notif-modal-overlay').classList.add('active');
  });

  document.getElementById('notif-modal-close')?.addEventListener('click', () => {
    document.getElementById('notif-modal-overlay').classList.remove('active');
  });
  document.getElementById('notif-cancel')?.addEventListener('click', () => {
    document.getElementById('notif-modal-overlay').classList.remove('active');
  });
  document.getElementById('notif-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'notif-modal-overlay') e.target.classList.remove('active');
  });

  // Submit form
  document.getElementById('notif-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendNotification(userProfile);
  });
}

async function populateTargetDropdown(userProfile) {
  const select = document.getElementById('notif-target');
  try {
    const members = await TeamService.getMemberOptions();
    select.innerHTML = `<option value="all">📢 Everyone</option>` +
      members.map(m => `<option value="${m.id}">${m.full_name} (${m.role})</option>`).join('');
  } catch { /* keep default */ }
}

async function sendNotification(userProfile) {
  const title = document.getElementById('notif-title').value.trim();
  const message = document.getElementById('notif-message').value.trim();
  const type = document.getElementById('notif-type').value;
  const target = document.getElementById('notif-target').value;

  if (!title || !message) { showToast('Title and message required', 'warning'); return; }

  const btnText = document.getElementById('notif-btn-text');
  const spinner = document.getElementById('notif-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    if (target === 'all') {
      const members = await TeamService.getMemberOptions();
      await NotificationsService.notifyAll(members, { title, message, type });
      showToast(`Notification sent to ${members.length} members! 📣`, 'success');
    } else {
      await NotificationsService.createNotification({ userId: target, title, message, type });
      showToast('Notification sent! 📣', 'success');
    }
    document.getElementById('notif-modal-overlay').classList.remove('active');
    await loadNotifications(userProfile);
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  finally { btnText.classList.remove('hidden'); spinner.classList.add('hidden'); }
}

