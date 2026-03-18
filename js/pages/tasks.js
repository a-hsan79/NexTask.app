import { TasksService } from '../services/tasks.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { getInitials, getAvatarColor, showToast, sanitize, timeAgo, formatDate, debounce, showConfirmModal } from '../utils/helpers.js';
import { addSubscription } from '../app.js';

let allTasks = [];
let teamMembers = [];

const TASK_STATUSES = {
  pending:     { label: 'Pending',     icon: '⏳', class: 'badge-info' },
  in_progress: { label: 'In Progress', icon: '🔄', class: 'badge-warning' },
  review:      { label: 'In Review',   icon: '👁️', class: 'badge-primary' },
  completed:   { label: 'Completed',   icon: '✅', class: 'badge-success' },
  done:        { label: 'Done',        icon: '✅', class: 'badge-success' }
};

const PRIORITY_INFO = {
  low:    { label: 'Low',    icon: '🔵', class: 'priority-low' },
  medium: { label: 'Medium', icon: '🟡', class: 'priority-medium' },
  high:   { label: 'High',   icon: '🔴', class: 'priority-high' }
};

export async function renderTasksPage(userProfile) {
  teamMembers = await TeamService.getMemberOptions();
  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_tasks');

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>📋 General Tasks</h1>
          <p class="subtitle">Manage general office tasks and assignments</p>
        </div>
        ${canCreate ? `<button class="btn btn-primary" id="btn-new-task">+ New Task</button>` : ''}
      </div>

      <!-- Stats -->
      <div class="dashboard-stats">
        <div class="stat-card blue">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-label">Total Tasks</div>
            <div class="stat-value" id="tasks-count-total">—</div>
          </div>
        </div>
        <div class="stat-card orange clickable" data-tfilter="active">
          <div class="stat-icon">🔄</div>
          <div class="stat-info">
            <div class="stat-label">In Progress</div>
            <div class="stat-value" id="tasks-count-active">—</div>
          </div>
        </div>
        <div class="stat-card pink clickable" data-tfilter="unassigned">
          <div class="stat-icon">👤</div>
          <div class="stat-info">
            <div class="stat-label">Unassigned</div>
            <div class="stat-value" id="tasks-count-unassigned">—</div>
          </div>
        </div>
        <div class="stat-card indigo clickable" data-tfilter="assigned">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-label">Assigned</div>
            <div class="stat-value" id="tasks-count-assigned">—</div>
          </div>
        </div>
        <div class="stat-card teal clickable" data-tfilter="done">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-label">Done Tasks</div>
            <div class="stat-value" id="tasks-count-done">—</div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="task-search" placeholder="Search tasks..." />
        </div>
        <div class="filter-chips">
          <button class="filter-chip active" data-status="all">All</button>
          <button class="filter-chip" data-status="pending">⏳ Pending</button>
          <button class="filter-chip" data-status="in_progress">🔄 Active</button>
          <button class="filter-chip" data-status="completed">✅ Completed</button>
          <button class="filter-chip" data-status="done">✅ Done</button>
        </div>
      </div>

      <!-- Tasks List -->
      <div id="tasks-list" class="items-list">
        <div class="loading-placeholder">Loading tasks...</div>
      </div>
    </div>

    <!-- Task Modal -->
    <div class="modal-overlay" id="task-modal-overlay">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2 id="task-modal-title">New Task</h2>
          <button class="modal-close" id="task-modal-close">✕</button>
        </div>
        <form id="task-form">
          <div class="form-group">
            <label class="form-label">Task Title *</label>
            <input type="text" class="form-input" id="task-title" placeholder="e.g., Update office supplies" required />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="task-desc" placeholder="Details..." style="min-height:80px"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-select" id="task-priority">
                <option value="low">🔵 Low</option>
                <option value="medium" selected>🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="task-status">
                <option value="pending">⏳ Pending</option>
                <option value="in_progress">🔄 In Progress</option>
                <option value="review">👁️ In Review</option>
                <option value="completed">✅ Completed</option>
                <option value="done">✅ Done</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Assign To</label>
              <select class="form-select" id="task-assign"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input type="date" class="form-input" id="task-due" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">🔗 Result / Work Link</label>
            <input type="url" class="form-input" id="task-result" placeholder="Link to completed work..." />
          </div>
          <input type="hidden" id="task-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="task-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="task-btn-text">Create Task</span>
              <div class="spinner hidden" id="task-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadTasksData(userProfile);
  initTaskEvents(userProfile);

  // Real-time subscription for tasks
  const taskSub = TasksService.subscribeToTasks(() => {
    console.log('Real-time update: Tasks changed');
    const activeStatus = document.querySelector('[data-status].active')?.dataset.status || 'all';
    const search = document.getElementById('task-search')?.value || '';
    loadTasksData(userProfile, activeStatus, search);
  });
  addSubscription(taskSub);
}

