// ===========================
// NexTask — Freelance Dashboard (Project → Order)
// ===========================

import { ProjectsService } from '../services/projects.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { formatCurrency, getInitials, getAvatarColor, showToast, sanitize, timeAgo, formatDate, debounce, showConfirmModal } from '../utils/helpers.js';
import { addSubscription, clearSubscriptions } from '../app.js';

let allProjects = [];
let allOrders = [];
let teamMembers = [];
let currentProject = null;
let moduleUserProfile = null; // New global reference

const ORDER_STATUSES = {
  new:         { label: 'New',        icon: '🆕', class: 'badge-info' },
  in_progress: { label: 'In Progress',icon: '🔄', class: 'badge-warning' },
  delivered:   { label: 'Delivered',  icon: '📦', class: 'badge-primary' },
  completed:   { label: 'Completed', icon: '✅', class: 'badge-success' },
  revision:    { label: 'Revision',   icon: '🔁', class: 'badge-warning' },
  cancelled:   { label: 'Cancelled', icon: '❌', class: 'badge-danger' },
  done:        { label: 'Done',      icon: '✅', class: 'badge-success' }
};

const PLATFORM_INFO = {
  fiverr: { label: 'Fiverr', icon: '🟢', class: 'platform-fiverr' },
  upwork: { label: 'Upwork', icon: '🟩', class: 'platform-upwork' },
  direct: { label: 'Direct', icon: '🔵', class: 'platform-direct' }
};

export async function renderFreelanceDashboardPage(userProfile) {
  moduleUserProfile = userProfile;
  currentProject = null;
  teamMembers = await TeamService.getMemberOptions();
  await renderProjectsList(userProfile);
}

// ===========================
// PROJECTS LIST VIEW
// ===========================

async function renderProjectsList(userProfile) {
  clearSubscriptions();
  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_projects');

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>💼 Freelance Orders</h1>
          <p class="subtitle">Manage Fiverr, Upwork & direct client projects</p>
        </div>
        ${canCreate ? `<button class="btn btn-primary" id="btn-new-project">+ New Project</button>` : ''}
      </div>

      <!-- Stats -->
      <div class="dashboard-stats">
        <div class="stat-card purple clickable" id="stat-fl-projects">
          <div class="stat-icon">📁</div>
          <div class="stat-info">
            <div class="stat-label">Projects</div>
            <div class="stat-value" id="fl-projects-count">—</div>
          </div>
        </div>
        <div class="stat-card blue clickable" id="stat-fl-total">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value" id="fl-orders-count">—</div>
          </div>
        </div>
        <div class="stat-card orange clickable" id="stat-fl-active">
          <div class="stat-icon">🔄</div>
          <div class="stat-info">
            <div class="stat-label">Active</div>
            <div class="stat-value" id="fl-active">—</div>
          </div>
        </div>
        <div class="stat-card green clickable" id="stat-fl-revenue">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-label">Revenue</div>
            <div class="stat-value" id="fl-revenue">—</div>
          </div>
        </div>
        <div class="stat-card pink clickable" id="stat-fl-unassigned">
          <div class="stat-icon">👤</div>
          <div class="stat-info">
            <div class="stat-label">Unassigned</div>
            <div class="stat-value" id="fl-unassigned">—</div>
          </div>
        </div>
        <div class="stat-card indigo clickable" id="stat-fl-assigned">
          <div class="stat-icon">🔄</div>
          <div class="stat-info">
            <div class="stat-label">Assigned</div>
            <div class="stat-value" id="fl-assigned">—</div>
          </div>
        </div>
        <div class="stat-card teal clickable" id="stat-fl-done">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-label">Done Orders</div>
            <div class="stat-value" id="fl-done">—</div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="project-search" placeholder="Search projects..." />
        </div>
        <div class="filter-chips">
          <button class="filter-chip active" data-plat="all">All</button>
          <button class="filter-chip" data-plat="fiverr">🟢 Fiverr</button>
          <button class="filter-chip" data-plat="upwork">🟩 Upwork</button>
          <button class="filter-chip" data-plat="direct">🔵 Direct</button>
        </div>
      </div>

      <!-- Projects Grid -->
      <div class="project-grid" id="projects-grid">
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    <!-- Project Modal -->
    <div class="modal-overlay" id="project-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2 id="project-modal-title">New Freelance Project</h2>
          <button class="modal-close" id="project-modal-close">✕</button>
        </div>
        <form id="project-form">
          <div class="form-group">
            <label class="form-label">Project Name *</label>
            <input type="text" class="form-input" id="proj-name" placeholder="e.g., Branding Package for XYZ" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Platform *</label>
              <select class="form-select" id="proj-platform" required>
                <option value="fiverr">🟢 Fiverr</option>
                <option value="upwork">🟩 Upwork</option>
                <option value="direct">🔵 Direct</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Client Name</label>
              <input type="text" class="form-input" id="proj-client" placeholder="Client name" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-md)">
            <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="proj-public" style="width:18px;height:18px" />
              <span>Show to Team</span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="proj-desc" placeholder="Project notes..." style="min-height:60px"></textarea>
          </div>
          <input type="hidden" id="proj-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="project-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="proj-btn-text">Create Project</span>
              <div class="spinner hidden" id="proj-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadProjectsData(userProfile);
  initProjectEvents(userProfile);

  // Real-time subscription for projects
  const projectSub = ProjectsService.subscribeToProjects(() => {
    console.log('Real-time update: Projects list changed');
    const flStats = document.getElementById('fl-stats');
    if (flStats) loadProjectsData(userProfile);
  });
  addSubscription(projectSub);
}

