// ===========================
// NexTask — Expenses Page
// ===========================

import { ExpensesService } from '../services/expenses.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { formatCurrency, formatDate, getInitials, getAvatarColor, showToast, sanitize, showConfirmModal } from '../utils/helpers.js';

let allExpenses = [];
let teamMembers = [];
let timeFilter = 'current_month';

export async function renderExpensesPage(userProfile) {
  const mainContent = document.getElementById('main-content');
  const canAdd = hasPermission(userProfile.role, 'add_expenses');
  const canDelete = hasPermission(userProfile.role, 'delete_expenses');

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>💰 Expenses</h1>
          <p class="subtitle">Track team and office expenses</p>
        </div>
        ${canAdd ? `<button class="btn btn-primary" id="btn-new-expense">+ Add Expense</button>` : ''}
      </div>

      <!-- Expense Stats -->
      <div class="dashboard-stats">
        <div class="stat-card orange">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-label">This Month Total</div>
            <div class="stat-value" id="exp-total">—</div>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-label">Team Expenses</div>
            <div class="stat-value" id="exp-team">—</div>
          </div>
        </div>
        <div class="stat-card teal">
          <div class="stat-icon">🏢</div>
          <div class="stat-info">
            <div class="stat-label">Office Expenses</div>
            <div class="stat-value" id="exp-office">—</div>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">💻</div>
          <div class="stat-info">
            <div class="stat-label">Software</div>
            <div class="stat-value" id="exp-software">—</div>
          </div>
        </div>
      </div>

      <!-- Filter -->
      <div class="filter-bar" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:16px;">
        <div class="filter-chips">
          <button class="filter-chip active" data-cat="all">All</button>
          <button class="filter-chip" data-cat="team">👥 Team</button>
          <button class="filter-chip" data-cat="office">🏢 Office</button>
          <button class="filter-chip" data-cat="software">💻 Software</button>
          <button class="filter-chip" data-cat="equipment">🖥️ Equipment</button>
          <button class="filter-chip" data-cat="other">📦 Other</button>
        </div>
        <div class="filter-chips" style="background:var(--bg-panel); padding:4px; border-radius:var(--radius-full);">
          <button class="filter-chip active" data-time="current_month" style="margin:0;">📅 This Month</button>
          <button class="filter-chip" data-time="history" style="margin:0;">📜 History</button>
        </div>
      </div>

      <!-- Expenses List -->
      <div class="card" id="expenses-container">
        <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
        <div class="skeleton" style="height:60px;margin-bottom:8px"></div>
        <div class="skeleton" style="height:60px"></div>
      </div>
    </div>

    <!-- Add/Edit Expense Modal -->
    <div class="modal-overlay" id="expense-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2 id="expense-modal-title">Add Expense</h2>
          <button class="modal-close" id="expense-modal-close">✕</button>
        </div>
        <form id="expense-form">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="exp-title" placeholder="e.g., Adobe subscription" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Amount *</label>
              <input type="number" class="form-input" id="exp-amount" placeholder="0" min="0" step="0.01" required />
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-select" id="exp-currency">
                <option value="PKR">PKR (₨)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="exp-category">
                <option value="team">👥 Team</option>
                <option value="office">🏢 Office</option>
                <option value="software">💻 Software</option>
                <option value="equipment">🖥️ Equipment</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="exp-date" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Paid By</label>
            <select class="form-select" id="exp-paid-by"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="exp-notes" placeholder="Additional details..." style="min-height:60px"></textarea>
          </div>
          <input type="hidden" id="exp-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="expense-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="expense-btn-text">Add Expense</span>
              <div class="spinner hidden" id="expense-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  teamMembers = await TeamService.getMemberOptions();
  await loadExpensesData(userProfile);
  initExpenseEvents(userProfile);
}

async function loadExpensesData(userProfile, category = 'all') {
  try {
    allExpenses = await ExpensesService.getExpenses({
      category: category !== 'all' ? category : undefined,
      timeFilter: timeFilter
    });
    const stats = await ExpensesService.getMonthlyStats();

    document.getElementById('exp-total').textContent = formatCurrency(stats.total);
    document.getElementById('exp-team').textContent = formatCurrency(stats.team);
    document.getElementById('exp-office').textContent = formatCurrency(stats.office);
    document.getElementById('exp-software').textContent = formatCurrency(stats.software);

    renderExpensesList(allExpenses, userProfile);
  } catch (err) {
    console.error('Expenses load error:', err);
    showToast('Failed to load expenses', 'error');
  }
}

