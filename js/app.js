// ===========================
// NEXT TASK — Main App
// ===========================

import { AuthService } from './services/auth.js';
import { canAccessPage, getRoleDisplayName, hasPermission } from './utils/permissions.js';
import { getInitials, getAvatarColor, showToast } from './utils/helpers.js';
import { renderLoginPage } from './pages/login.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderYTDashboardPage } from './pages/yt_dashboard.js';
import { renderFreelanceDashboardPage } from './pages/freelance_dashboard.js';
import { renderTeamPage } from './pages/team.js';
import { renderTasksPage } from './pages/tasks.js';
import { renderExpensesPage } from './pages/expenses.js';
import { renderNotificationsPage } from './pages/notifications.js';
import { renderSettingsPage } from './pages/settings.js';
import { NotificationsService } from './services/notifications.js';
import { Notifier } from './utils/notifier.js';

// App State
let currentUser = null;
let currentProfile = null;
let currentPage = 'dashboard';
let notifSubscription = null;

// ===========================
// Initialize App
// ===========================

async function initApp() {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Check auth state
  const session = await AuthService.getSession();

  if (session?.user) {
    currentUser = session.user;
    try {
      currentProfile = await AuthService.getUserProfile(session.user.id);
      
      if (currentProfile.is_confirmed) {
        renderAppShell();
        initNotificationListener();

        const params = new URLSearchParams(window.location.search);
        const urlPage = params.get('page');
        const savedPage = urlPage || sessionStorage.getItem('nextask_current_page') || 'dashboard';
        navigateTo(savedPage, true);
        if (!urlPage) {
          history.replaceState({ page: savedPage }, '', `?page=${savedPage}`);
        }
      } else {
        await AuthService.signOut();
        renderLoginPage();
        // showToast is tricky here as renderLoginPage clears app, 
        // but it will trigger onAuthStateChange(SIGNED_OUT)
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      // Profile might not exist yet, show login
      renderLoginPage();
    }
  } else {
    renderLoginPage();
  }

  // Listen for auth changes
  AuthService.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      try {
        currentProfile = await AuthService.getUserProfile(session.user.id);
      } catch (e) {
        // Wait a bit for profile creation
        await new Promise(r => setTimeout(r, 1000));
        currentProfile = await AuthService.getUserProfile(session.user.id);
      }

      if (currentProfile && currentProfile.is_confirmed) {
        // Only render app shell if not already present
        if (!document.getElementById('sidebar')) {
          renderAppShell();
          initNotificationListener();
        }

        const params = new URLSearchParams(window.location.search);
        const urlPage = params.get('page');
        const savedPage = urlPage || sessionStorage.getItem('nextask_current_page') || 'dashboard';
        navigateTo(savedPage, true);
        if (!urlPage) {
          history.replaceState({ page: savedPage }, '', `?page=${savedPage}`);
        }
      } else if (currentProfile) {
        await AuthService.signOut();
        // The SIGNED_OUT event will handle rendering login page
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      sessionStorage.removeItem('nextask_current_page');
      
      // Only render login page if we aren't already on it (prevents erasing error messages)
      const isAlreadyOnLogin = document.querySelector('.login-page');
      if (!isAlreadyOnLogin) {
        if (notifSubscription) {
          notifSubscription.unsubscribe();
          notifSubscription = null;
        }
        renderLoginPage();
      }
    }
  });

  // Custom navigation events
  window.addEventListener('navigate', (e) => {
    navigateTo(e.detail.page);
  });

  // Browser Back Button (History API)
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page) {
      navigateTo(e.state.page, true);
    } else {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page') || 'dashboard';
      navigateTo(page, true);
    }
  });

  // Quick action events
  window.addEventListener('quick-action', (e) => {
    handleQuickAction(e.detail.action);
  });
}

// ===========================
// App Shell (Sidebar + Main)
// ===========================