async function loadProjectsData(userProfile, platformFilter = 'all', search = '') {
  try {
    allProjects = await ProjectsService.getProjects({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      search: search || undefined
    });
    const stats = await ProjectsService.getAllOrderStats();

    document.getElementById('fl-projects-count').textContent = allProjects.length;
    document.getElementById('fl-orders-count').textContent = stats.total;
    document.getElementById('fl-active').textContent = stats.new + stats.in_progress + stats.revision;
    document.getElementById('fl-revenue').textContent = formatCurrency(stats.totalRevenue);
    document.getElementById('fl-unassigned').textContent = stats.unassigned;
    document.getElementById('fl-assigned').textContent = stats.assigned;
    document.getElementById('fl-done').textContent = stats.done;

    renderProjectsGrid(allProjects, userProfile);
  } catch (err) {
    console.error('Projects error:', err);
    showToast('Failed to load projects', 'error');
  }
}

async function renderProjectsGrid(projects, userProfile) {
  const grid = document.getElementById('projects-grid');
  const canEdit = hasPermission(userProfile.role, 'edit_projects');
  const canDelete = hasPermission(userProfile.role, 'delete_projects');

  if (!projects.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">💼</div>
        <h3>No projects yet</h3>
        <p>Create your first freelance project to start tracking orders!</p>
      </div>
    `;
    return;
  }

  // Get order counts and archive info for each project
  const countsPromises = projects.map(p => ProjectsService.getProjectOrderCount(p.id));
  const archivePromises = projects.map(p => ProjectsService.getArchivedOrderDates(p.id));
  const [counts, archives] = await Promise.all([
    Promise.all(countsPromises),
    Promise.all(archivePromises)
  ]);

  grid.innerHTML = projects.map((proj, i) => {
    const plat = PLATFORM_INFO[proj.platform] || PLATFORM_INFO.direct;
    return `
      <div class="project-card" data-project-id="${proj.id}">
        <div class="project-card-actions">
          ${canEdit ? `<button class="btn btn-ghost btn-sm" data-edit-project="${proj.id}">✏️</button>` : ''}
          ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-project="${proj.id}">🗑️</button>` : ''}
        </div>
        <div class="project-card-header">
          ${counts[i].total > 0 && counts[i].total === counts[i].done ? `<div class="completion-badge clickable" data-open-status="done">✅ DONE</div>` : ''}
          <div class="project-card-icon" style="background:rgba(${proj.platform === 'fiverr' ? '27,190,66' : proj.platform === 'upwork' ? '20,163,0' : '116,185,255'},0.15)">
            ${plat.icon}
          </div>
          <div>
            <div class="project-card-title">${sanitize(proj.name)}</div>
            <div class="project-card-subtitle">
              <span class="badge ${plat.class}" style="font-size:10px">${plat.label}</span>
              ${proj.client_name ? ` · ${sanitize(proj.client_name)}` : ''}
            </div>
          </div>
        </div>
        ${proj.description ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md)">${sanitize(proj.description).slice(0, 80)}</p>` : ''}
        <div class="project-card-stats">
          <div class="project-card-stat"><strong>${counts[i].total}</strong> Active</div>
          ${archives[i].length > 0 ? `<div class="project-card-stat clickable" data-open-history="${proj.id}" style="color:var(--primary);cursor:pointer">📜 <strong>${archives[i].length}</strong> History Folders</div>` : ''}
          <div class="project-card-stat">Created ${timeAgo(proj.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Click project card → open orders view
  grid.querySelectorAll('[data-project-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      // Check for status badge clicks
      const statusBadge = e.target.closest('[data-open-status]');
      if (statusBadge) {
        e.stopPropagation();
        openProjectOrders(card.dataset.projectId, userProfile, statusBadge.dataset.openStatus);
        return;
      }

      if (e.target.closest('[data-edit-project]') || e.target.closest('[data-delete-project]')) return;
      openProjectOrders(card.dataset.projectId, userProfile);
    });
  });

  grid.querySelectorAll('[data-edit-project]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); editProject(btn.dataset.editProject); });
  });
  grid.querySelectorAll('[data-delete-project]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteProject(btn.dataset.deleteProject, userProfile); });
  });
}