function renderExpensesList(expenses, userProfile) {
  const container = document.getElementById('expenses-container');
  const canDelete = hasPermission(userProfile.role, 'delete_expenses');

  if (!expenses.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <h3>No expenses yet</h3>
        <p>Start tracking your team and office expenses!</p>
      </div>
    `;
    return;
  }

  const catIcons = { team: '👥', office: '🏢', software: '💻', equipment: '🖥️', other: '📦' };

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Expense</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Paid By</th>
            <th>Date</th>
            ${canDelete ? '<th style="text-align:right">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${expenses.map(exp => `
            <tr>
              <td>
                <div style="font-weight:500">${sanitize(exp.title)}</div>
                ${exp.notes ? `<div style="font-size:var(--font-xs);color:var(--text-muted)">${sanitize(exp.notes).slice(0, 50)}</div>` : ''}
              </td>
              <td>
                <span class="badge badge-neutral">${catIcons[exp.category] || '📦'} ${exp.category}</span>
              </td>
              <td style="font-weight:600;color:var(--danger)">${formatCurrency(exp.amount, exp.currency || 'PKR')}</td>
              <td>
                ${exp.paid_profile ? `
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="avatar avatar-sm" style="background:${getAvatarColor(exp.paid_profile.full_name)}">${getInitials(exp.paid_profile.full_name)}</div>
                    <span>${exp.paid_profile.full_name}</span>
                  </div>
                ` : '<span style="color:var(--text-muted)">—</span>'}
              </td>
              <td>${formatDate(exp.date)}</td>
              ${canDelete ? `
              <td style="text-align:right; white-space:nowrap;">
                ${['owner', 'admin'].includes(userProfile.role) ? `<button class="btn btn-ghost btn-sm" data-edit-expense="${exp.id}" title="Edit">✏️</button>` : ''}
                <button class="btn btn-ghost btn-sm" data-delete-expense="${exp.id}" title="Delete">🗑️</button>
              </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-delete-expense]').forEach(btn => {
    btn.addEventListener('click', () => deleteExpense(btn.dataset.deleteExpense, userProfile));
  });

  container.querySelectorAll('[data-edit-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = expenses.find(e => e.id === btn.dataset.editExpense);
      if (exp) openEditExpense(exp);
    });
  });
}

function initExpenseEvents(userProfile) {
  document.getElementById('btn-new-expense')?.addEventListener('click', () => openNewExpense(userProfile));

  // Category filter
  document.querySelectorAll('[data-cat]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadExpensesData(userProfile, chip.dataset.cat);
    });
  });

  // Time filter
  document.querySelectorAll('[data-time]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-time]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      timeFilter = chip.dataset.time;
      const activeCat = document.querySelector('[data-cat].active')?.dataset.cat || 'all';
      loadExpensesData(userProfile, activeCat);
    });
  });

  // Modal
  document.getElementById('expense-modal-close')?.addEventListener('click', closeExpenseModal);
  document.getElementById('expense-cancel')?.addEventListener('click', closeExpenseModal);
  document.getElementById('expense-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'expense-modal-overlay') closeExpenseModal();
  });

  document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveExpense(userProfile);
  });
}

function openNewExpense(userProfile) {
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-btn-text').textContent = 'Add Expense';
  document.getElementById('exp-edit-id').value = '';
  document.getElementById('expense-form').reset();

  // Set today's date
  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];

  // Populate paid-by dropdown
  const select = document.getElementById('exp-paid-by');
  select.innerHTML = `<option value="">— Select —</option>` +
    teamMembers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');

  document.getElementById('expense-modal-overlay').classList.add('active');
}

function openEditExpense(exp) {
  document.getElementById('expense-modal-title').textContent = 'Update Expense';
  document.getElementById('expense-btn-text').textContent = 'Save Changes';
  
  document.getElementById('exp-edit-id').value = exp.id;
  document.getElementById('exp-title').value = exp.title;
  document.getElementById('exp-amount').value = exp.amount;
  document.getElementById('exp-currency').value = exp.currency || 'PKR';
  document.getElementById('exp-category').value = exp.category || 'other';
  document.getElementById('exp-date').value = exp.date ? exp.date.split('T')[0] : '';
  document.getElementById('exp-notes').value = exp.notes || '';

  const select = document.getElementById('exp-paid-by');
  select.innerHTML = `<option value="">— Select —</option>` +
    teamMembers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');
  document.getElementById('exp-paid-by').value = exp.paid_by || '';

  document.getElementById('expense-modal-overlay').classList.add('active');
}

function closeExpenseModal() {
  document.getElementById('expense-modal-overlay').classList.remove('active');
}

async function saveExpense(userProfile) {
  const title = document.getElementById('exp-title').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const currency = document.getElementById('exp-currency').value;
  const category = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;
  const paidBy = document.getElementById('exp-paid-by').value || null;
  const notes = document.getElementById('exp-notes').value.trim();

  if (!title || !amount) {
    showToast('Title and amount are required', 'warning');
    return;
  }

  const btnText = document.getElementById('expense-btn-text');
  const btnSpinner = document.getElementById('expense-btn-spinner');
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  try {
    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); btnSpinner.classList.add('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    const editId = document.getElementById('exp-edit-id').value;
    const payload = {
      title, amount, currency, category, 
      date: date || new Date().toISOString().split('T')[0],
      paid_by: paidBy,
      notes
    };
    
    if (editId) {
      await ExpensesService.updateExpense(editId, payload);
      showToast('Expense updated! 💾', 'success');
    } else {
      payload.created_by = userProfile.id;
      await ExpensesService.createExpense(payload);
      showToast('Expense added! 💰', 'success');
    }

    clearTimeout(safetyTimeout);
    closeExpenseModal();
    
    const activeCat = document.querySelector('[data-cat].active')?.dataset.cat || 'all';
    await loadExpensesData(userProfile, activeCat);
  } catch (err) {
    console.error('Save expense error:', err);
    showToast('Failed to add expense: ' + err.message, 'error');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

async function deleteExpense(expenseId, userProfile) {
  const confirmed = await showConfirmModal('Delete Expense', 'Are you sure you want to delete this expense?');
  if (!confirmed) return;

  try {
    await ExpensesService.deleteExpense(expenseId);
    showToast('Expense deleted', 'success');
    await loadExpensesData(userProfile);
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}
