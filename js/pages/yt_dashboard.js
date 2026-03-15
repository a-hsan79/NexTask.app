// ===========================
// NexTask — YT Automation Dashboard (Channel → Video)
// ===========================

import { ChannelsService } from '../services/channels.js';
import { TeamService } from '../services/team.js';
import { hasPermission } from '../utils/permissions.js';
import { getInitials, getAvatarColor, showToast, sanitize, timeAgo, debounce, showConfirmModal } from '../utils/helpers.js';

let allChannels = [];
let allVideos = [];
let teamMembers = [];
let currentChannel = null;
let currentSection = 'automation';

const VIDEO_STATUSES = {
  draft:     { label: 'Draft',     icon: '📝', class: 'status-draft' },
  scripting: { label: 'Scripting', icon: '✍️', class: 'status-scripting' },
  recording: { label: 'Recording', icon: '🎙️', class: 'status-recording' },
  editing:   { label: 'Editing',   icon: '✂️', class: 'status-editing' },
  uploaded:  { label: 'Uploaded',  icon: '☁️', class: 'status-uploaded' },
  published: { label: 'Published', icon: '🚀', class: 'status-published' }
};

export async function renderYTDashboardPage(userProfile, section = 'automation') {
  currentChannel = null;
  currentSection = section;
  teamMembers = await TeamService.getMemberOptions();
  await renderChannelsList(userProfile);
}

// ===========================
// CHANNELS LIST VIEW
// ===========================

async function renderChannelsList(userProfile) {
  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_tasks');

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
        <div class="stat-card purple">
          <div class="stat-icon">📺</div>
          <div class="stat-info">
            <div class="stat-label">Channels</div>
            <div class="stat-value" id="yt-channels-count">—</div>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">🎬</div>
          <div class="stat-info">
            <div class="stat-label">Total Videos</div>
            <div class="stat-value" id="yt-videos-count">—</div>
          </div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">✂️</div>
          <div class="stat-info">
            <div class="stat-label">In Progress</div>
            <div class="stat-value" id="yt-in-progress">—</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🚀</div>
          <div class="stat-info">
            <div class="stat-label">Published</div>
            <div class="stat-value" id="yt-published">—</div>
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
}

async function loadChannelsData(userProfile, search = '') {
  try {
    allChannels = await ChannelsService.getChannels(currentSection);
    const stats = await ChannelsService.getAllVideoStats(currentSection);

    document.getElementById('yt-channels-count').textContent = allChannels.length;
    document.getElementById('yt-videos-count').textContent = stats.total;
    document.getElementById('yt-in-progress').textContent = stats.scripting + stats.recording + stats.editing;
    document.getElementById('yt-published').textContent = stats.published;

    let filtered = allChannels;
    if (search) {
      const s = search.toLowerCase();
      filtered = allChannels.filter(c => c.name.toLowerCase().includes(s));
    }

    renderChannelsGrid(filtered, userProfile);
  } catch (err) {
    console.error('Channels error:', err);
    showToast('Failed to load channels', 'error');
  }
}

