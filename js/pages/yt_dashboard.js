// ===========================
// NexTask — YT Automation Dashboard (Channel → Video)
// ===========================

import { ChannelsService } from '../services/channels.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { getInitials, getAvatarColor, showToast, sanitize, timeAgo, debounce, showConfirmModal } from '../utils/helpers.js';
import { addSubscription, clearSubscriptions } from '../app.js';

let allChannels = [];
let allVideos = [];
let teamMembers = [];

function getVideoModalHTML() {
  return `
    <!-- Video Modal -->
    <div class="modal-overlay" id="video-modal-overlay">
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <h2 id="video-modal-title">Add Video</h2>
          <button class="modal-close" id="video-modal-close">✕</button>
        </div>
        <form id="video-form">
          <div class="form-group">
            <label class="form-label">Video Title *</label>
            <input type="text" class="form-input" id="vid-title" placeholder="e.g., Top 10 AI Tools 2026" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">📝 Script Link</label>
              <input type="url" class="form-input" id="vid-script" placeholder="Google Docs / Notion link" />
            </div>
            <div class="form-group">
              <label class="form-label">🎙️ Voiceover Link</label>
              <input type="url" class="form-input" id="vid-voiceover" placeholder="Drive / Dropbox link" />
            </div>
          </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
              <div class="form-group">
                <label class="form-label">🖼️ Thumbnail Link</label>
                <input type="url" class="form-input" id="vid-thumbnail" placeholder="Canva / Figma link" />
              </div>
              <div class="form-group">
                <label class="form-label">🔗 Video / YouTube Link</label>
                <input type="url" class="form-input" id="vid-video" placeholder="YouTube URL" />
              </div>
            </div>
            
            <!-- Version 2 Collapsible Section -->
            <div class="v2-accordion" style="margin-bottom:var(--space-md)">
              <button type="button" class="btn btn-ghost" id="v2-toggle-btn" style="width:100%;justify-content:space-between;border:1px dashed var(--border-color);margin-bottom:8px">
                <span>➕ Add Version 2 Details</span>
                <span id="v2-toggle-icon">▼</span>
              </button>
              <div id="v2-content" class="hidden" style="padding:var(--space-md);background:var(--bg-secondary);border-radius:var(--radius-md)">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                  <div class="form-group">
                    <label class="form-label">📝 Script V2 Link</label>
                    <input type="url" class="form-input" id="vid-script-v2" placeholder="Version 2 Script" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">🎙️ Voiceover V2 Link</label>
                    <input type="url" class="form-input" id="vid-voiceover-v2" placeholder="Version 2 Voiceover" />
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                  <div class="form-group">
                    <label class="form-label">🖼️ Thumbnail V2 Link</label>
                    <input type="url" class="form-input" id="vid-thumbnail-v2" placeholder="Version 2 Thumbnail" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">🔗 Video V2 Link</label>
                    <input type="url" class="form-input" id="vid-video-v2" placeholder="Version 2 Video URL" />
                  </div>
                </div>
              </div>
            </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Assign To</label>
              <select class="form-select" id="vid-assign"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="vid-status">
                <option value="draft">📝 Draft</option>
                <option value="scripting">✍️ Scripting</option>
                <option value="recording">🎙️ Recording</option>
                <option value="editing">✂️ Editing</option>
                <option value="uploaded">☁️ Uploaded</option>
                <option value="published">🚀 Published</option>
                <option value="done">✅ Done</option>
              </select>
            </div>
          </div>
          <input type="hidden" id="vid-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="video-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="vid-btn-text">Add Video</span>
              <div class="spinner hidden" id="vid-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
let currentChannel = null;
let currentSection = 'automation';
let moduleUserProfile = null; // New global reference
let activeHistoryDate = null;
let activeHistoryChannelId = null;

const VIDEO_STATUSES = {
  draft:     { label: 'Draft',     icon: '📝', class: 'status-draft' },
  scripting: { label: 'Scripting', icon: '✍️', class: 'status-scripting' },
  recording: { label: 'Recording', icon: '🎙️', class: 'status-recording' },
  editing:   { label: 'Editing',   icon: '✂️', class: 'status-editing' },
  uploaded:  { label: 'Uploaded',  icon: '☁️', class: 'status-uploaded' },
  published: { label: 'Published', icon: '🚀', class: 'status-published' },
  done:      { label: 'Done',      icon: '✅', class: 'status-done' }
};

export async function renderYTDashboardPage(userProfile, section = 'automation') {
  moduleUserProfile = userProfile;
  currentSection = section;
  currentChannel = null;
  teamMembers = await TeamService.getMemberOptions();
  await renderChannelsList(userProfile);
  activeHistoryDate = null;
  activeHistoryChannelId = null;
}

// ===========================
// CHANNELS LIST VIEW
// ===========================

async function renderChannelsList(userProfile) {
  clearSubscriptions();
  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_channels');

  const isOffice = currentSection === 'office';
  const title = isOffice ? 'Office YT' : 'YT Automation';
  const subtitle = isOffice ? 'Manage office YouTube content and projects' : 'Manage your YouTube channels and video projects';

  mainContent.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1>🎬 ${title}</h1>
          <p class="subtitle">${subtitle}</p>
        </div>
        ${canCreate ? `<button class="btn btn-primary" id="btn-new-channel">+ New Channel</button>` : ''}
      </div>

      <!-- Stats -->
      <div class="dashboard-stats" id="yt-stats">
        <div class="stat-card purple clickable stagger-1" id="stat-yt-channels">
          <div class="stat-icon">📺</div>
          <div class="stat-info">
            <div class="stat-label">Channels</div>
            <div class="stat-value" id="yt-channels-count">—</div>
          </div>
        </div>
        <div class="stat-card blue clickable stagger-2" id="stat-yt-total">
          <div class="stat-icon">🎬</div>
          <div class="stat-info">
            <div class="stat-label">Total Videos</div>
            <div class="stat-value" id="yt-videos-count">—</div>
          </div>
        </div>
        <div class="stat-card orange clickable stagger-3" id="stat-yt-progress">
          <div class="stat-icon">✂️</div>
          <div class="stat-info">
            <div class="stat-label">In Progress</div>
            <div class="stat-value" id="yt-in-progress">—</div>
          </div>
        </div>
        <div class="stat-card green clickable stagger-4" id="stat-yt-published">
          <div class="stat-icon">🚀</div>
          <div class="stat-info">
            <div class="stat-label">Published / Done</div>
            <div class="stat-value" id="yt-published">—</div>
          </div>
        </div>
        <div class="stat-card sky clickable stagger-5" id="stat-yt-uploaded">
          <div class="stat-icon">☁️</div>
          <div class="stat-info">
            <div class="stat-label">Uploaded</div>
            <div class="stat-value" id="yt-uploaded">—</div>
          </div>
        </div>
        <div class="stat-card pink clickable stagger-6" id="stat-yt-unassigned" style="display:none">
          <div class="stat-icon">👤</div>
          <div class="stat-info">
            <div class="stat-label">Unassigned</div>
            <div class="stat-value" id="yt-unassigned">—</div>
          </div>
        </div>
        <div class="stat-card indigo clickable stagger-7" id="stat-yt-assigned">
          <div class="stat-icon">📝</div>
          <div class="stat-info">
            <div class="stat-label">Assigned</div>
            <div class="stat-value" id="yt-assigned">—</div>
          </div>
        </div>
        <div class="stat-card teal clickable stagger-8" id="stat-yt-done">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-label">Done Videos</div>
            <div class="stat-value" id="yt-done">—</div>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="channel-search" placeholder="Search channels..." />
        </div>
      </div>

      <!-- Channels Grid -->
      <div class="project-grid" id="channels-grid">
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    <!-- Channel Modal -->
    <div class="modal-overlay" id="channel-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2 id="channel-modal-title">New YouTube Channel</h2>
          <button class="modal-close" id="channel-modal-close">✕</button>
        </div>
        <form id="channel-form">
          <div class="form-group">
            <label class="form-label">Channel Name *</label>
            <input type="text" class="form-input" id="ch-name" placeholder="e.g., Tech Reviews" required />
          </div>
          <div class="form-group">
            <label class="form-label">Channel URL</label>
            <input type="url" class="form-input" id="ch-url" placeholder="https://youtube.com/@channel" />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="ch-desc" placeholder="Notes about this channel..." style="min-height:60px"></textarea>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-md)">
            <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="chan-public" style="width:18px;height:18px" />
              <span>Show to Team</span>
            </label>
          </div>
          <input type="hidden" id="ch-edit-id" />
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="channel-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <span id="ch-btn-text">Create Channel</span>
              <div class="spinner hidden" id="ch-btn-spinner"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadChannelsData(userProfile);
  initChannelEvents(userProfile);

  // Real-time subscription for channels
  const channelSub = ChannelsService.subscribeToChannels(() => {
    console.log('Real-time update: Channels list changed');
    const ytStats = document.getElementById('yt-stats');
    if (ytStats) loadChannelsData(userProfile);
  });
  addSubscription(channelSub);
}

async function loadChannelsData(userProfile, search = '') {
  try {
    allChannels = await ChannelsService.getChannels(currentSection);
    const stats = await ChannelsService.getAllVideoStats(currentSection);

    document.getElementById('yt-channels-count').textContent = allChannels.length;
    document.getElementById('yt-videos-count').textContent = stats.total;
    document.getElementById('yt-in-progress').textContent = stats.scripting + stats.recording + stats.editing;
    document.getElementById('yt-published').textContent = stats.published;
    document.getElementById('yt-uploaded').textContent = stats.uploaded;
    document.getElementById('yt-unassigned').textContent = stats.unassigned;
    document.getElementById('yt-assigned').textContent = stats.assigned;
    document.getElementById('yt-done').textContent = stats.done;

    // Show unassigned stat only for admin/owner/manager
    const isAdmin = ['owner', 'admin', 'manager'].includes(userProfile.role);
    const unassignedCard = document.getElementById('stat-yt-unassigned');
    if (unassignedCard) unassignedCard.style.display = isAdmin ? '' : 'none';

    let filtered = allChannels;
    if (search) {
      const s = search.toLowerCase();
      filtered = allChannels.filter(c => c.name.toLowerCase().includes(s));
    }

    await renderChannelsGrid(filtered, userProfile);
  } catch (err) {
    console.error('Channels error:', err);
    showToast('Channels: ' + (err.message || err.toString() || 'Unknown error'), 'error');
  }
}

async function renderChannelsGrid(channels, userProfile) {
  const grid = document.getElementById('channels-grid');
  if (!grid) return; // View changed
  const canEdit = hasPermission(userProfile.role, 'edit_channels');
  const canDelete = hasPermission(userProfile.role, 'delete_channels');

  if (!channels.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📺</div>
        <h3>No channels yet</h3>
        <p>Add your first YouTube channel to start managing videos!</p>
      </div>
    `;
    return;
  }

  // Fetch all counts and archives in exactly 2 bulk database queries
  const channelIds = channels.map(c => c.id);
  const countsMap = await ChannelsService.getBulkChannelVideoCounts(channelIds);
  const archivesMap = await ChannelsService.getBulkArchivedVideoDates(channelIds);
  
  const counts = channels.map(ch => countsMap[ch.id] || { total: 0, done: 0, uploaded: 0 });
  const archives = channels.map(ch => archivesMap[ch.id] || []);

  grid.innerHTML = channels.map((ch, i) => `
    <div class="project-card fade-in stagger-${Math.min(i + 1, 5)}" data-channel-id="${ch.id}">
      <div class="project-card-actions">
        ${canEdit ? `<button class="btn btn-ghost btn-sm" data-edit-channel="${ch.id}" title="Edit">✏️</button>` : ''}
        ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-channel="${ch.id}" title="Delete">🗑️</button>` : ''}
      </div>
      <div class="project-card-header">
        ${counts[i].total > 0 && counts[i].total === counts[i].done ? `<div class="completion-badge clickable" data-open-status="done">✅ DONE</div>` : ''}
        ${counts[i].uploaded > 0 ? `<div class="uploaded-badge clickable" data-open-status="uploaded">☁️ UPLOADED (${counts[i].uploaded})</div>` : ''}
        <div class="project-card-icon">📺</div>
        <div>
          <div class="project-card-title">${sanitize(ch.name)}</div>
          <div class="project-card-subtitle">${ch.url ? `<a href="${sanitize(ch.url)}" target="_blank" style="color:var(--primary)" onclick="event.stopPropagation()">View Channel ↗</a>` : 'No URL added'}</div>
        </div>
      </div>
      ${ch.description ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md)">${sanitize(ch.description).slice(0, 80)}</p>` : ''}
      <div class="project-card-stats">
        <div class="project-card-stat"><strong>${counts[i].total}</strong> Active</div>
        ${archives[i].length > 0 ? `<div class="project-card-stat clickable" data-open-history="${ch.id}" style="color:var(--primary);cursor:pointer">📜 <strong>${archives[i].length}</strong> History Folders</div>` : ''}
        <div class="project-card-stat">Created ${timeAgo(ch.created_at)}</div>
      </div>
    </div>
  `).join('');

  // Click channel card → open videos view
  grid.querySelectorAll('[data-channel-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      // Check for status badge clicks
      const statusBadge = e.target.closest('[data-open-status]');
      if (statusBadge) {
        e.stopPropagation();
        openChannelVideos(card.dataset.channelId, userProfile, statusBadge.dataset.openStatus);
        return;
      }

      if (e.target.closest('[data-edit-channel]') || e.target.closest('[data-delete-channel]') || e.target.closest('[data-open-history]')) return;
      openChannelVideos(card.dataset.channelId, userProfile);
    });
  });

  // History Badge Click
  grid.querySelectorAll('[data-open-history]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const channelId = btn.dataset.openHistory;
      currentChannel = allChannels.find(c => c.id === channelId);
      openDailyHistory(channelId, userProfile);
    });
  });

  // Edit/Delete
  grid.querySelectorAll('[data-edit-channel]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); editChannel(btn.dataset.editChannel); });
  });
  grid.querySelectorAll('[data-delete-channel]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteChannel(btn.dataset.deleteChannel, userProfile); });
  });
}

function initChannelEvents(userProfile) {
  document.getElementById('btn-new-channel')?.addEventListener('click', () => openNewChannel());

  document.getElementById('channel-search')?.addEventListener('input', debounce((e) => {
    loadChannelsData(userProfile, e.target.value);
  }, 300));

  document.getElementById('channel-modal-close')?.addEventListener('click', () => closeModal('channel-modal-overlay'));
  document.getElementById('channel-cancel')?.addEventListener('click', () => closeModal('channel-modal-overlay'));
  document.getElementById('channel-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'channel-modal-overlay') closeModal('channel-modal-overlay');
  });

  document.getElementById('channel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveChannel(userProfile);
  });

  // Global Stats Click
  document.getElementById('stat-yt-channels')?.addEventListener('click', () => {
    // Just scroll to grid if on channels list, but since we are already there, maybe it's fine.
    // Or we could refresh. For now, let's just make it a no-op or scroll.
    document.getElementById('channels-grid')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('stat-yt-total')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'all'));
  document.getElementById('stat-yt-progress')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'in-progress'));
  document.getElementById('stat-yt-published')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'published'));
  document.getElementById('stat-yt-unassigned')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'unassigned'));
  document.getElementById('stat-yt-assigned')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'assigned'));
  document.getElementById('stat-yt-done')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'done'));
  document.getElementById('stat-yt-uploaded')?.addEventListener('click', () => renderGlobalVideos(userProfile, 'uploaded'));
}

function openNewChannel() {
  document.getElementById('channel-modal-title').textContent = 'New YouTube Channel';
  document.getElementById('ch-btn-text').textContent = 'Create Channel';
  document.getElementById('ch-edit-id').value = '';
  document.getElementById('channel-form').reset();
  document.getElementById('channel-modal-overlay').classList.add('active');
}

function editChannel(channelId) {
  const ch = allChannels.find(c => c.id === channelId);
  if (!ch) return;
  document.getElementById('channel-modal-title').textContent = 'Edit Channel';
  document.getElementById('ch-btn-text').textContent = 'Save Changes';
  document.getElementById('ch-edit-id').value = channelId;
  document.getElementById('ch-name').value = ch.name;
  document.getElementById('ch-url').value = ch.url || '';
  document.getElementById('ch-desc').value = ch.description || '';
  document.getElementById('chan-public').checked = !!ch.is_public;
  document.getElementById('channel-modal-overlay').classList.add('active');
}

async function saveChannel(userProfile) {
  const editId = document.getElementById('ch-edit-id').value;
  const name = document.getElementById('ch-name').value.trim();
  const url = document.getElementById('ch-url').value.trim();
  const description = document.getElementById('ch-desc').value.trim();

  if (!name) { showToast('Channel name is required', 'warning'); return; }

  const btnText = document.getElementById('ch-btn-text');
  const spinner = document.getElementById('ch-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const data = { 
      name, 
      url, 
      description, 
      section: currentSection,
      is_public: document.getElementById('chan-public').checked
    };
    
    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); spinner.classList.add('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    if (editId) {
      delete data.section;
      await ChannelsService.updateChannel(editId, data);
      showToast('Channel updated! ✅', 'success');
    } else {
      data.created_by = userProfile.id;
      await ChannelsService.createChannel(data);
      showToast('Channel created! 🎉', 'success');
    }
    
    clearTimeout(safetyTimeout);
    closeModal('channel-modal-overlay');
    await loadChannelsData(userProfile);
  } catch (err) {
    console.error('Save Channel Error:', err);
    showToast('Failed: ' + err.message, 'error');
  } finally {
    btnText.classList.remove('hidden'); spinner.classList.add('hidden');
  }
}

async function deleteChannel(channelId, userProfile) {
  const confirmed = await showConfirmModal('Delete Channel', 'Delete this channel and ALL its videos? This cannot be undone.');
  if (!confirmed) return;

  try {
    await ChannelsService.deleteChannel(channelId);
    showToast('Channel deleted', 'success');
    await loadChannelsData(userProfile);
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
}

// ===========================
// VIDEOS VIEW (inside a channel)
// ===========================

async function openChannelVideos(channelId, userProfile, initialStatus = 'all') {
  clearSubscriptions();
  const channel = allChannels.find(c => c.id === channelId);
  if (!channel) return;
  currentChannel = channel;
  activeHistoryDate = null;
  activeHistoryChannelId = null;

  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_videos');
  const canDelete = hasPermission(userProfile.role, 'delete_videos');

  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-channels">← Back to Channels</button>

      <div class="page-header">
        <div>
          <h1>📺 ${sanitize(channel.name)}</h1>
          <p class="subtitle">${channel.url ? `<a href="${sanitize(channel.url)}" target="_blank" style="color:var(--primary)">View Channel ↗</a>` : 'YouTube Channel'}</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn-ghost" id="btn-yt-history">📜 Daily History</button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-new-video">+ Add Video</button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="video-search" placeholder="Search videos..." />
        </div>
        <div class="filter-chips">
          <button class="filter-chip active" data-vstatus="all">All</button>
          <button class="filter-chip" data-vstatus="draft">📝 Draft</button>
          <button class="filter-chip" data-vstatus="scripting">✍️ Script</button>
          <button class="filter-chip" data-vstatus="recording">🎙️ Record</button>
          <button class="filter-chip" data-vstatus="editing">✂️ Edit</button>
          <button class="filter-chip" data-vstatus="uploaded">☁️ Upload</button>
          <button class="filter-chip" data-vstatus="published">🚀 Live</button>
          <button class="filter-chip" data-vstatus="done">✅ Done</button>
        </div>
      </div>

      <!-- Videos List -->
      <div id="videos-list">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    ${getVideoModalHTML()}
  `;

  await loadVideosData(userProfile, initialStatus);
  initVideoEvents(userProfile);

  // Real-time subscription for videos in this channel
  const videoSub = ChannelsService.subscribeToVideos(channelId, () => {
    console.log(`Real-time update: Videos for channel ${channelId} changed`);
    const activeStatus = document.querySelector('[data-vstatus].active')?.dataset.vstatus || 'all';
    const search = document.getElementById('video-search')?.value || '';
    loadVideosData(userProfile, activeStatus, search);
  });
  addSubscription(videoSub);

  // If initialStatus is not 'all', manually activate the chip
  if (initialStatus !== 'all') {
    document.querySelectorAll('[data-vstatus]').forEach(c => {
      c.classList.toggle('active', c.dataset.vstatus === initialStatus);
    });
  }
}

