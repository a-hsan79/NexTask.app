// ===========================
// NexTask — Dashboard Page
// ===========================

import { supabase } from '../services/supabase.js';
import { canAccessPage, hasPermission } from '../utils/permissions.js';
import { formatCurrency, timeAgo, getStatusInfo, getInitials, getAvatarColor, showToast } from '../utils/helpers.js';
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
            🌙
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="dashboard-stats" id="dashboard-stats">
        <div class="stat-card purple skeleton-card clickable stagger-1" id="stat-main-tasks">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-label">Active Tasks</div>
            <div class="stat-value" id="stat-tasks">—</div>
          </div>
        </div>
        <div class="stat-card teal skeleton-card clickable stagger-2" id="stat-main-orders">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <div class="stat-label">Active Orders</div>
            <div class="stat-value" id="stat-orders">—</div>
          </div>
        </div>
        <div class="stat-card green skeleton-card stagger-3">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-label">Completed</div>
            <div class="stat-value" id="stat-completed">—</div>
          </div>
        </div>
        <div class="stat-card sky skeleton-card clickable stagger-4" id="stat-main-uploaded">
          <div class="stat-icon">☁️</div>
          <div class="stat-info">
            <div class="stat-label">Uploaded / Delivered</div>
            <div class="stat-value" id="stat-uploaded">—</div>
          </div>
        </div>
        ${hasPermission(role, 'view_team_stats') ? `
        <div class="stat-card blue skeleton-card">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-label">Team Members</div>
            <div class="stat-value" id="stat-team">—</div>
          </div>
        </div>
        ` : ''}
        ${hasPermission(role, 'view_expenses') ? `
        <div class="stat-card orange skeleton-card">
          <div class="stat-icon">💰</div>
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
                <div class="action-icon" style="background:rgba(108,92,231,0.12);color:var(--primary)">📋</div>
                <span class="action-label">New Task</span>
              </button>
              <button class="quick-action-btn" data-action="new-order">
                <div class="action-icon" style="background:rgba(0,206,201,0.12);color:var(--accent)">📦</div>
                <span class="action-label">New Order</span>
              </button>
              ${hasPermission(role, 'add_users') ? `
              <button class="quick-action-btn" data-action="add-member">
                <div class="action-icon" style="background:rgba(0,184,148,0.12);color:var(--success)">👤</div>
                <span class="action-label">Add Member</span>
              </button>
              ` : ''}
              ${hasPermission(role, 'add_expenses') ? `
              <button class="quick-action-btn" data-action="add-expense">
                <div class="action-icon" style="background:rgba(253,203,110,0.12);color:#E17055">💰</div>
                <span class="action-label">Add Expense</span>
              </button>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- 🤖 Quick AI Assistant Card -->
          <div class="card ai-assistant-card" style="margin-bottom: var(--space-lg); border: 1px solid var(--primary-glow)">
            <h3 style="margin-bottom: var(--space-sm); display:flex; align-items:center; gap:8px">🤖 NexTube AI Assistant</h3>
            <p class="subtitle" style="margin-bottom: var(--space-md)">Generate titles or a 300-word description instantly.</p>
            
            <div class="ai-chat-box">
              <div style="position:relative; margin-bottom:12px">
                <textarea id="dash-ai-input" class="form-textarea" placeholder="Describe your video topic..." style="min-height:80px; padding-left:40px"></textarea>
                <button class="btn-icon" id="dash-ai-attach" style="position:absolute; left:10px; top:10px; opacity:0.6; background:transparent; border:none; cursor:pointer" title="Attach file">📎</button>
                <input type="file" id="dash-ai-file" class="hidden" accept="image/*,application/pdf" />
              </div>
              
              <div id="dash-ai-preview" class="hidden" style="margin-bottom:12px"></div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                <button class="btn btn-secondary btn-sm" id="btn-dash-ai-titles">🔥 Get Titles</button>
                <button class="btn btn-secondary btn-sm" id="btn-dash-ai-desc">📝 Full Description</button>
              </div>
            </div>

            <div id="dash-ai-results" class="hidden" style="margin-top:15px; padding-top:15px; border-top:1px solid var(--border-light)">
              <div class="ai-text-content" style="font-size:var(--font-xs); max-height:200px; overflow-y:auto; background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md)"></div>
              <button class="btn btn-ghost btn-sm" id="btn-dash-ai-copy" style="width:100%; margin-top:8px">📋 Copy Result</button>
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
        <div class="empty-icon">📋</div>
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
        <div class="empty-icon">📦</div>
        <h3>No orders yet</h3>
        <p>Add your first freelance order!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const status = getStatusInfo(order.status);
    const platformBadge = {
      fiverr: '🟢 Fiverr',
      upwork: '🟩 Upwork',
      direct: '🔵 Direct'
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
        <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:capitalize">${member.role} ${member.is_remote ? '· 🌍 Remote' : '· 🏢 Office'}</div>
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
      html.setAttribute('data-theme', isDark ? 'light' : 'dark');
      themeBtn.textContent = isDark ? '🌙' : '☀️';
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });
  }

  // Dashboard AI Assistant Logic
  const dashAIInput = document.getElementById('dash-ai-input');
  const dashAIFile = document.getElementById('dash-ai-file');
  const dashAIAttach = document.getElementById('dash-ai-attach');
  const dashAIPreview = document.getElementById('dash-ai-preview');
  const dashAIResults = document.getElementById('dash-ai-results');
  const dashAIContent = dashAIResults?.querySelector('.ai-text-content');
  
  let dashAttachments = [];

  dashAIAttach?.addEventListener('click', () => dashAIFile.click());

  dashAIFile?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const base64 = re.target.result;
        dashAttachments = [base64];
        dashAIPreview.innerHTML = `
          <div class="attachment-card" style="display:inline-flex; align-items:center; gap:5px; background:var(--bg-input); padding:4px 8px; border-radius:4px; font-size:10px">
            <span>📎 ${file.name}</span>
            <span style="color:var(--danger); cursor:pointer" id="dash-ai-remove-file">×</span>
          </div>
        `;
        dashAIPreview.classList.remove('hidden');
        document.getElementById('dash-ai-remove-file').onclick = () => {
          dashAttachments = [];
          dashAIPreview.classList.add('hidden');
          dashAIFile.value = '';
        };
      };
      reader.readAsDataURL(file);
    }
  });

  const runDashboardAI = async (mode) => {
    const prompt = dashAIInput.value.trim();
    if (!prompt && dashAttachments.length === 0) {
      showToast('Please provide a topic or file', 'warning');
      return;
    }

    dashAIResults.classList.remove('hidden');
    dashAIContent.innerHTML = '<div class="spinner spinner-sm"></div> Performing AI Magic...';

    try {
      let finalPrompt = "";
      if (mode === 'titles') {
        finalPrompt = `Generate 5 High-CTR YouTube titles for: ${prompt}. Wrap each in [TITLE] tags.`;
      } else {
        finalPrompt = `Act as an expert YouTube SEO agent. Write a 300-word detailed video description for: ${prompt}. Use the 5-part format (Summary, 3 Highlights, Social, Disclaimer, 10 Tags).`;
      }

      const result = await AIService.callModel(finalPrompt, dashAttachments);
      dashAIContent.innerHTML = formatAIResult(result);
      dashAIResults.dataset.raw = result;
    } catch (err) {
      showToast(err.message, 'error');
      dashAIContent.innerHTML = 'Error: ' + err.message;
    }
  };

  document.getElementById('btn-dash-ai-titles')?.addEventListener('click', () => runDashboardAI('titles'));
  document.getElementById('btn-dash-ai-desc')?.addEventListener('click', () => runDashboardAI('desc'));

  document.getElementById('btn-dash-ai-copy')?.addEventListener('click', () => {
    const raw = dashAIResults.dataset.raw;
    if (raw) {
      navigator.clipboard.writeText(raw);
      showToast('Result copied!', 'success');
    }
  });
}

function formatAIResult(text) {
  // Simple cleanup of tags for the preview
  return text.replace(/\[\/?TITLE\]/g, '').replace(/\[\/?DESC\]/g, '').replace(/\[\/?TAGS\]/g, '').trim();
}
