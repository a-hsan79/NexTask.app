// ===========================
// NexTask — Settings Page
// ===========================

import { AuthService } from '../services/auth.js';
import { TeamService } from '../services/team.js';
import { supabase } from '../services/supabase.js';
import { hasPermission, getRoleDisplayName } from '../utils/permissions.js';
import { getInitials, getAvatarColor, showToast, sanitize } from '../utils/helpers.js';

export async function renderSettingsPage(userProfile) {
  const mainContent = document.getElementById('main-content');
  const isAdmin = hasPermission(userProfile.role, 'manage_team');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>⚙️ Settings</h1>
          <p class="subtitle">Manage your profile and app preferences</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:var(--space-lg)">

        <!-- Profile Card -->
        <div class="card" style="padding:var(--space-xl)">
          <h3 style="margin-bottom:var(--space-lg);display:flex;align-items:center;gap:var(--space-sm)">👤 My Profile</h3>
          <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:var(--space-lg)">
            <div id="settings-avatar-container" style="position:relative;cursor:pointer;width:100px;height:100px">
              ${userProfile.avatar_url ? `
                <div id="settings-avatar-preview" class="avatar avatar-xl" style="width:100px;height:100px;background-image:url(${userProfile.avatar_url});background-size:cover;background-position:center"></div>
              ` : `
                <div id="settings-avatar-preview" class="avatar avatar-xl" style="width:100px;height:100px;background:${getAvatarColor(userProfile.full_name)};font-size:var(--font-2xl)">${getInitials(userProfile.full_name)}</div>
              `}
              <div class="avatar-edit-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;color:white;font-size:var(--font-sm)">
                <span>Change</span>
              </div>
              <input type="file" id="settings-avatar-input" accept="image/*" style="display:none" />
            </div>
            
            <div class="avatar-controls" style="margin-top:var(--space-md)">
              <button type="button" class="avatar-control-btn" id="btn-settings-preview" title="View Fullscreen">
                👁️ Preview
              </button>
              <button type="button" class="avatar-control-btn btn-danger-soft" id="btn-settings-remove" title="Remove Photo">
                🗑️ Remove
              </button>
            </div>
          </div>

          <form id="profile-form">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" class="form-input" id="settings-name" value="${sanitize(userProfile.full_name)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" class="form-input" id="settings-phone" value="${sanitize(userProfile.phone || '')}" placeholder="+92 300 1234567" />
            </div>
            <div class="form-group">
              <label class="form-label">Work Mode</label>
              <select class="form-select" id="settings-workmode">
                <option value="false" ${!userProfile.is_remote ? 'selected' : ''}>🏢 Office</option>
                <option value="true" ${userProfile.is_remote ? 'selected' : ''}>🌐 Remote</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">
              <span id="profile-btn-text">Save Profile</span>
              <div class="spinner hidden" id="profile-btn-spinner"></div>
            </button>
          </form>
        </div>

        <!-- Appearance Card -->
        <div class="card" style="padding:var(--space-xl)">
          <h3 style="margin-bottom:var(--space-lg);display:flex;align-items:center;gap:var(--space-sm)">🎨 Appearance</h3>
          
          <div class="form-group">
            <label class="form-label">Theme</label>
            <div style="display:flex;gap:var(--space-md);margin-top:var(--space-sm)">
              <button class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}" id="theme-dark" style="flex:1">
                🌙 Dark Mode
              </button>
              <button class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}" id="theme-light" style="flex:1">
                ☀️ Light Mode
              </button>
            </div>
          </div>

          <div style="margin-top:var(--space-xl);padding-top:var(--space-lg);border-top:1px solid var(--border)">
            <h3 style="margin-bottom:var(--space-lg);display:flex;align-items:center;gap:var(--space-sm)">🔒 Security</h3>
            <div class="form-group">
              <label class="form-label">Change Password</label>
              <input type="password" class="form-input" id="settings-new-password" placeholder="New password (min 6 chars)" minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirm New Password</label>
              <input type="password" class="form-input" id="settings-confirm-password" placeholder="Confirm new password" />
            </div>
            <button class="btn btn-secondary" id="btn-change-password" style="width:100%">
              <span id="pw-btn-text">Update Password</span>
              <div class="spinner hidden" id="pw-btn-spinner"></div>
            </button>
          </div>
        </div>

        <!-- AI Config Card -->
        <div class="card" style="padding:var(--space-xl)">
          <h3 style="margin-bottom:var(--space-lg);display:flex;align-items:center;gap:var(--space-sm)">🤖 AI Multi-Provider Config</h3>
          <p class="subtitle" style="margin-bottom:var(--space-md)">Switch between OpenRouter, OpenAI, Anthropic, or Gemini</p>
          
          <div class="form-group">
            <label class="form-label">Active AI Provider</label>
            <select class="form-select" id="settings-ai-provider">
              <option value="openrouter" ${localStorage.getItem('ai_provider') === 'openrouter' ? 'selected' : ''}>OpenRouter (Omni-Aggregator)</option>
              <option value="anthropic" ${localStorage.getItem('ai_provider') === 'anthropic' ? 'selected' : ''}>Anthropic (Claude Direct)</option>
              <option value="openai" ${localStorage.getItem('ai_provider') === 'openai' ? 'selected' : ''}>OpenAI (ChatGPT Direct)</option>
              <option value="google" ${localStorage.getItem('ai_provider') === 'google' ? 'selected' : ''}>Google AI (Gemini Direct)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="key-label">API Key</label>
            <input type="password" class="form-input" id="settings-ai-key" placeholder="Enter key..." />
            <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-xs)">Keys stay in your browser's private storage.</p>
          </div>

          <div class="form-group">
            <label class="form-label">Preferred AI Model</label>
            <select class="form-select" id="settings-ai-model">
              <!-- Dynamically populated -->
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Custom Agent Persona/Instructions</label>
            <textarea class="form-textarea" id="settings-ai-instructions" placeholder="e.g. Write in a catchy, expert tone. Focus on military technology and geopolitics." style="min-height:100px">${localStorage.getItem('ai_custom_instructions') || ''}</textarea>
            <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-xs)">These instructions will be followed for every AI research and optimization session.</p>
          </div>

          <button class="btn btn-primary" id="btn-save-ai-config" style="width:100%">
            <span>Save AI Configuration</span>
          </button>
        </div>

        <!-- App Info Card -->
        <div class="card" style="padding:var(--space-xl)">
          <h3 style="margin-bottom:var(--space-lg);display:flex;align-items:center;gap:var(--space-sm)">ℹ️ About NexTask</h3>
          <div style="text-align:center;padding:var(--space-lg) 0">
            <div style="font-size:3rem;margin-bottom:var(--space-md)">
              <span style="background:linear-gradient(135deg,#6C5CE7,#00B894);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;font-size:2rem">NT</span>
            </div>
            <h2 style="margin-bottom:var(--space-xs)">NexTask</h2>
            <p style="color:var(--text-muted);font-size:var(--font-sm)">Office Management System</p>
            <p style="color:var(--text-muted);font-size:var(--font-xs);margin-top:var(--space-md)">Version 1.0.0</p>
          </div>
          
          <div style="border-top:1px solid var(--border);padding-top:var(--space-md);margin-top:var(--space-md)">
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
              <span style="color:var(--text-muted);font-size:var(--font-xs)">Built By</span>
              <span style="font-size:var(--font-xs)">AHSAN NOOR</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
              <span style="color:var(--text-muted);font-size:var(--font-xs)">Your Role</span>
              <span style="font-size:var(--font-xs)">${getRoleDisplayName(userProfile.role)}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--text-muted);font-size:var(--font-xs)">Account</span>
              <span style="font-size:var(--font-xs)">${sanitize(userProfile.email)}</span>
            </div>
          </div>

          ${isAdmin ? `
          <div style="border-top:1px solid var(--border);padding-top:var(--space-md);margin-top:var(--space-md)">
            <h4 style="margin-bottom:var(--space-sm);color:var(--text-muted);font-size:var(--font-xs);text-transform:uppercase">Admin Actions</h4>
            <button class="btn btn-secondary btn-sm" id="btn-export-data" style="width:100%;margin-bottom:var(--space-sm)">📊 Export All Data (CSV)</button>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  initSettingsEvents(userProfile);
}

function initSettingsEvents(userProfile) {
  // Save profile
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('profile-btn-text');
    const spinner = document.getElementById('profile-btn-spinner');
    
    // Avatar Logic
    const avatarInput = document.getElementById('settings-avatar-input');
    const avatarFile = avatarInput.files[0];
    const isRemoved = avatarInput.dataset.removed === 'true';

    btnText.classList.add('hidden'); spinner.classList.remove('hidden');

    try {
      let avatarUrl = userProfile.avatar_url;

      if (isRemoved || avatarFile) {
        if (userProfile.avatar_url) {
          await TeamService.deleteAvatar(userProfile.avatar_url);
        }
        avatarUrl = isRemoved ? null : userProfile.avatar_url;
      }

      if (avatarFile) {
        avatarUrl = await TeamService.uploadAvatar(avatarFile, userProfile.id);
      }

      const updates = {
        full_name: document.getElementById('settings-name').value.trim(),
        phone: document.getElementById('settings-phone').value.trim() || null,
        is_remote: document.getElementById('settings-workmode').value === 'true',
        avatar_url: avatarUrl
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userProfile.id);

      if (error) throw error;

      // Update local profile
      Object.assign(userProfile, updates);

      // Update sidebar
      const sidebarName = document.querySelector('.sidebar-user-name');
      const sidebarAvatar = document.querySelector('.sidebar-user-avatar');
      
      if (sidebarName) sidebarName.textContent = updates.full_name;
      if (sidebarAvatar) {
        if (updates.avatar_url) {
          sidebarAvatar.style.backgroundImage = `url(${updates.avatar_url})`;
          sidebarAvatar.style.backgroundSize = 'cover';
          sidebarAvatar.textContent = '';
        } else {
          sidebarAvatar.style.backgroundImage = 'none';
          sidebarAvatar.style.backgroundColor = getAvatarColor(updates.full_name);
          sidebarAvatar.textContent = getInitials(updates.full_name);
        }
      }

      showToast('Profile updated! ✅', 'success');
      // Reset input state
      avatarInput.value = '';
      avatarInput.dataset.removed = 'false';
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { btnText.classList.remove('hidden'); spinner.classList.add('hidden'); }
  });

  // Avatar Click
  document.getElementById('settings-avatar-container')?.addEventListener('click', () => {
    document.getElementById('settings-avatar-input').click();
  });

  // Avatar Preview
  document.getElementById('settings-avatar-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById('settings-avatar-preview');
        preview.style.backgroundImage = `url(${ev.target.result})`;
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
      };
      reader.readAsDataURL(file);
    }
  });

  // Fullscreen Preview
  document.getElementById('btn-settings-preview')?.addEventListener('click', () => {
    const preview = document.getElementById('settings-avatar-preview');
    const bg = preview.style.backgroundImage;
    if (bg && bg !== 'none') {
      const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
      window.showLightbox(url);
    } else {
      showToast('No photo to preview 📸', 'info');
    }
  });

  // Remove Photo
  document.getElementById('btn-settings-remove')?.addEventListener('click', () => {
    const preview = document.getElementById('settings-avatar-preview');
    const input = document.getElementById('settings-avatar-input');
    
    preview.style.backgroundImage = 'none';
    preview.style.backgroundColor = getAvatarColor(userProfile.full_name);
    preview.textContent = getInitials(userProfile.full_name);
    
    input.value = '';
    input.dataset.removed = 'true';
  });

  // Theme toggle
  document.getElementById('theme-dark')?.addEventListener('click', () => setTheme('dark'));
  document.getElementById('theme-light')?.addEventListener('click', () => setTheme('light'));

  // Change password
  document.getElementById('btn-change-password')?.addEventListener('click', async () => {
    const newPw = document.getElementById('settings-new-password').value;
    const confirmPw = document.getElementById('settings-confirm-password').value;

    if (!newPw) { showToast('Enter a new password', 'warning'); return; }
    if (newPw.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }

    const btnText = document.getElementById('pw-btn-text');
    const spinner = document.getElementById('pw-btn-spinner');
    btnText.classList.add('hidden'); spinner.classList.remove('hidden');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      showToast('Password updated! 🔒', 'success');
      document.getElementById('settings-new-password').value = '';
      document.getElementById('settings-confirm-password').value = '';
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { btnText.classList.remove('hidden'); spinner.classList.add('hidden'); }
  });

  // Export data (admin)
  document.getElementById('btn-export-data')?.addEventListener('click', async () => {
    try {
      showToast('Exporting data...', 'info');
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: channels } = await supabase.from('yt_channels').select('*');
      const { data: videos } = await supabase.from('yt_videos').select('*');
      const { data: projects } = await supabase.from('freelance_projects').select('*');
      const { data: orders } = await supabase.from('freelance_orders').select('*');
      const { data: expenses } = await supabase.from('expenses').select('*');

      const exportData = {
        exported_at: new Date().toISOString(),
        profiles: profiles || [],
        yt_channels: channels || [],
        yt_videos: videos || [],
        freelance_projects: projects || [],
        freelance_orders: orders || [],
        expenses: expenses || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nextask_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Data exported! 📊', 'success');
    } catch (err) { showToast('Export failed: ' + err.message, 'error'); }
  });

  // Multi-Provider AI Config Logic
  const providerSelect = document.getElementById('settings-ai-provider');
  const keyInput = document.getElementById('settings-ai-key');
  const keyLabel = document.getElementById('key-label');
  const modelSelect = document.getElementById('settings-ai-model');

  const updateAIFields = () => {
    const provider = providerSelect.value;
    keyLabel.textContent = `${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`;
    keyInput.value = localStorage.getItem(`${provider}_api_key`) || '';
    keyInput.placeholder = provider === 'anthropic' ? 'sk-ant-api03-...' : (provider === 'openai' ? 'sk-...' : 'Enter key...');
    
    // Update Models
    let models = [];
    if (provider === 'openrouter') {
      models = [
        { v: 'openrouter/auto', n: 'Auto (Free Selection)' },
        { v: 'meta-llama/llama-3.1-405b-instruct', n: 'Llama 3.1 405B' },
        { v: 'anthropic/claude-3.5-sonnet', n: 'Claude 3.5 Sonnet' },
        { v: 'openai/gpt-4o-2024-08-06', n: 'GPT-4o' }
      ];
    } else if (provider === 'anthropic') {
      models = [
        { v: 'claude-3-5-sonnet-20240620', n: 'Claude 3.5 Sonnet' },
        { v: 'claude-3-opus-20240229', n: 'Claude 3 Opus' },
        { v: 'claude-3-haiku-20240307', n: 'Claude 3 Haiku' }
      ];
    } else if (provider === 'openai') {
      models = [
        { v: 'gpt-4o', n: 'GPT-4o' },
        { v: 'gpt-4o-mini', n: 'GPT-4o Mini' },
        { v: 'gpt-3.5-turbo', n: 'GPT-3.5 Turbo' }
      ];
    } else if (provider === 'google') {
      models = [
        { v: 'gemini-1.5-pro', n: 'Gemini 1.5 Pro' },
        { v: 'gemini-1.5-flash', n: 'Gemini 1.5 Flash' }
      ];
    }

    const currentModel = localStorage.getItem('ai_model');
    modelSelect.innerHTML = models.map(m => `<option value="${m.v}" ${currentModel === m.v ? 'selected' : ''}>${m.n}</option>`).join('');
  };

  providerSelect?.addEventListener('change', updateAIFields);
  updateAIFields(); // Initial load

  document.getElementById('btn-save-ai-config')?.addEventListener('click', () => {
    const provider = providerSelect.value;
    const key = keyInput.value.trim();
    const model = modelSelect.value;
    const instructions = document.getElementById('settings-ai-instructions').value.trim();
    
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem(`${provider}_api_key`, key);
    localStorage.setItem('ai_model', model);
    localStorage.setItem('ai_custom_instructions', instructions);
    
    // For backwards compatibility
    if (provider === 'openrouter') localStorage.setItem('openrouter_api_key', key);
    
    showToast(`${provider.toUpperCase()} Configuration saved! 🤖`, 'success');
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // Update button styles
  const darkBtn = document.getElementById('theme-dark');
  const lightBtn = document.getElementById('theme-light');
  if (darkBtn && lightBtn) {
    darkBtn.className = `btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`;
    lightBtn.className = `btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`;
  }
  showToast(`${theme === 'dark' ? '🌙' : '☀️'} ${theme.charAt(0).toUpperCase() + theme.slice(1)} mode activated`, 'success');
}