function initProjectEvents(userProfile) {
  document.getElementById('btn-new-project')?.addEventListener('click', () => openNewProject());

  document.querySelectorAll('[data-plat]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-plat]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const search = document.getElementById('project-search')?.value || '';
      loadProjectsData(userProfile, chip.dataset.plat, search);
    });
  });

  document.getElementById('project-search')?.addEventListener('input', debounce((e) => {
    const platform = document.querySelector('[data-plat].active')?.dataset.plat || 'all';
    loadProjectsData(userProfile, platform, e.target.value);
  }, 300));

  document.getElementById('project-modal-close')?.addEventListener('click', () => closeModal('project-modal-overlay'));
  document.getElementById('project-cancel')?.addEventListener('click', () => closeModal('project-modal-overlay'));
  document.getElementById('project-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'project-modal-overlay') closeModal('project-modal-overlay');
  });

  document.getElementById('project-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProject(userProfile);
  });

  // Global Stats Click
  document.getElementById('stat-fl-projects')?.addEventListener('click', () => {
    document.getElementById('projects-grid')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('stat-fl-total')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'all'));
  document.getElementById('stat-fl-active')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'active'));
  document.getElementById('stat-fl-revenue')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'done'));
  document.getElementById('stat-fl-unassigned')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'unassigned'));
  document.getElementById('stat-fl-assigned')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'assigned'));
  document.getElementById('stat-fl-done')?.addEventListener('click', () => renderGlobalOrders(userProfile, 'done'));
}

function openNewProject() {
  document.getElementById('project-modal-title').textContent = 'New Freelance Project';
  document.getElementById('proj-btn-text').textContent = 'Create Project';
  document.getElementById('proj-edit-id').value = '';
  document.getElementById('project-form').reset();
  document.getElementById('project-modal-overlay').classList.add('active');
}

function editProject(projectId) {
  const p = allProjects.find(x => x.id === projectId);
  if (!p) return;
  document.getElementById('project-modal-title').textContent = 'Edit Project';
  document.getElementById('proj-btn-text').textContent = 'Save Changes';
  document.getElementById('proj-edit-id').value = projectId;
  document.getElementById('proj-name').value = p.name;
  document.getElementById('proj-platform').value = p.platform;
  document.getElementById('proj-client').value = p.client_name || '';
  document.getElementById('proj-desc').value = p.description || '';
  document.getElementById('proj-public').checked = !!p.is_public;
  document.getElementById('project-modal-overlay').classList.add('active');
}