function renderAppShell() {
  const app = document.getElementById('app');
  const role = currentProfile?.role || 'editor';

  app.innerHTML = `
    <!-- Mobile Menu Button -->
    <button class="mobile-menu-btn" id="mobile-menu-btn">☰</button>

    <!-- Sidebar Overlay (mobile) -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">NT</div>
          <div class="sidebar-brand">
            <span class="sidebar-brand-name">NexTask</span>
            <span class="sidebar-brand-subtitle">Office Manager</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <!-- Main -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Main</div>
            <a class="sidebar-link active" data-page="dashboard">
              <span class="link-icon">📊</span>
              <span>Dashboard</span>
            </a>
          </div>

          <!-- Work -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Work</div>
            <a class="sidebar-link" data-page="yt_dashboard">
              <span class="link-icon">🎬</span>
              <span>YT Automation</span>
            </a>
            <a class="sidebar-link" data-page="office_yt">
              <span class="link-icon">🏢</span>
              <span>Office YT</span>
            </a>
            <a class="sidebar-link" data-page="freelance_dashboard">
              <span class="link-icon">💼</span>
              <span>Freelance Orders</span>
            </a>
            <a class="sidebar-link" data-page="tasks">
              <span class="link-icon">📋</span>
              <span>All Tasks</span>
            </a>
          </div>

          <!-- Management -->
          ${hasPermission(role, 'manage_team') || hasPermission(role, 'view_expenses') ? `
          <div class="sidebar-section">
            <div class="sidebar-section-label">Management</div>
            ${hasPermission(role, 'manage_team') ? `
            <a class="sidebar-link" data-page="team">
              <span class="link-icon">👥</span>
              <span>Team</span>
            </a>
            ` : ''}
            ${hasPermission(role, 'view_expenses') ? `
            <a class="sidebar-link" data-page="expenses">
              <span class="link-icon">💰</span>
              <span>Expenses</span>
            </a>
            ` : ''}
          </div>
          ` : ''}

          <!-- System -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">System</div>
            <a class="sidebar-link" data-page="notifications">
              <span class="link-icon">🔔</span>
              <span>Notifications</span>
              <span class="link-badge hidden" id="notif-badge">0</span>
            </a>
            ${hasPermission(role, 'view_settings') ? `
            <a class="sidebar-link" data-page="settings">
              <span class="link-icon">⚙️</span>
              <span>Settings</span>
            </a>
            ` : ''}
          </div>
        </nav>

        <!-- Sidebar Footer: User Info -->
        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebar-user-menu">
            <div class="sidebar-user-avatar" style="background:${getAvatarColor(currentProfile?.full_name)}">
              ${getInitials(currentProfile?.full_name)}
            </div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${currentProfile?.full_name || 'User'}</div>
              <div class="sidebar-user-role">${getRoleDisplayName(role)}</div>
            </div>
            <span style="color:var(--text-sidebar-muted);cursor:pointer;display:flex;align-items:center;transition:color 0.2s;color:#E17055;" id="logout-btn" title="Sign Out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
              </svg>
            </span>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content" id="main-content">
        <div class="loading-screen" id="page-loading">
          <div class="spinner spinner-lg"></div>
        </div>
      </main>
    </div>

    <!-- Toast Container -->
    <div class="toast-container" id="toast-container"></div>

    <!-- Modal Container -->
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal" id="modal-content"></div>
    </div>
  `;

  initAppShellEvents();
}

// ===========================
// Navigation
// ===========================

