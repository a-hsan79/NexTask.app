// ===========================
// NexTask — Team Page
// ===========================

import { TeamService } from '../services/team.js';
import { hasPermission, getRoleDisplayName, getRoleBadgeClass } from '../utils/permissions.js';
import { getInitials, getAvatarColor, showToast, sanitize, showConfirmModal } from '../utils/helpers.js';

let allMembers = [];
let currentUserProfile = null;

export async function renderTeamPage(userProfile) {
  currentUserProfile = userProfile;
  const mainContent = document.getElementById('main-content');
  const canManageRoles = hasPermission(userProfile.role, 'manage_roles');
  const isAdmin = ['owner', 'admin'].includes(userProfile.role);

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>👥 Team Management</h1>
          <p class="subtitle">Manage your team members and their roles</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="filter-bar" style="margin-bottom:var(--space-lg)">
        <div class="filter-chips">
          <button class="filter-chip active" data-tab="all">All Team</button>
          ${isAdmin ? `<button class="filter-chip" data-tab="pending">⏳ Pending Approval <span class="badge badge-primary hidden" id="pending-count-badge">0</span></button>` : ''}
        </div>
      </div>

      <!-- Team Stats -->
      <div class="dashboard-stats">
        <div class="stat-card purple">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-label">Total Members</div>
            <div class="stat-value" id="team-total">—</div>
          </div>
        </div>
        <div class="stat-card teal">
          <div class="stat-icon">🏢</div>
          <div class="stat-info">
            <div class="stat-label">Office</div>
            <div class="stat-value" id="team-office">—</div>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">🌍</div>
          <div class="stat-info">
            <div class="stat-label">Remote</div>
            <div class="stat-value" id="team-remote">—</div>
          </div>
        </div>
      </div>

      <!-- Team Grid -->
      <div id="team-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-lg)">
        <div class="skeleton" style="height:180px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:180px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:180px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    <!-- Edit Member Modal -->
    <div class="modal-overlay" id="member-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Edit Member</h2>
          <button class="modal-close" id="member-modal-close">✕</button>
        </div>
        <form id="member-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" id="member-name" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" id="member-role" ${!canManageRoles ? 'disabled' : ''}>
                <option value="owner">👑 Owner</option>
                <option value="admin">🛡️ Admin</option>
                <option value="manager">📊 Manager</option>
                <option value="editor">✂️ Editor</option>
                <option value="designer">🎨 Designer</option>
                <option value="writer">✍️ Writer</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Work Mode</label>
              <select class="form-select" id="member-remote">
                <option value="false">🏢 Office</option>
                <option value="true">🌍 Remote</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-input" id="member-phone" placeholder="+92 xxx xxxxxxx" />
          </div>
          <input type="hidden" id="member-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="member-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="member-btn-text">Save Changes</span>
              <div class="spinner hidden" id="member-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadTeamData();
  initTeamEvents(userProfile);
}

async function loadTeamData() {
  try {
    allMembers = await TeamService.getMembers();
    const pending = await TeamService.getPendingUsers();

    document.getElementById('team-total').textContent = allMembers.length;
    document.getElementById('team-office').textContent = allMembers.filter(m => !m.is_remote).length;
    document.getElementById('team-remote').textContent = allMembers.filter(m => m.is_remote).length;

    const pendingBadge = document.getElementById('pending-count-badge');
    if (pendingBadge) {
      pendingBadge.textContent = pending.length;
      pendingBadge.classList.toggle('hidden', pending.length === 0);
    }

    renderTeamGrid(allMembers);
  } catch (err) {
    console.error('Team load error:', err);
    showToast('Failed to load team data', 'error');
  }
}

function renderTeamGrid(members) {
  const grid = document.getElementById('team-grid');

  if (!members.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">👥</div>
        <h3>No team members yet</h3>
        <p>Team members will appear here when they sign up.</p>
      </div>
    `;
    return;
  }

  const isAdmin = ['owner', 'admin'].includes(currentUserProfile?.role);

  grid.innerHTML = members.map(member => `
    <div class="card" style="position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${getAvatarColor(member.full_name)}"></div>
      <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md)">
        <div class="avatar avatar-lg" style="background:${getAvatarColor(member.full_name)}">${getInitials(member.full_name)}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--font-lg)">${sanitize(member.full_name)}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
            <span class="badge ${getRoleBadgeClass(member.role)}">${getRoleDisplayName(member.role)}</span>
            <span style="font-size:var(--font-xs);color:var(--text-muted)">${member.is_remote ? '🌍 Remote' : '🏢 Office'}</span>
          </div>
        </div>
        ${isAdmin ? `
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-icon" data-edit-member="${member.id}" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-icon" data-remove-member="${member.id}" title="Remove">🗑️</button>
          </div>
        ` : ''}
      </div>
      <div style="font-size:var(--font-sm);color:var(--text-secondary)">
        ${member.email ? `<div style="margin-bottom:4px">📧 ${sanitize(member.email)}</div>` : ''}
        ${member.phone ? `<div>📱 ${sanitize(member.phone)}</div>` : ''}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-edit-member]').forEach(btn => {
    btn.addEventListener('click', () => openEditMember(btn.dataset.editMember));
  });

  grid.querySelectorAll('[data-remove-member]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.remove_member || btn.getAttribute('data-remove-member');
      if (id === currentUserProfile.id) {
        showToast("You cannot remove your own account.", "warning");
        return;
      }
      
      const confirmed = await showConfirmModal('Remove Team Member', 'Are you sure you want to remove this member? This action cannot be undone.');
      if (!confirmed) return;
      
      try {
        await TeamService.rejectUser(id); // Reusing the delete method
        showToast('Member removed successfully.', 'info');
        loadTeamData();
      } catch (err) {
        showToast('Failed to remove member: ' + err.message, 'error');
      }
    });
  });
}