async function saveProject(userProfile) {
  const editId = document.getElementById('proj-edit-id').value;
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { showToast('Project name is required', 'warning'); return; }

  const btnText = document.getElementById('proj-btn-text');
  const spinner = document.getElementById('proj-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const data = {
      name,
      platform: document.getElementById('proj-platform').value,
      client_name: document.getElementById('proj-client').value.trim() || null,
      description: document.getElementById('proj-desc').value.trim() || null,
      is_public: document.getElementById('proj-public').checked
    };

    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); spinner.classList.add('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    if (editId) {
      await ProjectsService.updateProject(editId, data);
      showToast('Project updated! ✅', 'success');
    } else {
      data.created_by = userProfile.id;
      await ProjectsService.createProject(data);
      showToast('Project created! 🎉', 'success');
    }
    
    clearTimeout(safetyTimeout);
    closeModal('project-modal-overlay');
    await loadProjectsData(userProfile);
  } catch (err) { 
    console.error('Save Project Error:', err);
    showToast('Failed: ' + err.message, 'error'); 
  }
  finally { btnText.classList.remove('hidden'); spinner.classList.add('hidden'); }
}

async function deleteProject(projectId, userProfile) {
  const confirmed = await showConfirmModal('Delete Project', 'Delete this project and ALL its orders? This cannot be undone.');
  if (!confirmed) return;

  try {
    await ProjectsService.deleteProject(projectId);
    showToast('Project deleted', 'success');
    await loadProjectsData(userProfile);
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
}

// ===========================
// ORDERS VIEW (inside a project)
// ===========================

async function openProjectOrders(projectId, userProfile, initialStatus = 'all') {
  clearSubscriptions();
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  currentProject = project;
  const plat = PLATFORM_INFO[project.platform] || PLATFORM_INFO.direct;

  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_orders');

  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-projects">← Back to Projects</button>

      <div class="page-header">
        <div>
          <h1>${plat.icon} ${sanitize(project.name)}</h1>
          <p class="subtitle">${project.client_name ? `Client: ${sanitize(project.client_name)} · ` : ''}<span class="badge ${plat.class}">${plat.label}</span></p>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn-ghost" id="btn-fl-history">📜 Daily History</button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-new-order">+ Add Order</button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="order-search" placeholder="Search orders..." />
        </div>
        <div class="filter-chips">
          <button class="filter-chip active" data-ostatus="all">All</button>
          <button class="filter-chip" data-ostatus="new">🆕 New</button>
          <button class="filter-chip" data-ostatus="delivered">📦 Delivered</button>
          <button class="filter-chip" data-ostatus="completed">✅ Completed</button>
          <button class="filter-chip" data-ostatus="done">✅ Done</button>
          <button class="filter-chip" data-ostatus="revision">🔁 Revision</button>
        </div>
      </div>

      <!-- Orders List -->
      <div id="orders-list">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    <!-- Order Modal -->
    <div class="modal-overlay" id="order-modal-overlay">
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <h2 id="order-modal-title">Add Order</h2>
          <button class="modal-close" id="order-modal-close">✕</button>
        </div>
        <form id="order-form">
          <div class="form-group">
            <label class="form-label">Order Title *</label>
            <input type="text" class="form-input" id="ord-title" placeholder="e.g., Logo Design v2" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">📝 Brief / Requirements Link</label>
              <input type="url" class="form-input" id="ord-brief" placeholder="Google Docs / Notion link" />
            </div>
            <div class="form-group">
              <label class="form-label">🎨 Design Files Link</label>
              <input type="url" class="form-input" id="ord-design" placeholder="Figma / Drive link" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">📦 Deliverable Link</label>
            <input type="url" class="form-input" id="ord-deliverable" placeholder="Final deliverable link" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Amount</label>
              <input type="number" class="form-input" id="ord-amount" placeholder="0" min="0" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-select" id="ord-currency">
                <option value="PKR">PKR (₨)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Assign To</label>
              <select class="form-select" id="ord-assign"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input type="date" class="form-input" id="ord-deadline" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="ord-status">
              <option value="new">🆕 New</option>
              <option value="in_progress">🔄 In Progress</option>
              <option value="delivered">📦 Delivered</option>
              <option value="completed">✅ Completed</option>
              <option value="done">✅ Done</option>
              <option value="revision">🔁 Revision</option>
              <option value="cancelled">❌ Cancelled</option>
            </select>
          </div>
          <input type="hidden" id="ord-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="order-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="ord-btn-text">Add Order</span>
              <div class="spinner hidden" id="ord-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadOrdersData(userProfile, initialStatus);
  initOrderEvents(userProfile);

  // Real-time subscription for orders in this project
  const orderSub = ProjectsService.subscribeToOrders(projectId, () => {
    console.log(`Real-time update: Orders for project ${projectId} changed`);
    const activeStatus = document.querySelector('[data-ostatus].active')?.dataset.ostatus || 'all';
    const search = document.getElementById('order-search')?.value || '';
    loadOrdersData(userProfile, activeStatus, search);
  });
  addSubscription(orderSub);

  // If initialStatus is not 'all', manually activate the chip
  if (initialStatus !== 'all') {
    document.querySelectorAll('[data-ostatus]').forEach(c => {
      c.classList.toggle('active', c.dataset.ostatus === initialStatus);
    });
  }
}

async function loadOrdersData(userProfile, statusFilter = 'all', search = '') {
  try {
    allOrders = await ProjectsService.getOrders(currentProject.id, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined
    });
    renderOrdersList(allOrders, userProfile);
  } catch (err) {
    console.error('Orders error:', err);
    showToast('Failed to load orders', 'error');
  }
}