async function navigateTo(page, skipPushState = false) {
  // Check access
  if (!canAccessPage(currentProfile?.role, page)) {
    showToast('You don\'t have access to this page.', 'error');
    return;
  }

  currentPage = page;
  sessionStorage.setItem('nextask_current_page', page);

  // Update browser URL
  if (!skipPushState) {
    history.pushState({ page }, '', `?page=${page}`);
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');

  // Render page
  const mainContent = document.getElementById('main-content');

  try {
    switch (page) {
      case 'dashboard':
        await renderDashboardPage(currentProfile);
        break;
      case 'yt_dashboard':
        await renderYTDashboardPage(currentProfile, 'automation');
        break;
      case 'office_yt':
        await renderYTDashboardPage(currentProfile, 'office');
        break;
      case 'freelance_dashboard':
        await renderFreelanceDashboardPage(currentProfile);
        break;
      case 'tasks':
        await renderTasksPage(currentProfile);
        break;
      case 'orders':
        await renderFreelanceDashboardPage(currentProfile);
        break;
      case 'team':
        await renderTeamPage(currentProfile);
        break;
      case 'expenses':
        await renderExpensesPage(currentProfile);
        break;
      case 'notifications':
        await renderNotificationsPage(currentProfile);
        break;
      case 'settings':
        await renderSettingsPage(currentProfile);
        break;
      default:
        renderComingSoon('Page Not Found', '🔍', 'This page doesn\'t exist.');
    }
  } catch (error) {
    console.error(`Error rendering ${page}:`, error);
    mainContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h3>Something went wrong</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

// Placeholder for pages not yet built
function renderComingSoon(title, icon, description) {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>${icon} ${title}</h1>
          <p class="subtitle">${description}</p>
        </div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-2xl)">
        <div style="font-size:4rem;margin-bottom:var(--space-md)">${icon}</div>
        <h2 style="margin-bottom:var(--space-sm)">Coming in Phase 2+</h2>
        <p>This section will be built in upcoming phases. Dashboard is ready to use!</p>
      </div>
    </div>
  `;
}

// Quick Actions Handler
function handleQuickAction(action) {
  switch (action) {
    case 'new-task':
      navigateTo('yt_dashboard');
      break;
    case 'new-order':
      navigateTo('freelance_dashboard');
      break;
    case 'add-member':
      navigateTo('team');
      break;
    case 'add-expense':
      navigateTo('expenses');
      break;
  }
}

// ===========================
// App Shell Events
// ===========================

function initAppShellEvents() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Mobile menu toggle
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const modalOverlay = document.getElementById('modal-overlay');
      const modalContent = document.getElementById('modal-content');
      if (!modalOverlay || !modalContent) return;

      modalContent.innerHTML = `
        <div class="modal-header">
          <h2>Sign Out</h2>
          <button class="btn-icon" onclick="document.getElementById('modal-overlay').classList.remove('active')">❌</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; font-size: 1.1rem;">Are you sure you want to sign out of NexTask?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">Cancel</button>
          <button class="btn btn-danger" id="confirm-logout-btn">Yes, Sign Out</button>
        </div>
      `;

      modalOverlay.classList.add('active');

      document.getElementById('confirm-logout-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        btn.innerHTML = '<div class="spinner"></div>';
        btn.disabled = true;

        try {
          await AuthService.signOut();
          modalOverlay.classList.remove('active');
          showToast('Signed out successfully.', 'success');
        } catch (error) {
          btn.innerHTML = 'Yes, Sign Out';
          btn.disabled = false;
          showToast('Error signing out.', 'error');
        }
      });
    });
  }

  // Close modal on overlay click
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('modal-overlay')?.classList.remove('active');
    }
  });
}

// ===========================
// Start the app
// ===========================

// ===========================
// Real-time Notifications
// ===========================

function initNotificationListener() {
  if (!currentProfile || notifSubscription) return;

  notifSubscription = NotificationsService.subscribeToNewNotifications(currentProfile.id, (notif) => {
    // 1. Show Desktop Notification
    Notifier.show(notif.title, {
      body: notif.message,
      data: { url: `?page=notifications` }
    });

    // 2. Refresh Unread Badge
    updateBottomNavBadge();
    
    // 3. Refresh Notifications Page if active
    if (currentPage === 'notifications' && window.refreshNotifications) {
      window.refreshNotifications(currentProfile);
    } else if (currentPage === 'notifications') {
      renderNotificationsPage(currentProfile);
    }
    
    // 4. Show Toast
    showToast(`New Notification: ${notif.title}`, 'info');
  });

  // Initial badge update
  updateBottomNavBadge();
}

async function updateBottomNavBadge() {
  if (!currentProfile) return;
  const count = await NotificationsService.getUnreadCount(currentProfile.id);
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