async function renderChannelsGrid(channels, userProfile) {
  const grid = document.getElementById('channels-grid');
  const canEdit = hasPermission(userProfile.role, 'edit_any_task');
  const canDelete = hasPermission(userProfile.role, 'delete_tasks');

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

  // Get video counts for each channel
  const countsPromises = channels.map(ch => ChannelsService.getChannelVideoCount(ch.id));
  const counts = await Promise.all(countsPromises);

  grid.innerHTML = channels.map((ch, i) => `
    <div class="project-card" data-channel-id="${ch.id}">
      <div class="project-card-actions">
        ${canEdit ? `<button class="btn btn-ghost btn-sm" data-edit-channel="${ch.id}" title="Edit">✏️</button>` : ''}
        ${canDelete ? `<button class="btn btn-ghost btn-sm" data-delete-channel="${ch.id}" title="Delete">🗑️</button>` : ''}
      </div>
      <div class="project-card-header">
        <div class="project-card-icon">📺</div>
        <div>
          <div class="project-card-title">${sanitize(ch.name)}</div>
          <div class="project-card-subtitle">${ch.url ? `<a href="${sanitize(ch.url)}" target="_blank" style="color:var(--primary)" onclick="event.stopPropagation()">View Channel ↗</a>` : 'No URL added'}</div>
        </div>
      </div>
      ${ch.description ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md)">${sanitize(ch.description).slice(0, 80)}</p>` : ''}
      <div class="project-card-stats">
        <div class="project-card-stat"><strong>${counts[i]}</strong> videos</div>
        <div class="project-card-stat">Created ${timeAgo(ch.created_at)}</div>
      </div>
    </div>
  `).join('');

  // Click channel card → open videos view
  grid.querySelectorAll('[data-channel-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-channel]') || e.target.closest('[data-delete-channel]')) return;
      openChannelVideos(card.dataset.channelId, userProfile);
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
    const data = { name, url, description, section: currentSection };
    if (editId) {
      delete data.section; // Don't change section on edit
      await ChannelsService.updateChannel(editId, data);
      showToast('Channel updated! ✅', 'success');
    } else {
      data.created_by = userProfile.id;
      await ChannelsService.createChannel(data);
      showToast('Channel created! 🎉', 'success');
    }
    closeModal('channel-modal-overlay');
    await loadChannelsData(userProfile);
  } catch (err) {
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

async function openChannelVideos(channelId, userProfile) {
  const channel = allChannels.find(c => c.id === channelId);
  if (!channel) return;
  currentChannel = channel;

  const mainContent = document.getElementById('main-content');
  const canCreate = hasPermission(userProfile.role, 'create_tasks');
  const canDelete = hasPermission(userProfile.role, 'delete_tasks');

  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-channels">← Back to Channels</button>

      <div class="page-header">
        <div>
          <h1>📺 ${sanitize(channel.name)}</h1>
          <p class="subtitle">${channel.url ? `<a href="${sanitize(channel.url)}" target="_blank" style="color:var(--primary)">View Channel ↗</a>` : 'YouTube Channel'}</p>
        </div>
        ${canCreate ? `<button class="btn btn-primary" id="btn-new-video">+ Add Video</button>` : ''}
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
        </div>
      </div>

      <!-- Videos List -->
      <div id="videos-list">
        <div class="skeleton" style="height:100px;margin-bottom:8px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>

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

  await loadVideosData(userProfile);
  initVideoEvents(userProfile);
}

async function loadVideosData(userProfile, statusFilter = 'all', search = '') {
  try {
    allVideos = await ChannelsService.getVideos(currentChannel.id, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined
    });
    renderVideosList(allVideos, userProfile);
  } catch (err) {
    console.error('Videos error:', err);
    showToast('Failed to load videos', 'error');
  }
}

function renderVideosList(videos, userProfile) {
  const container = document.getElementById('videos-list');
  const canEdit = hasPermission(userProfile.role, 'edit_any_task');
  const canDelete = hasPermission(userProfile.role, 'delete_tasks');

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

  container.innerHTML = videos.map(vid => {
    const st = VIDEO_STATUSES[vid.status] || VIDEO_STATUSES.draft;
    const assignee = vid.assigned_profile;
    
    // Per-item edit permission: Admins+ OR the assigned user
    const canEditItem = canEdit || vid.assigned_to === userProfile.id;
    
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
              <span>📅 ${timeAgo(vid.created_at)}</span>
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
    const data = {
      title,
      script_link: document.getElementById('vid-script').value.trim() || null,
      voiceover_link: document.getElementById('vid-voiceover').value.trim() || null,
      thumbnail_link: document.getElementById('vid-thumbnail').value.trim() || null,
      video_link: document.getElementById('vid-video').value.trim() || null,
      script_v2_link: document.getElementById('vid-script-v2').value.trim() || null,
      voiceover_v2_link: document.getElementById('vid-voiceover-v2').value.trim() || null,
      thumbnail_v2_link: document.getElementById('vid-thumbnail-v2').value.trim() || null,
      video_v2_link: document.getElementById('vid-video-v2').value.trim() || null,
      assigned_to: document.getElementById('vid-assign').value || null,
      status: document.getElementById('vid-status').value
    };

    if (editId) {
      await ChannelsService.updateVideo(editId, data);
      showToast('Video updated! ✅', 'success');
    } else {
      data.channel_id = currentChannel.id;
      data.created_by = userProfile.id;
      await ChannelsService.createVideo(data);
      showToast('Video added! 🎉', 'success');
    }
    closeModal('video-modal-overlay');
    await loadVideosData(userProfile);
  } catch (err) {
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
    await loadVideosData(userProfile);
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}