function renderOrdersList(orders, userProfile) {
  const container = document.getElementById('orders-list');
  if (!container) return; // View changed
  const canEdit = hasPermission(userProfile.role, 'edit_orders');
  const canDelete = hasPermission(userProfile.role, 'delete_orders');

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No orders yet</h3>
        <p>Add your first order to this project!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const st = ORDER_STATUSES[ord.status] || ORDER_STATUSES.new;
    const assignee = ord.assigned_profile;
    
    // Per-item edit permission: Admins+ OR the assigned user
    const canEditItem = canEdit || ord.assigned_to === userProfile.id;
    
    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div class="item-card-title">${sanitize(ord.title)}</div>
            <div class="item-card-meta">
              <span class="badge ${st.class}">${st.icon} ${st.label}</span>
              <span style="font-weight:600">${formatCurrency(ord.amount, ord.currency || 'PKR')}</span>
              ${assignee ? `
                <span style="display:flex;align-items:center;gap:4px">
                  <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px">${getInitials(assignee.full_name)}</span>
                  ${assignee.full_name}
                </span>
              ` : ''}
              ${ord.deadline ? `<span>⏰ ${formatDate(ord.deadline)}</span>` : ''}
              <span>📅 ${timeAgo(ord.created_at)}</span>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            ${canEditItem ? `<button class="btn btn-ghost btn-sm" data-edit-order="${ord.id}">✏️</button>` : ''}
            ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-order="${ord.id}">🗑️</button>` : ''}
          </div>
        </div>
        <div class="link-fields-grid">
          ${renderLinkField('📝', 'Brief', ord.brief_link)}
          ${renderLinkField('🎨', 'Design', ord.design_link)}
          ${renderLinkField('📦', 'Deliverable', ord.deliverable_link)}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-order]').forEach(btn => {
    btn.addEventListener('click', () => editOrder(btn.dataset.editOrder));
  });
  container.querySelectorAll('[data-delete-order]').forEach(btn => {
    btn.addEventListener('click', () => deleteOrder(btn.dataset.deleteOrder, userProfile));
  });
}

function renderLinkField(icon, label, url) {
  return `
    <div class="link-field">
      <span class="link-field-icon">${icon}</span>
      <span class="link-field-label">${label}:</span>
      ${url ? `<a class="link-field-value" href="${sanitize(url)}" target="_blank" rel="noopener">${shortenUrl(url)}</a>` : `<span class="link-field-empty">Not added</span>`}
    </div>
  `;
}

function shortenUrl(url) {
  try { const u = new URL(url); return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname); }
  catch { return url.slice(0, 30) + '…'; }
}

function initOrderEvents(userProfile) {
  document.getElementById('btn-back-projects')?.addEventListener('click', () => renderProjectsList(userProfile));
  document.getElementById('btn-new-order')?.addEventListener('click', () => openNewOrder());

  document.querySelectorAll('[data-ostatus]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-ostatus]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const search = document.getElementById('order-search')?.value || '';
      loadOrdersData(userProfile, chip.dataset.ostatus, search);
    });
  });

  document.getElementById('order-search')?.addEventListener('input', debounce((e) => {
    const activeStatus = document.querySelector('[data-ostatus].active')?.dataset.ostatus || 'all';
    loadOrdersData(userProfile, activeStatus, e.target.value);
  }, 300));

  document.getElementById('order-modal-close')?.addEventListener('click', () => closeModal('order-modal-overlay'));
  document.getElementById('order-cancel')?.addEventListener('click', () => closeModal('order-modal-overlay'));
  document.getElementById('order-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'order-modal-overlay') closeModal('order-modal-overlay');
  });

  document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveOrder(userProfile);
  });

  document.getElementById('btn-fl-history')?.addEventListener('click', () => {
    openDailyHistory(currentProject.id, userProfile);
  });
}

function openNewOrder() {
  document.getElementById('order-modal-title').textContent = 'Add Order';
  document.getElementById('ord-btn-text').textContent = 'Add Order';
  document.getElementById('ord-edit-id').value = '';
  document.getElementById('order-form').reset();
  populateAssignDropdown('ord-assign');
  document.getElementById('order-modal-overlay').classList.add('active');
}

function editOrder(orderId) {
  const ord = allOrders.find(o => o.id === orderId);
  if (!ord) return;
  document.getElementById('order-modal-title').textContent = 'Edit Order';
  document.getElementById('ord-btn-text').textContent = 'Save Changes';
  document.getElementById('ord-edit-id').value = orderId;
  document.getElementById('ord-title').value = ord.title;
  document.getElementById('ord-brief').value = ord.brief_link || '';
  document.getElementById('ord-design').value = ord.design_link || '';
  document.getElementById('ord-deliverable').value = ord.deliverable_link || '';
  document.getElementById('ord-amount').value = ord.amount || '';
  document.getElementById('ord-currency').value = ord.currency || 'PKR';
  document.getElementById('ord-status').value = ord.status;
  document.getElementById('ord-deadline').value = ord.deadline ? ord.deadline.split('T')[0] : '';
  populateAssignDropdown('ord-assign', ord.assigned_to);
  document.getElementById('order-modal-overlay').classList.add('active');
}

function populateAssignDropdown(selectId, selectedId = '') {
  const select = document.getElementById(selectId);
  select.innerHTML = `<option value="">— Unassigned —</option>` +
    teamMembers.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.full_name} (${m.role})</option>`).join('');
}