async function loadTasksData(userProfile, statusFilter = 'all', search = '') {
  try {
    const stats = await TasksService.getTaskStats();
    allTasks = await TasksService.getTasks({
      status: statusFilter,
      search: search
    });

    // Handle special dashboard filters (Unassigned, Assigned, Done)
    if (statusFilter === 'unassigned') {
      allTasks = allTasks.filter(t => !t.assigned_to);
    } else if (statusFilter === 'assigned') {
      allTasks = allTasks.filter(t => t.assigned_to && t.status !== 'completed' && t.status !== 'done');
    } else if (statusFilter === 'done') {
      allTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'done');
    }
    
    document.getElementById('tasks-count-total').textContent = stats.total;
    document.getElementById('tasks-count-active').textContent = stats.active;
    document.getElementById('tasks-count-unassigned').textContent = stats.unassigned;
    document.getElementById('tasks-count-assigned').textContent = stats.assigned;
    document.getElementById('tasks-count-done').textContent = stats.done;

    renderTasksList(allTasks, userProfile);
  } catch (err) {
    console.error('Tasks error:', err);
    showToast('Failed to load tasks', 'error');
  }
}

function renderTasksList(tasks, userProfile) {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  const canEdit = hasPermission(userProfile.role, 'edit_any_task');
  const canDelete = hasPermission(userProfile.role, 'delete_tasks');

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No tasks found</h3>
        <p>Try changing your filters or create a new task!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map((task, i) => {
    const st = TASK_STATUSES[task.status] || TASK_STATUSES.pending;
    const prio = PRIORITY_INFO[task.priority] || PRIORITY_INFO.medium;
    const assignee = task.assigned_profile;
    
    // Per-item edit permission: Admins+ OR the assigned user
    const canEditItem = canEdit || task.assigned_to === userProfile.id;
    
    return `
      <div class="item-card fade-in stagger-${Math.min(i + 1, 5)}">
        <div class="item-card-header">
          <div style="flex:1">
            <div class="item-card-title">${sanitize(task.title)}</div>
            <div class="item-card-meta">
              <span class="badge ${st.class}">${st.icon} ${st.label}</span>
              <span class="priority-tag ${prio.class}">${prio.icon} ${prio.label}</span>
              ${assignee ? `
                <span class="member-tag">
                  <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:18px;height:18px;font-size:8px">${getInitials(assignee.full_name)}</span>
                  ${assignee.full_name}
                </span>
              ` : ''}
              ${task.due_date ? `<span>⏰ ${formatDate(task.due_date)}</span>` : ''}
              <span>📅 ${timeAgo(task.created_at)}</span>
            </div>
          </div>
          <div class="item-card-actions">
            ${canEditItem ? `<button class="btn btn-ghost btn-sm" data-edit-task="${task.id}">✏️</button>` : ''}
            ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-task="${task.id}">🗑️</button>` : ''}
          </div>
        </div>
        ${task.description ? `<p class="item-card-desc">${sanitize(task.description)}</p>` : ''}
        ${task.result_link ? `
          <div style="margin-top:var(--space-sm);padding-top:var(--space-sm);border-top:1px dashed var(--border-color)">
            <a href="${sanitize(task.result_link)}" target="_blank" class="btn btn-ghost btn-sm" style="color:var(--primary);font-size:var(--font-xs)">🔗 View Result / Work ↗</a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-task]').forEach(btn => {
    btn.addEventListener('click', () => editTask(btn.dataset.editTask));
  });
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.deleteTask, userProfile));
  });
}

function initTaskEvents(userProfile) {
  document.getElementById('btn-new-task')?.addEventListener('click', () => openNewTask());

  document.querySelectorAll('[data-status]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const search = document.getElementById('task-search')?.value || '';
      loadTasksData(userProfile, chip.dataset.status, search);
    });
  });

  document.getElementById('task-search')?.addEventListener('input', debounce((e) => {
    const status = document.querySelector('[data-status].active')?.dataset.status || 'all';
    loadTasksData(userProfile, status, e.target.value);
  }, 300));

  // Stat Card Filtering
  document.querySelectorAll('[data-tfilter]').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.tfilter;
      // Sync with status chips if possible, or just load
      loadTasksData(userProfile, filter);
      // Optional: Update chip active state
      document.querySelectorAll('[data-status]').forEach(c => c.classList.remove('active'));
      if (filter === 'done') document.querySelector('[data-status="completed"]')?.classList.add('active');
      else if (['pending', 'in_progress', 'completed'].includes(filter)) {
        document.querySelector(`[data-status="${filter}"]`)?.classList.add('active');
      }
    });
  });

  document.getElementById('task-modal-close')?.addEventListener('click', () => closeModal());
  document.getElementById('task-cancel')?.addEventListener('click', () => closeModal());
  
  document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTask(userProfile);
  });
}

function openNewTask() {
  document.getElementById('task-modal-title').textContent = 'New Task';
  document.getElementById('task-btn-text').textContent = 'Create Task';
  document.getElementById('task-edit-id').value = '';
  document.getElementById('task-form').reset();
  populateAssignDropdown();
  document.getElementById('task-modal-overlay').classList.add('active');
}

function populateAssignDropdown(selectedId = '') {
  const select = document.getElementById('task-assign');
  if (!select) return;
  if (!select) return;
  select.innerHTML = `<option value="">— Unassigned —</option>` +
    teamMembers.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.full_name}</option>`).join('');
}

function editTask(taskId) {
  const t = allTasks.find(x => x.id === taskId);
  if (!t) return;
  document.getElementById('task-modal-title').textContent = 'Edit Task';
  document.getElementById('task-btn-text').textContent = 'Save Changes';
  document.getElementById('task-edit-id').value = taskId;
  document.getElementById('task-title').value = t.title;
  document.getElementById('task-desc').value = t.description || '';
  document.getElementById('task-status').value = t.status;
  document.getElementById('task-priority').value = t.priority;
  document.getElementById('task-due').value = t.due_date ? t.due_date.split('T')[0] : '';
  document.getElementById('task-result').value = t.result_link || '';
  populateAssignDropdown(t.assigned_to);
  document.getElementById('task-modal-overlay').classList.add('active');
}

async function saveTask(userProfile) {
  const editId = document.getElementById('task-edit-id').value;
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;

  const btnText = document.getElementById('task-btn-text');
  const spinner = document.getElementById('task-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const assignedTo = document.getElementById('task-assign').value || null;
    let status = document.getElementById('task-status').value;
    const resultLink = document.getElementById('task-result').value.trim();

    // CRM Automation: Handle Status Transitions
    if (resultLink) {
      status = 'done';
    } else if (!assignedTo) {
      status = 'pending'; // Strictly follow: unassigned -> draft (pending)
    } else {
      // Assigned but NO link: Ensure it's in an active state
      if (status === 'done' || status === 'completed' || status === 'review' || status === 'pending') {
        status = 'in_progress';
      }
    }

    const data = {
      title,
      description: document.getElementById('task-desc').value.trim() || null,
      status: status,
      priority: document.getElementById('task-priority').value,
      assigned_to: assignedTo,
      due_date: document.getElementById('task-due').value || null,
      result_link: resultLink || null
    };

    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); spinner.classList.add('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    if (editId) {
      await TasksService.updateTask(editId, data);
      showToast('Task updated! ✅', 'success');
    } else {
      data.created_by = userProfile.id;
      await TasksService.createTask(data);
      showToast('Task created! 🎉', 'success');
    }
    
    clearTimeout(safetyTimeout);
    closeModal();
    await loadTasksData(userProfile);
  } catch (err) {
    console.error('Save Task Error:', err);
    showToast('Error: ' + err.message, 'error');
  } finally {
    btnText.classList.remove('hidden'); spinner.classList.add('hidden');
  }
}

async function deleteTask(taskId, userProfile) {
  const confirmed = await showConfirmModal('Delete Task', 'Are you sure you want to delete this task?');
  if (!confirmed) return;

  try {
    await TasksService.deleteTask(taskId);
    showToast('Task deleted', 'success');
    await loadTasksData(userProfile);
  } catch (err) {
    showToast('Failed to delete task', 'error');
  }
}

function closeModal() {
  document.getElementById('task-modal-overlay').classList.remove('active');
}