function initTeamEvents(userProfile) {
  // Tab switching
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const isPending = tab.dataset.tab === 'pending';
      if (isPending) {
        loadPendingData();
      } else {
        loadTeamData();
      }
    });
  });

  document.getElementById('member-modal-close')?.addEventListener('click', closeMemberModal);
  document.getElementById('member-cancel')?.addEventListener('click', closeMemberModal);
  document.getElementById('member-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'member-modal-overlay') closeMemberModal();
  });

  document.getElementById('member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveMember(userProfile);
  });
}

function openEditMember(memberId) {
  const member = allMembers.find(m => m.id === memberId);
  if (!member) return;

  document.getElementById('member-edit-id').value = memberId;
  document.getElementById('member-name').value = member.full_name;
  document.getElementById('member-role').value = member.role;
  document.getElementById('member-remote').value = String(member.is_remote);
  document.getElementById('member-phone').value = member.phone || '';
  document.getElementById('member-modal-overlay').classList.add('active');
}

function closeMemberModal() {
  document.getElementById('member-modal-overlay').classList.remove('active');
}

async function saveMember(userProfile) {
  const memberId = document.getElementById('member-edit-id').value;
  const fullName = document.getElementById('member-name').value.trim();
  const role = document.getElementById('member-role').value;
  const isRemote = document.getElementById('member-remote').value === 'true';
  const phone = document.getElementById('member-phone').value.trim();

  if (!fullName) {
    showToast('Name is required', 'warning');
    return;
  }

  const btnText = document.getElementById('member-btn-text');
  const btnSpinner = document.getElementById('member-btn-spinner');
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  try {
    const updates = { full_name: fullName, is_remote: isRemote, phone };

    // Only admins/owners can change roles
    if (hasPermission(userProfile.role, 'manage_roles')) {
      updates.role = role;
    }

    await TeamService.updateMember(memberId, updates);
    showToast('Member updated! ✅', 'success');
    closeMemberModal();
    await loadTeamData();
  } catch (err) {
    console.error('Save member error:', err);
    showToast('Failed to update: ' + err.message, 'error');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

async function loadPendingData() {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '<div class="skeleton" style="height:180px;border-radius:var(--radius-lg)"></div>'.repeat(3);

  try {
    const pending = await TeamService.getPendingUsers();
    renderPendingGrid(pending);
  } catch (err) {
    console.error('Pending load error:', err);
    showToast('Failed to load pending users', 'error');
  }
}

function renderPendingGrid(pending) {
  const grid = document.getElementById('team-grid');

  if (!pending.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⏳</div>
        <h3>No pending approvals</h3>
        <p>New signups awaiting confirmation will appear here.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = pending.map(user => `
    <div class="card" style="position:relative;overflow:hidden;border-color:var(--primary)">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:var(--primary)"></div>
      <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md)">
        <div class="avatar avatar-lg" style="background:${getAvatarColor(user.full_name)}">${getInitials(user.full_name)}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--font-lg)">${sanitize(user.full_name)}</div>
          <div style="font-size:var(--font-xs);color:var(--primary);margin-top:4px">⏳ Awaiting Approval</div>
        </div>
      </div>
      <div style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
        <div style="margin-bottom:4px">📧 ${sanitize(user.email)}</div>
        <div>📅 Joined ${new Date(user.created_at).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;gap:var(--space-sm)">
        <button class="btn btn-primary btn-sm" style="flex:1" data-approve="${user.id}">✅ Approve</button>
        <button class="btn btn-secondary btn-sm" style="flex:1" data-reject="${user.id}">✕ Reject</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.approve;
      try {
        await TeamService.confirmUser(id);
        showToast('User approved! ✅', 'success');
        loadPendingData();
        // Update pending count in tab
        const pendingBadge = document.getElementById('pending-count-badge');
        if (pendingBadge) {
          const count = parseInt(pendingBadge.textContent) || 0;
          const newCount = Math.max(0, count - 1);
          pendingBadge.textContent = newCount;
          pendingBadge.classList.toggle('hidden', newCount === 0);
        }
      } catch (err) {
        showToast('Approval failed: ' + err.message, 'error');
      }
    });
  });

  grid.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.reject;
      const confirmed = await showConfirmModal('Reject Signup', 'Are you sure you want to reject and delete this signup request?');
      if (!confirmed) return;
      
      try {
        await TeamService.rejectUser(id);
        showToast('User rejected', 'info');
        loadPendingData();
        // Update pending count in tab
        const pendingBadge = document.getElementById('pending-count-badge');
        if (pendingBadge) {
          const count = parseInt(pendingBadge.textContent) || 0;
          const newCount = Math.max(0, count - 1);
          pendingBadge.textContent = newCount;
          pendingBadge.classList.toggle('hidden', newCount === 0);
        }
      } catch (err) {
        showToast('Rejection failed: ' + err.message, 'error');
      }
    });
  });
}