async function saveOrder(userProfile) {
  const editId = document.getElementById('ord-edit-id').value;
  const title = document.getElementById('ord-title').value.trim();
  if (!title) { showToast('Order title is required', 'warning'); return; }

  const btnText = document.getElementById('ord-btn-text');
  const spinner = document.getElementById('ord-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const data = {
      title,
      brief_link: document.getElementById('ord-brief').value.trim() || null,
      design_link: document.getElementById('ord-design').value.trim() || null,
      deliverable_link: document.getElementById('ord-deliverable').value.trim() || null,
      amount: parseFloat(document.getElementById('ord-amount').value) || 0,
      currency: document.getElementById('ord-currency').value,
      assigned_to: document.getElementById('ord-assign').value || null,
      status: document.getElementById('ord-status').value,
      deadline: document.getElementById('ord-deadline').value || null
    };

    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); spinner.classList.remove('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    if (editId) {
      await ProjectsService.updateOrder(editId, data);
      showToast('Order updated! ✅', 'success');
    } else {
      data.project_id = currentProject.id;
      data.created_by = userProfile.id;
      await ProjectsService.createOrder(data);
      showToast('Order created! 🎉', 'success');
    }
    
    clearTimeout(safetyTimeout);
    closeModal('order-modal-overlay');
    await loadOrdersData(userProfile);
  } catch (err) { 
    console.error('Save Order Error:', err);
    showToast('Failed: ' + err.message, 'error'); 
  }
  finally { btnText.classList.remove('hidden'); spinner.classList.add('hidden'); }
}

