// ===========================
// NexTask — Dashboard Page
// ===========================

import { supabase } from '../services/supabase.js';
import { canAccessPage, hasPermission } from '../utils/permissions.js';
import { formatCurrency, timeAgo, getStatusInfo, getInitials, getAvatarColor, showToast, renderIcon } from '../utils/helpers.js';
import { addSubscription } from '../app.js';
import { ChannelsService } from '../services/channels.js';
import { ProjectsService } from '../services/projects.js';
import { TasksService } from '../services/tasks.js';

import { AIService } from '../services/ai.js';
import { renderAISEOPage } from './ai_seo.js';

export async function renderDashboardPage(userProfile) {
  const mainContent = document.getElementById('main-content');
  const role = userProfile.role;

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>👋 Welcome back, ${userProfile.full_name?.split(' ')[0] || 'User'}!</h1>
          <p class="subtitle">Here's what's happening across your workspace today.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" id="toggle-theme" title="Toggle dark/light mode">
            ${renderIcon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'moon' : 'sun')}
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="dashboard-stats" id="dashboard-stats">
        <div class="stat-card purple skeleton-card clickable stagger-1" id="stat-main-tasks">
          <div class="stat-icon">${renderIcon('clipboard-list')}</div>
          <div class="stat-info">
            <div class="stat-label">Active Tasks</div>
            <div class="stat-value" id="stat-tasks">—</div>
          </div>
        </div>
        <div class="stat-card teal skeleton-card clickable stagger-2" id="stat-main-orders">
          <div class="stat-icon">${renderIcon('package')}</div>
          <div class="stat-info">
            <div class="stat-label">Active Orders</div>
            <div class="stat-value" id="stat-orders">—</div>
          </div>
        </div>
        <div class="stat-card green skeleton-card stagger-3">
          <div class="stat-icon">${renderIcon('check-circle')}</div>
          <div class="stat-info">
            <div class="stat-label">Completed</div>
            <div class="stat-value" id="stat-completed">—</div>
          </div>
        </div>
        <div class="stat-card sky skeleton-card clickable stagger-4" id="stat-main-uploaded">
          <div class="stat-icon">${renderIcon('cloud-upload')}</div>
          <div class="stat-info">
            <div class="stat-label">Uploaded / Delivered</div>
            <div class="stat-value" id="stat-uploaded">—</div>
          </div>
        </div>
        ${hasPermission(role, 'view_team_stats') ? `
        <div class="stat-card blue skeleton-card">
          <div class="stat-icon">${renderIcon('users')}</div>
          <div class="stat-info">
            <div class="stat-label">Team Members</div>
            <div class="stat-value" id="stat-team">—</div>
          </div>
        </div>
        ` : ''}
        ${hasPermission(role, 'view_expenses') ? `
        <div class="stat-card orange skeleton-card">
          <div class="stat-icon">${renderIcon('dollar-sign')}</div>
          <div class="stat-info">
            <div class="stat-label">This Month Expenses</div>
            <div class="stat-value" id="stat-expenses">—</div>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="dashboard-grid">
        <!-- Left Column: Recent Tasks -->
        <div>
          <div class="card recent-section">
            <div class="section-header">
              <h3>📋 Recent Tasks</h3>
              <span class="view-all" data-navigate="tasks">View All →</span>
            </div>
            <div id="recent-tasks-list">
              <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:60px"></div>
            </div>
          </div>

          <div class="card recent-section">
            <div class="section-header">
              <h3>📦 Recent Orders</h3>
              <span class="view-all" data-navigate="orders">View All →</span>
            </div>
            <div id="recent-orders-list">
              <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:60px"></div>
            </div>
          </div>
        </div>

        <!-- Right Column: Quick Actions & Activity -->
        <div>
          ${hasPermission(role, 'create_tasks') ? `
          <div class="card" style="margin-bottom: var(--space-lg)">
            <h3 style="margin-bottom: var(--space-md)">⚡ Quick Actions</h3>
            <div class="quick-actions">
              <button class="quick-action-btn" data-action="new-task">
                <div class="action-icon" style="background:rgba(108,92,231,0.12);color:var(--primary)">${renderIcon('plus-square')}</div>
                <span class="action-label">New Task</span>
              </button>
              <button class="quick-action-btn" data-action="new-order">
                <div class="action-icon" style="background:rgba(0,206,201,0.12);color:var(--accent)">${renderIcon('package-plus')}</div>
                <span class="action-label">New Order</span>
              </button>
              ${hasPermission(role, 'add_users') ? `
              <button class="quick-action-btn" data-action="add-member">
                <div class="action-icon" style="background:rgba(0,184,148,0.12);color:var(--success)">${renderIcon('user-plus')}</div>
                <span class="action-label">Add Member</span>
              </button>
              ` : ''}
              ${hasPermission(role, 'add_expenses') ? `
              <button class="quick-action-btn" data-action="add-expense">
                <div class="action-icon" style="background:rgba(253,203,110,0.12);color:#E17055">${renderIcon('receipt')}</div>
                <span class="action-label">Add Expense</span>
              </button>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- 🤖 NexTube AI Hub Card -->
          <div class="card ai-hub-card clickable" onclick="window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'ai_chat' } }))" style="margin-bottom: var(--space-lg); border: 2px solid var(--primary-glow); background: linear-gradient(135deg, var(--bg-card), rgba(108, 92, 231, 0.1)); cursor: pointer; transition: all 0.3s var(--apple-spring)">
            <div style="display:flex; align-items:center; gap:var(--space-md); padding:var(--space-xs)">
              <div class="ai-icon-pulse" style="filter: drop-shadow(0 0 10px var(--primary))">${renderIcon('sparkles')}</div>
              <div style="flex:1">
                <h3 style="margin-bottom: 2px">NexTube AI Assistant</h3>
                <p class="subtitle" style="margin-bottom: 0">Open full-screen chat with memory support</p>
              </div>
              <div>${renderIcon('arrow-right')}</div>
            </div>
          </div>

          <!-- Team Overview -->
          ${hasPermission(role, 'view_team_stats') ? `
          <div class="card">
            <h3 style="margin-bottom: var(--space-md)">👥 Team</h3>
            <div id="team-overview">
              <div class="skeleton" style="height:45px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:45px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:45px"></div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Load data
  await loadDashboardData(userProfile);
  initDashboardEvents();

  // Dashboard Real-time: Need to listen to MULTIPLE tables for stats!
  const taskSub = TasksService.subscribeToTasks(() => {
    console.log('Dashboard Real-time: Tasks changed');
    loadDashboardData(userProfile);
  });
  addSubscription(taskSub);

  const channelSub = ChannelsService.subscribeToChannels(() => {
    console.log('Dashboard Real-time: Channels changed');
    loadDashboardData(userProfile);
  });
  addSubscription(channelSub);

  const videoSub = ChannelsService.subscribeToVideos(null, () => {
    console.log('Dashboard Real-time: Videos changed');
    loadDashboardData(userProfile);
  });
  addSubscription(videoSub);

  const projectSub = ProjectsService.subscribeToProjects(() => {
    console.log('Dashboard Real-time: Projects changed');
    loadDashboardData(userProfile);
  });
  addSubscription(projectSub);

  const orderSub = ProjectsService.subscribeToOrders(null, () => {
    console.log('Dashboard Real-time: Orders changed');
    loadDashboardData(userProfile);
  });
  addSubscription(orderSub);
}

async function loadDashboardData(userProfile) {
  const role = userProfile.role;
  const canSeeAll = hasPermission(role, 'view_all_tasks');
  const userId = userProfile.id;

  try {
    // Fetch tasks
    let tasksQuery = supabase
      .from('tasks')
      .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(full_name)')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!canSeeAll) {
      tasksQuery = tasksQuery.eq('assigned_to', userId);
    }

    const { data: tasks } = await tasksQuery;

    // Fetch orders
    let ordersQuery = supabase
      .from('freelance_orders')
      .select('*, assigned_profile:profiles!freelance_orders_assigned_to_fkey(full_name)')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!hasPermission(role, 'view_all_orders')) {
      ordersQuery = ordersQuery.eq('assigned_to', userId);
    }

    const { data: orders } = await ordersQuery;

    // Fetch team count
    const { count: teamCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch stats
    const activeTasks = tasks?.filter(t => t.status !== 'completed').length || 0;
    const activeOrders = orders?.filter(o => !['completed', 'cancelled'].includes(o.status)).length || 0;
    const completed = (tasks?.filter(t => t.status === 'completed').length || 0) +
                      (orders?.filter(o => o.status === 'completed').length || 0);

    // Update stat cards
    document.getElementById('stat-tasks').textContent = activeTasks;
    document.getElementById('stat-orders').textContent = activeOrders;
    document.getElementById('stat-completed').textContent = completed;

    // Fetch Uploaded/Delivered counts
    const videoStatsArr = await Promise.all([
      ChannelsService.getAllVideoStats('automation'),
      ChannelsService.getAllVideoStats('office')
    ]);
    const freelanceStats = await ProjectsService.getAllOrderStats();
    
    const totalUploaded = videoStatsArr[0].uploaded + videoStatsArr[1].uploaded + freelanceStats.delivered;
    document.getElementById('stat-uploaded').textContent = totalUploaded;
    const teamStatEl = document.getElementById('stat-team');
    if (teamStatEl) teamStatEl.textContent = teamCount || 0;

    // Expenses (only for authorized roles)
    if (hasPermission(role, 'view_expenses')) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, currency')
        .gte('date', startOfMonth);

      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const expensesEl = document.getElementById('stat-expenses');
      if (expensesEl) expensesEl.textContent = formatCurrency(totalExpenses);
    }

    // Render recent tasks
    renderRecentTasks(tasks || []);

    // Render recent orders
    renderRecentOrders(orders || []);

    // Render team overview
    const { data: teamMembers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(6);

    renderTeamOverview(teamMembers || []);
    if (window.lucide) window.lucide.createIcons();

  } catch (error) {
    console.error('Dashboard data error:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recent-tasks-list');
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${renderIcon('clipboard')}</div>
        <h3>No tasks yet</h3>
        <p>Create your first task to get started!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const status = getStatusInfo(task.status);
    return `
      <div class="task-item">
        <div class="task-priority ${task.priority || 'medium'}"></div>
        <div class="task-details">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="badge ${status.class}">${status.icon} ${status.label}</span>
            <span>·</span>
            <span>${task.assigned_profile?.full_name || 'Unassigned'}</span>
            <span>·</span>
            <span>${timeAgo(task.created_at)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentOrders(orders) {
  const container = document.getElementById('recent-orders-list');
  if (!container) return;
  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${renderIcon('package')}</div>
        <h3>No orders yet</h3>
        <p>Add your first freelance order!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const status = getStatusInfo(order.status);
    const platformBadge = {
      fiverr: `<span class="platform-dot" style="background:#1dbf73"></span> Fiverr`,
      upwork: `<span class="platform-dot" style="background:#37a000"></span> Upwork`,
      direct: `<span class="platform-dot" style="background:#0984e3"></span> Direct`
    };
    return `
      <div class="task-item">
        <div class="task-priority ${order.status === 'new' ? 'high' : 'medium'}"></div>
        <div class="task-details">
          <div class="task-title">${order.title || order.client_name}</div>
          <div class="task-meta">
            <span class="badge ${status.class}">${status.icon} ${status.label}</span>
            <span>·</span>
            <span>${platformBadge[order.platform] || order.platform}</span>
            <span>·</span>
            <span>${formatCurrency(order.amount, order.currency || 'PKR')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTeamOverview(members) {
  const container = document.getElementById('team-overview');
  if (!container) return;
  if (!members.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-sm)">No team members yet.</p>';
    return;
  }

  container.innerHTML = members.map(member => `
    <div style="display:flex;align-items:center;gap:var(--space-md);padding:8px 0;border-bottom:1px solid var(--border-light)">
      <div class="avatar" style="background:${getAvatarColor(member.full_name)}">${getInitials(member.full_name)}</div>
      <div style="flex:1">
        <div style="font-size:var(--font-sm);font-weight:500">${member.full_name}</div>
        <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:capitalize">${member.role} ${member.is_remote ? `· ${renderIcon('globe', 'avatar-icon')} Remote` : `· ${renderIcon('building', 'avatar-icon')} Office`}</div>
      </div>
    </div>
  `).join('');
}

function initDashboardEvents() {
  // View All links
  document.querySelectorAll('[data-navigate]').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.navigate;
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }));
    });
  });

  // Stat Cards Clicks
  document.getElementById('stat-main-tasks')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'tasks' } }));
  });
  document.getElementById('stat-main-orders')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'orders' } }));
  });
  document.getElementById('stat-main-uploaded')?.addEventListener('click', () => {
    // Navigate to YT automation section by default for uploaded
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'yt_dashboard' } }));
  });

  // Quick action buttons
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      window.dispatchEvent(new CustomEvent('quick-action', { detail: { action } }));
    });
  });

  // Theme toggle
  const themeBtn = document.getElementById('toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      themeBtn.innerHTML = renderIcon(newTheme === 'dark' ? 'moon' : 'sun');
      localStorage.setItem('theme', newTheme);
    });
  }
}