async function loadVideosData(userProfile, statusFilter = 'all', search = '') {
  try {
    allVideos = await ChannelsService.getVideos(currentChannel.id, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined
    });
    await renderVideosList(allVideos, userProfile);
  } catch (err) {
    console.error('Videos error:', err);
    showToast('Videos: ' + (err.message || err.toString() || 'Unknown error'), 'error');
  }
}

function renderVideosList(videos, userProfile) {
  const container = document.getElementById('videos-list');
  if (!container) return; // View changed
  const canEdit = hasPermission(userProfile.role, 'edit_videos');
  const canDelete = hasPermission(userProfile.role, 'delete_videos');

  if (!videos.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎬</div>
        <h3>No videos yet</h3>
        <p>Add your first video to this channel!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map((vid, i) => {
    const st = VIDEO_STATUSES[vid.status] || VIDEO_STATUSES.draft;
    const assignee = vid.assigned_profile;
    
    // Per-item edit permission: Admins+ OR the assigned user
    const canEditItem = canEdit || vid.assigned_to === userProfile.id;
    
    return `
      <div class="item-card fade-in stagger-${Math.min(i + 1, 5)}" data-select-id="${vid.id}">
        <div class="item-card-header">
          <div style="display:flex;align-items:flex-start;gap:10px">
            ${canDelete ? `<input type="checkbox" class="item-card-select" data-select-check="${vid.id}" />` : ''}
            <div>
              <div class="item-card-title">${sanitize(vid.title)}</div>
              <div class="item-card-meta">
                <span class="badge ${st.class}">${st.icon} ${st.label}</span>
                ${assignee ? `
                  <span style="display:flex;align-items:center;gap:4px">
                    <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px">${getInitials(assignee.full_name)}</span>
                    ${assignee.full_name}
                  </span>
                ` : ''}
                <span>📅 ${timeAgo(vid.created_at)}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            ${canEditItem ? `<button class="btn btn-ghost btn-sm" data-edit-video="${vid.id}">✏️</button>` : ''}
            ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-video="${vid.id}">🗑️</button>` : ''}
          </div>
        </div>
        <div class="link-fields-grid">
          ${renderLinkField('📝', 'Script', vid.script_link)}
          ${renderLinkField('🎙️', 'Voiceover', vid.voiceover_link)}
          ${renderLinkField('🖼️', 'Thumbnail', vid.thumbnail_link)}
          ${renderLinkField('🔗', 'Video', vid.video_link)}
        </div>
        ${(vid.script_v2_link || vid.voiceover_v2_link || vid.thumbnail_v2_link || vid.video_v2_link) ? `
        <div style="margin-top:var(--space-md);padding-top:var(--space-sm);border-top:1px dashed var(--border-color)">
          <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-xs);font-weight:600">VERSION 2</div>
          <div class="link-fields-grid">
            ${renderLinkField('📝', 'Script V2', vid.script_v2_link)}
            ${renderLinkField('🎙️', 'Voiceover V2', vid.voiceover_v2_link)}
            ${renderLinkField('🖼️', 'Thumbnail V2', vid.thumbnail_v2_link)}
            ${renderLinkField('🔗', 'Video V2', vid.video_v2_link)}
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-video]').forEach(btn => {
    btn.addEventListener('click', () => editVideo(btn.dataset.editVideo));
  });
  container.querySelectorAll('[data-delete-video]').forEach(btn => {
    btn.addEventListener('click', () => deleteVideo(btn.dataset.deleteVideo, userProfile));
  });

  // Multi-select bindings
  initVideoSelectionSystem(container, userProfile);
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
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname);
  } catch { return url.slice(0, 30) + '…'; }
}

function initVideoEvents(userProfile) {
  document.getElementById('btn-back-channels')?.addEventListener('click', () => renderChannelsList(userProfile));
  document.getElementById('btn-new-video')?.addEventListener('click', () => openNewVideo());

  document.querySelectorAll('[data-vstatus]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-vstatus]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const search = document.getElementById('video-search')?.value || '';
      loadVideosData(userProfile, chip.dataset.vstatus, search);
    });
  });

  document.getElementById('video-search')?.addEventListener('input', debounce((e) => {
    const activeStatus = document.querySelector('[data-vstatus].active')?.dataset.vstatus || 'all';
    loadVideosData(userProfile, activeStatus, e.target.value);
  }, 300));

  document.getElementById('video-modal-close')?.addEventListener('click', () => closeModal('video-modal-overlay'));
  document.getElementById('video-cancel')?.addEventListener('click', () => closeModal('video-modal-overlay'));
  document.getElementById('video-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'video-modal-overlay') closeModal('video-modal-overlay');
  });

  document.getElementById('video-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveVideo(userProfile);
  });

  document.getElementById('v2-toggle-btn')?.addEventListener('click', () => {
    const v2Content = document.getElementById('v2-content');
    const v2Icon = document.getElementById('v2-toggle-icon');
    if (v2Content.classList.contains('hidden')) {
      v2Content.classList.remove('hidden');
      v2Icon.textContent = '▲';
    } else {
      v2Content.classList.add('hidden');
      v2Icon.textContent = '▼';
    }
  });

  document.getElementById('btn-yt-history')?.addEventListener('click', () => {
    openDailyHistory(currentChannel.id, userProfile);
  });
}

function openNewVideo() {
  document.getElementById('video-modal-title').textContent = 'Add Video';
  document.getElementById('vid-btn-text').textContent = 'Add Video';
  document.getElementById('vid-edit-id').value = '';
  document.getElementById('video-form').reset();
  
  // Collapse V2 section by default on new
  document.getElementById('v2-content')?.classList.add('hidden');
  if (document.getElementById('v2-toggle-icon')) document.getElementById('v2-toggle-icon').textContent = '▼';

  populateAssignDropdown('vid-assign');
  document.getElementById('video-modal-overlay').classList.add('active');
}

function editVideo(videoId) {
  const vid = allVideos.find(v => v.id === videoId);
  if (!vid) return;
  document.getElementById('video-modal-title').textContent = 'Edit Video';
  document.getElementById('vid-btn-text').textContent = 'Save Changes';
  document.getElementById('vid-edit-id').value = videoId;
  document.getElementById('vid-title').value = vid.title;
  document.getElementById('vid-script').value = vid.script_link || '';
  document.getElementById('vid-voiceover').value = vid.voiceover_link || '';
  document.getElementById('vid-thumbnail').value = vid.thumbnail_link || '';
  document.getElementById('vid-video').value = vid.video_link || '';
  
  document.getElementById('vid-script-v2').value = vid.script_v2_link || '';
  document.getElementById('vid-voiceover-v2').value = vid.voiceover_v2_link || '';
  document.getElementById('vid-thumbnail-v2').value = vid.thumbnail_v2_link || '';
  document.getElementById('vid-video-v2').value = vid.video_v2_link || '';

  // Auto-expand V2 if any data exists
  const hasV2Data = vid.script_v2_link || vid.voiceover_v2_link || vid.thumbnail_v2_link || vid.video_v2_link;
  const v2Content = document.getElementById('v2-content');
  const v2Icon = document.getElementById('v2-toggle-icon');
  if (hasV2Data) {
    v2Content?.classList.remove('hidden');
    if (v2Icon) v2Icon.textContent = '▲';
  } else {
    v2Content?.classList.add('hidden');
    if (v2Icon) v2Icon.textContent = '▼';
  }

  document.getElementById('vid-status').value = vid.status;
  populateAssignDropdown('vid-assign', vid.assigned_to);
  document.getElementById('video-modal-overlay').classList.add('active');
}

function populateAssignDropdown(selectId, selectedId = '') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">— Unassigned —</option>` +
    teamMembers.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.full_name} (${m.role})</option>`).join('');
}

async function saveVideo(userProfile) {
  const editId = document.getElementById('vid-edit-id').value;
  const title = document.getElementById('vid-title').value.trim();
  if (!title) { showToast('Video title is required', 'warning'); return; }

  const btnText = document.getElementById('vid-btn-text');
  const spinner = document.getElementById('vid-btn-spinner');
  btnText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const assignedTo = document.getElementById('vid-assign').value || null;
    let status = document.getElementById('vid-status').value;

    const v1Link = document.getElementById('vid-video').value.trim();
    const v2Link = document.getElementById('vid-video-v2').value.trim();
    const hasAnyLink = !!(v1Link || v2Link);

    // CRM Automation: Handle Status Transitions
    if (hasAnyLink) {
      status = 'done';
    } else if (!assignedTo) {
      status = 'draft'; // Strictly follow: unassigned -> draft
    } else {
      // Assigned but NO link: Ensure it's in an active state
      if (status === 'done' || status === 'uploaded' || status === 'published' || status === 'draft') {
        status = 'editing';
      }
    }

    const data = {
      title,
      script_link: document.getElementById('vid-script').value.trim() || null,
      voiceover_link: document.getElementById('vid-voiceover').value.trim() || null,
      thumbnail_link: document.getElementById('vid-thumbnail').value.trim() || null,
      video_link: v1Link || null,
      script_v2_link: document.getElementById('vid-script-v2').value.trim() || null,
      voiceover_v2_link: document.getElementById('vid-voiceover-v2').value.trim() || null,
      thumbnail_v2_link: document.getElementById('vid-thumbnail-v2').value.trim() || null,
      video_v2_link: v2Link || null,
      assigned_to: assignedTo,
      status: status
    };

    // Safety Timeout: Reset UI if backend hangs for > 30s
    const safetyTimeout = setTimeout(() => {
      btnText.classList.remove('hidden'); spinner.classList.add('hidden');
      showToast('Request is taking too long. Please check your connection.', 'warning');
    }, 30000);

    if (editId) {
      const oldVid = allVideos.find(v => v.id === editId);
      await ChannelsService.updateVideo(editId, data);
      showToast('Video updated! ✅', 'success');

    } else {
      data.channel_id = currentChannel.id;
      data.created_by = userProfile.id;
      await ChannelsService.createVideo(data);
      showToast('Video added! 🎉', 'success');

    }
    
    clearTimeout(safetyTimeout);
    closeModal('video-modal-overlay');
    
    if (activeHistoryDate && activeHistoryChannelId) {
      await renderHistoricalVideosView(activeHistoryChannelId, activeHistoryDate, userProfile);
    } else {
      await loadVideosData(userProfile);
    }
  } catch (err) {
    console.error('Save Video Error:', err);
    showToast('Failed: ' + err.message, 'error');
  } finally {
    btnText.classList.remove('hidden'); spinner.classList.add('hidden');
  }
}

async function deleteVideo(videoId, userProfile) {
  const confirmed = await showConfirmModal('Delete Video', 'Are you sure you want to delete this video?');
  if (!confirmed) return;

  try {
    await ChannelsService.deleteVideo(videoId);
    showToast('Video deleted', 'success');
    
    if (activeHistoryDate && activeHistoryChannelId) {
      await renderHistoricalVideosView(activeHistoryChannelId, activeHistoryDate, userProfile);
    } else {
      await loadVideosData(userProfile);
    }
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ===========================
// GLOBAL VIDEOS VIEW (Flat List)
// ===========================

async function renderGlobalVideos(userProfile, filterType) {
  clearSubscriptions();
  currentChannel = null;
  const mainContent = document.getElementById('main-content');
  
  const titles = {
    unassigned: '📂 Unassigned Videos',
    assigned: '📝 Assigned Videos',
    done: '✅ Done Videos'
  };

  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-channels">← Back to Channels</button>

      <div class="page-header">
        <div>
          <h1>${titles[filterType] || 'All Videos'}</h1>
          <p class="subtitle">Global list of videos across all channels (${currentSection})</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-box" style="flex:1;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="global-video-search" placeholder="Search across all channels..." />
        </div>
      </div>

      <!-- Videos List -->
      <div id="global-videos-list">
        <div class="skeleton" style="height:120px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:120px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-channels')?.addEventListener('click', () => renderChannelsList(userProfile));
  
  const searchInput = document.getElementById('global-video-search');
  searchInput?.addEventListener('input', debounce(() => {
    loadGlobalVideosData(userProfile, filterType, searchInput.value);
  }, 300));

  await loadGlobalVideosData(userProfile, filterType);

  // Real-time for global list: Listen to all videos in this section
  const globalVideoSub = ChannelsService.subscribeToVideos(null, () => {
    console.log('Real-time update: Global Videos list changed');
    const search = document.getElementById('global-video-search')?.value || '';
    loadGlobalVideosData(userProfile, filterType, search);
  });
  addSubscription(globalVideoSub);
}

async function loadGlobalVideosData(userProfile, filterType, search = '') {
  const container = document.getElementById('global-videos-list');
  if (!container) return; // View changed, stop update
  try {
    const options = { section: currentSection, search };
    if (filterType === 'unassigned') options.unassigned = true;
    if (filterType === 'assigned') options.unassigned = false;

    let videos = await ChannelsService.getVideos(null, options);

    // Hide unassigned videos from non-admin users
    const isAdmin = ['owner', 'admin', 'manager'].includes(userProfile.role);
    if (!isAdmin) {
      videos = videos.filter(v => v.assigned_to);
    }

    // Manual filtering for complex buckets
    if (filterType === 'in-progress') {
      videos = videos.filter(v => ['scripting', 'recording', 'editing'].includes(v.status));
    }
    if (filterType === 'published') {
      videos = videos.filter(v => v.status === 'published');
    }
    if (filterType === 'assigned') {
      videos = videos.filter(v => v.status !== 'published' && v.status !== 'done' && v.status !== 'uploaded');
    }
    if (filterType === 'done') {
      videos = videos.filter(v => v.status === 'published' || v.status === 'done');
    }
    if (filterType === 'uploaded') {
      videos = videos.filter(v => v.status === 'uploaded');
    }

    renderGlobalVideosGrid(videos, userProfile, container);
  } catch (err) {
    console.error('Global videos error:', err);
    showToast('Failed to load global videos', 'error');
  }
}

function renderGlobalVideosGrid(videos, userProfile, container) {
  if (!container) return; // View changed
  if (!videos.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎬</div>
        <h3>No videos found</h3>
        <p>Try a different search or filter!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map(vid => {
    const st = VIDEO_STATUSES[vid.status] || VIDEO_STATUSES.draft;
    const assignee = vid.assigned_profile;
    const channelName = vid.yt_channels?.name || 'Unknown Channel';
    
    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div style="font-size:var(--font-xs);color:var(--primary);font-weight:600;margin-bottom:4px">📺 ${sanitize(channelName)}</div>
            <div class="item-card-title">${sanitize(vid.title)}</div>
            <div class="item-card-meta">
              <span class="badge ${st.class}">${st.icon} ${st.label}</span>
              ${assignee ? `
                <span style="display:flex;align-items:center;gap:4px">
                  <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px;background-image:url(${assignee.avatar_url || ''});background-size:cover">${assignee.avatar_url ? '' : getInitials(assignee.full_name)}</span>
                  ${assignee.full_name}
                </span>
              ` : '<span style="color:var(--text-danger)">⚠️ Unassigned</span>'}
              <span>📅 ${timeAgo(vid.created_at)}</span>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.openVideoInChannel('${vid.channel_id}', '${vid.id}')">👁️ Go to Channel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Helper to bridge global list to channel view
window.openVideoInChannel = async (channelId, videoId) => {
  if (!moduleUserProfile) {
    showToast('Session error, please refresh', 'error');
    return;
  }
  
  // Transition to channel view
  await openChannelVideos(channelId, moduleUserProfile);
  
  // Optional: Scroll to or highlight the specific video if needed
  // For now, just opening the channel is what was requested.
  showToast('Channel opened', 'success');
};

// ===========================
// DAILY HISTORY EXPLORER
// ===========================

async function openDailyHistory(channelId, userProfile) {
  clearSubscriptions();
  const mainContent = document.getElementById('main-content');
  
  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-to-channel">← Back to Channel</button>
      
      <div class="page-header">
        <div>
          <h1>📜 Daily History</h1>
          <p class="subtitle">Videos archived for ${sanitize(currentChannel.name)} (Older than 24h)</p>
        </div>
      </div>

      <div id="history-content">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

    ${getVideoModalHTML()}
  `;

  document.getElementById('btn-back-to-channel').addEventListener('click', () => {
    openChannelVideos(channelId, userProfile);
  });

  initVideoEvents(userProfile);
  await loadHistoryDates(channelId, userProfile);
}

async function loadHistoryDates(channelId, userProfile) {
  const container = document.getElementById('history-content');
  try {
    const dates = await ChannelsService.getArchivedVideoDates(channelId);
    
    if (!container) return;
    if (!dates.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>Your archive is empty</h3>
          <p>Videos move here automatically after 24 hours.</p>
        </div>
      `;
      return;
    }

    if (!container) return;
    container.innerHTML = `
      <div class="project-grid">
        ${dates.map(date => `
          <div class="project-card clickable" data-history-date="${date}" style="position:relative">
            ${hasPermission(userProfile.role, 'delete_anything') ? `<button class="btn btn-ghost btn-sm" data-delete-hist-folder="${date}" style="position:absolute;top:8px;right:8px;z-index:2" title="Delete this folder">🗑️</button>` : ''}
            <div class="project-card-header">
              <div class="project-card-icon">📁</div>
              <div>
                <div class="project-card-title">${formatArchiveDate(date)}</div>
                <div class="project-card-subtitle">Archives from this day</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-history-date]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-hist-folder]')) return;
        renderHistoricalVideosView(channelId, card.dataset.historyDate, userProfile);
      });
    });

    container.querySelectorAll('[data-delete-hist-folder]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const date = btn.dataset.deleteHistFolder;
        const confirmed = await showConfirmModal('Delete History Folder', `Delete ALL videos from ${formatArchiveDate(date)}? This cannot be undone.`);
        if (!confirmed) return;
        try {
          await ChannelsService.deleteArchivedByDate(channelId, date);
          showToast('History folder deleted', 'success');
          await loadHistoryDates(channelId, userProfile);
        } catch (err) {
          showToast('Failed to delete: ' + err.message, 'error');
        }
      });
    });

  } catch (err) {
    console.error('History dates error:', err);
    showToast('Failed to load history', 'error');
  }
}

async function renderHistoricalVideosView(channelId, date, userProfile) {
  activeHistoryDate = date;
  activeHistoryChannelId = channelId;
  const container = document.getElementById('history-content');
  if (!container) return;
  
  container.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-to-history" style="margin-bottom:var(--space-md)">← Back to Dates</button>
      <div class="section-header" style="margin-bottom:var(--space-md)">
        <h2>Videos from ${formatArchiveDate(date)}</h2>
      </div>
      <div id="historical-videos-list">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-to-history').addEventListener('click', () => {
    activeHistoryDate = null;
    activeHistoryChannelId = null;
    loadHistoryDates(channelId, userProfile);
  });

  try {
    const videos = await ChannelsService.getVideos(channelId, { includeArchived: true });
    // Filter for the specific date (YYYY-MM-DD match)
    const dailyVideos = videos.filter(v => v.created_at.startsWith(date));
    allVideos = dailyVideos; // Update global state so editVideo can find them
    
    const listContainer = document.getElementById('historical-videos-list');
    if (!listContainer) return;
    
    if (!dailyVideos.length) {
      listContainer.innerHTML = `<p class="text-muted">No videos found for this date.</p>`;
      return;
    }

    const canDelete = hasPermission(userProfile.role, 'delete_videos');

    if (!listContainer) return;
    listContainer.innerHTML = dailyVideos.map(vid => {
      const st = VIDEO_STATUSES[vid.status] || VIDEO_STATUSES.draft;
      const assignee = vid.assigned_profile;
      
      return `
        <div class="item-card">
          <div class="item-card-header">
            <div>
              <div class="item-card-title">${sanitize(vid.title)}</div>
              <div class="item-card-meta">
                <span class="badge ${st.class}">${st.icon} ${st.label}</span>
                ${assignee ? `
                  <span style="display:flex;align-items:center;gap:4px">
                    <span class="avatar avatar-xs" style="background:${getAvatarColor(assignee.full_name)};width:20px;height:20px;font-size:8px">${getInitials(assignee.full_name)}</span>
                    ${assignee.full_name}
                  </span>
                ` : ''}
                <span>📅 Created ${timeAgo(vid.created_at)}</span>
              </div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" data-edit-hist-video="${vid.id}">✏️</button>
              ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-hist-video="${vid.id}">🗑️</button>` : ''}
            </div>
          </div>
          <div class="link-fields-grid">
            ${renderLinkField('📝', 'Script', vid.script_link)}
            ${renderLinkField('🎙️', 'Voiceover', vid.voiceover_link)}
            ${renderLinkField('🖼️', 'Thumbnail', vid.thumbnail_link)}
            ${renderLinkField('🔗', 'Video', vid.video_link)}
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('[data-edit-hist-video]').forEach(btn => {
      btn.addEventListener('click', () => editVideo(btn.dataset.editHistVideo));
    });
    listContainer.querySelectorAll('[data-delete-hist-video]').forEach(btn => {
      btn.addEventListener('click', () => deleteVideo(btn.dataset.deleteHistVideo, userProfile));
    });

  } catch (err) {
    console.error('Historical videos error:', err);
    showToast('Failed to load historical videos', 'error');
  }
}

function formatArchiveDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===========================
// MULTI-SELECT + BULK ACTION
// ===========================
function initVideoSelectionSystem(container, userProfile) {
  document.getElementById('bulk-bar')?.remove();
  
  const bar = document.createElement('div');
  bar.id = 'bulk-bar';
  bar.className = 'bulk-action-bar';
  bar.innerHTML = `
    <span class="bulk-count" id="bulk-count">0 selected</span>
    <button class="btn btn-secondary btn-sm" id="bulk-select-all">\u2611 Select All</button>
    <button class="btn btn-secondary btn-sm" id="bulk-deselect">\u2716 Clear</button>
    <button class="btn btn-primary btn-sm" id="bulk-delete" style="background:var(--danger,#e74c3c);border-color:var(--danger,#e74c3c)">\ud83d\uddd1\ufe0f Delete Selected</button>
  `;
  document.body.appendChild(bar);
  
  const selectedIds = new Set();
  
  function updateBar() {
    const count = selectedIds.size;
    document.getElementById('bulk-count').textContent = `${count} selected`;
    bar.classList.toggle('visible', count > 0);
  }
  
  container.querySelectorAll('[data-select-check]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.selectCheck;
      const card = container.querySelector(`[data-select-id="${id}"]`);
      if (cb.checked) { selectedIds.add(id); card?.classList.add('selected'); }
      else { selectedIds.delete(id); card?.classList.remove('selected'); }
      updateBar();
    });
  });
  
  document.getElementById('bulk-select-all').addEventListener('click', () => {
    container.querySelectorAll('[data-select-check]').forEach(cb => {
      cb.checked = true;
      selectedIds.add(cb.dataset.selectCheck);
      container.querySelector(`[data-select-id="${cb.dataset.selectCheck}"]`)?.classList.add('selected');
    });
    updateBar();
  });
  
  document.getElementById('bulk-deselect').addEventListener('click', () => {
    container.querySelectorAll('[data-select-check]').forEach(cb => cb.checked = false);
    container.querySelectorAll('.item-card.selected').forEach(c => c.classList.remove('selected'));
    selectedIds.clear();
    updateBar();
  });
  
  document.getElementById('bulk-delete').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    const confirmed = await showConfirmModal('Bulk Delete', `Delete ${selectedIds.size} selected video(s)? This cannot be undone.`);
    if (!confirmed) return;
    
    try {
      for (const id of [...selectedIds]) {
        await ChannelsService.deleteVideo(id);
      }
      showToast(`${selectedIds.size} video(s) deleted`, 'success');
      selectedIds.clear();
      bar.classList.remove('visible');
      
      const activeStatus = document.querySelector('[data-vstatus].active')?.dataset.vstatus || 'all';
      const search = document.getElementById('video-search')?.value || '';
      await loadVideosData(userProfile, activeStatus, search);
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast('Failed to delete some items', 'error');
    }
  });
}