async function deleteOrder(orderId, userProfile) {
  const confirmed = await showConfirmModal('Delete Order', 'Are you sure you want to delete this order?');
  if (!confirmed) return;

  try {
    await ProjectsService.deleteOrder(orderId);
    showToast('Order deleted', 'success');
    await loadOrdersData(userProfile);
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ===========================
// GLOBAL ORDERS VIEW (Flat List)
// ===========================

async function renderGlobalOrders(userProfile, filterType) {
  clearSubscriptions();
  currentProject = null;
  const mainContent = document.getElementById('main-content');
  
  const titles = {
    unassigned: '📂 Unassigned Orders',
    assigned: '🔄 Assigned Active Orders',
    done: '✅ Done Orders'
  };

  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-projects">← Back to Projects</button>

      <div class="page-header">
        <div>
          <h1>${titles[filterType] || 'All Orders'}</h1>
          <p class="subtitle">Global list of orders across all projects</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="global-order-search" placeholder="Search across all projects..." />
        </div>
      </div>

      <!-- Orders List -->
      <div id="global-orders-list">
        <div class="skeleton" style="height:120px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:120px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-projects')?.addEventListener('click', () => renderProjectsList(userProfile));
  
  const searchInput = document.getElementById('global-order-search');
  searchInput?.addEventListener('input', debounce(() => {
    loadGlobalOrdersData(userProfile, filterType, searchInput.value);
  }, 300));

  await loadGlobalOrdersData(userProfile, filterType);

  // Real-time for global list: Listen to all orders
  const globalOrderSub = ProjectsService.subscribeToOrders(null, () => {
    console.log('Real-time update: Global Orders list changed');
    const search = document.getElementById('global-order-search')?.value || '';
    loadGlobalOrdersData(userProfile, filterType, search);
  });
  addSubscription(globalOrderSub);
}

async function loadGlobalOrdersData(userProfile, filterType, search = '') {
  const container = document.getElementById('global-orders-list');
  try {
    const options = { search };
    if (filterType === 'unassigned') options.unassigned = true;
    if (filterType === 'assigned') options.unassigned = false;
    // If filter is 'done', we fetch all and filter in JS to get both completed and done

    let orders = await ProjectsService.getOrders(null, options);

    // Manual filtering for complex buckets
    if (filterType === 'active') {
      orders = orders.filter(o => ['new', 'in_progress', 'revision'].includes(o.status));
    }
    if (filterType === 'assigned') {
      orders = orders.filter(o => o.status !== 'completed' && o.status !== 'done' && o.status !== 'cancelled');
    }
    if (filterType === 'done') {
      orders = orders.filter(o => o.status === 'completed' || o.status === 'done');
    }

    renderGlobalOrdersGrid(orders, userProfile, container);
  } catch (err) {
    console.error('Global orders error:', err);
    showToast('Failed to load global orders', 'error');
  }
}

function renderGlobalOrdersGrid(orders, userProfile, container) {
  if (!container) return; // View changed
  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No orders found</h3>
        <p>Try a different search or filter!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const st = ORDER_STATUSES[ord.status] || ORDER_STATUSES.new;
    const assignee = ord.assigned_profile;
    const projectName = ord.freelance_projects?.name || 'Unknown Project';
    
    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div style="font-size:var(--font-xs);color:var(--primary);font-weight:600;margin-bottom:4px">📁 ${sanitize(projectName)}</div>
            <div class="item-card-title">${sanitize(ord.title)}</div>
            <div class="item-card-meta">
              <span class="badge ${st.class}">${st.icon} ${st.label}</span>
              <span style="font-weight:600">${formatCurrency(ord.amount, ord.currency || 'PKR')}</span>
              ${assignee ? `
                <span style="display:flex;align-items:center;gap:4px">
                  <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px;background-image:url(${assignee.avatar_url || ''});background-size:cover">${assignee.avatar_url ? '' : getInitials(assignee.full_name)}</span>
                  ${assignee.full_name}
                </span>
              ` : '<span style="color:var(--text-danger)">⚠️ Unassigned</span>'}
              <span>📅 ${timeAgo(ord.created_at)}</span>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.openProjectOrdersGlobal('${ord.project_id}')">👁️ View Project</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Helper to bridge global list to project view
window.openProjectOrdersGlobal = async (projectId) => {
  if (!moduleUserProfile) {
    showToast('Session error, please refresh', 'error');
    return;
  }
  
  await openProjectOrders(projectId, moduleUserProfile);
  showToast('Project opened', 'success');
};
// ===========================
// DAILY HISTORY EXPLORER
// ===========================

async function openDailyHistory(projectId, userProfile) {
  clearSubscriptions();
  const mainContent = document.getElementById('main-content');
  const plat = PLATFORM_INFO[currentProject.platform] || PLATFORM_INFO.direct;
  
  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-to-project">← Back to Project</button>
      
      <div class="page-header">
        <div>
          <h1>📜 Project History</h1>
          <p class="subtitle">Orders archived for ${sanitize(currentProject.name)} (Older than 24h)</p>
        </div>
      </div>

      <div id="history-content" class="fade-in">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-to-project').addEventListener('click', () => {
    openProjectOrders(projectId, userProfile);
  });

  await loadHistoryDates(projectId, userProfile);
}

async function loadHistoryDates(projectId, userProfile) {
  const container = document.getElementById('history-content');
  try {
    const dates = await ProjectsService.getArchivedOrderDates(projectId);
    
    if (!dates.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>The archives are empty</h3>
          <p>Orders move here automatically after 24 hours.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="project-grid">
        ${dates.map(date => `
          <div class="project-card clickable" data-history-date="${date}">
            <div class="project-card-header">
              <div class="project-card-icon">📁</div>
              <div>
                <div class="project-card-title">${formatDate(date)}</div>
                <div class="project-card-subtitle">Archives from this day</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-history-date]').forEach(card => {
      card.addEventListener('click', () => {
        renderHistoricalOrdersView(projectId, card.dataset.historyDate, userProfile);
      });
    });

  } catch (err) {
    console.error('History dates error:', err);
    showToast('Failed to load history', 'error');
  }
}

async function renderHistoricalOrdersView(projectId, date, userProfile) {
  const container = document.getElementById('history-content');
  
  container.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-to-history" style="margin-bottom:var(--space-md)">← Back to Dates</button>
      <div class="section-header" style="margin-bottom:var(--space-md)">
        <h2>Orders from ${formatDate(date)}</h2>
      </div>
      <div id="historical-orders-list">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-to-history').addEventListener('click', () => {
    loadHistoryDates(projectId, userProfile);
  });

  try {
    const orders = await ProjectsService.getOrders(projectId, { includeArchived: true });
    // Filter for the specific date (YYYY-MM-DD match)
    const dailyOrders = orders.filter(o => o.created_at.startsWith(date));
    
    const listContainer = document.getElementById('historical-orders-list');
    
    if (!dailyOrders.length) {
      listContainer.innerHTML = `<p class="text-muted">No orders found for this date.</p>`;
      return;
    }

    listContainer.innerHTML = dailyOrders.map(ord => {
      const st = ORDER_STATUSES[ord.status] || ORDER_STATUSES.new;
      const assignee = ord.assigned_profile;
      
      return `
        <div class="item-card">
          <div class="item-card-header">
            <div>
              <div class="item-card-title">${sanitize(ord.title)}</div>
              <div class="item-card-meta">
                <span class="badge ${st.class}">${st.icon} ${st.label}</span>
                ${assignee ? `
                  <span style="display:flex;align-items:center;gap:4px">
                    <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px">${getInitials(assignee.full_name)}</span>
                    ${assignee.full_name}
                  </span>
                ` : ''}
                <span>📅 Created ${timeAgo(ord.created_at)}</span>
              </div>
            </div>
            <div style="font-weight:600;color:var(--text-main)">$${ord.amount || 0}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Historical orders error:', err);
    showToast('Failed to load historical orders', 'error');
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
