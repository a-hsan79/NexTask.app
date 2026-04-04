import { AIService } from '../services/ai.js';
import { sanitize, showToast } from '../utils/helpers.js';

export async function renderAISEOPage(userProfile, initialNiche = '') {
  const mainContent = document.getElementById('main-content');
  
  mainContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="btn-back-yt-dash">← Back to Dashboard</button>
      <div class="page-header">
        <div>
          <h1>✨ AI SEO Studio</h1>
          <p class="subtitle">Research niches and optimize your video CTR with advanced AI</p>
        </div>
      </div>

      <div class="card seo-hero" style="padding:var(--space-xl); margin-bottom:var(--space-lg); text-align:center">
        <h2 style="margin-bottom:var(--space-md)">What's your next viral video topic?</h2>
        <div style="display:flex; gap:var(--space-md); max-width:600px; margin:0 auto">
          <input type="text" id="seo-niche-input" class="form-input" placeholder="e.g. US Aircraft Carriers in Middle East conflict" value="${sanitize(initialNiche)}" />
          <button class="btn btn-primary" id="btn-run-seo">✨ Run Agent</button>
        </div>
      </div>

      <div id="seo-workflow-container" class="hidden">
        <div class="workflow-stepper" style="display:flex; justify-content:center; gap:var(--space-xl); margin-bottom:var(--space-lg)">
            <div class="step" id="step-1">
                <span class="step-num">1</span>
                <span>Deep Research</span>
            </div>
            <div class="step" id="step-2">
                <span class="step-num">2</span>
                <span>CTR Optimization</span>
            </div>
        </div>
        
        <div id="seo-results">
            <div class="skeleton" style="height:200px; border-radius:var(--radius-lg)"></div>
        </div>
      </div>
    </div>
  `;

  initSEOEvents(userProfile);
  if (initialNiche) {
    document.getElementById('btn-run-seo').click();
  }
}

function initSEOEvents(userProfile) {
  const btnRun = document.getElementById('btn-run-seo');
  const inputNiche = document.getElementById('seo-niche-input');

  document.getElementById('btn-back-yt-dash')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'yt_dashboard' } }));
  });
  
  btnRun?.addEventListener('click', async () => {
    const niche = inputNiche.value.trim();
    if (!niche) { showToast('Please enter a niche topic', 'warning'); return; }
    
    const workflow = document.getElementById('seo-workflow-container');
    const results = document.getElementById('seo-results');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    
    workflow.classList.remove('hidden');
    step1.classList.add('active');
    step2.classList.remove('active');
    results.innerHTML = `<div class="loader-container"><div class="spinner"></div><p>AI is researching Low Competition angles...</p></div>`;
    
    try {
      // Step 1: Research
      const researchData = await AIService.runResearchWorkflow(niche);
      step1.classList.remove('active');
      step1.innerHTML = `<span class="step-num">✅</span> <span>Deep Research</span>`;
      
      // Step 2: Optimization
      step2.classList.add('active');
      results.innerHTML += `<div class="loader-container"><div class="spinner"></div><p>Generating High-CTR Titles & Description...</p></div>`;
      
      const optResult = await AIService.runOptimizationWorkflow(researchData);
      step2.classList.remove('active');
      step2.innerHTML = `<span class="step-num">✅</span> <span>CTR Optimization</span>`;
      
      renderSEOResults(researchData, optResult);
    } catch (err) {
      showToast(err.message, 'error');
      results.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
    }
  });
}

function renderSEOResults(research, optimization) {
  const container = document.getElementById('seo-results');
  
  // Parse Titles
  const titles = optimization.match(/\[TITLE\](.*?)\[\/TITLE\]/g)?.map(t => t.replace(/\[\/?TITLE\]/g, '').trim()) || [];
  
  // Parse Description (Remove TAGS for the description box)
  let fullDesc = optimization.split('[DESC]')[1]?.split('[/DESC]')[0] || optimization;
  const tags = fullDesc.split('[TAGS]')[1]?.split('[/TAGS]')[0] || "";
  const cleanDesc = fullDesc.replace(/\[TAGS\].*?\[\/TAGS\]/s, '').trim();

  container.innerHTML = `
    <div class="results-grid" style="display:grid; grid-template-columns:1fr 1.2fr; gap:var(--space-lg); animation: slideUp 0.4s easeOut">
      <div class="card" style="padding:var(--space-lg)">
        <h3 style="margin-bottom:var(--space-md)">🔍 Strategic Angles</h3>
        <div class="ai-text-content" style="white-space:pre-wrap; font-size:var(--font-sm); opacity:0.9">
          ${sanitize(research)}
        </div>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:var(--space-lg)">
        <!-- Titles Section -->
        <div class="card" style="padding:var(--space-lg)">
          <h3 style="margin-bottom:var(--space-md)">🔥 High-CTR Titles</h3>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm)">
            ${titles.map((t, i) => `
              <div class="title-copy-row" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md)">
                <span style="font-size:var(--font-sm)">${sanitize(t)}</span>
                <button class="btn btn-ghost btn-sm btn-copy" data-copy="${sanitize(t)}">📋</button>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Description Section -->
        <div class="card" style="padding:var(--space-lg)">
          <h3 style="margin-bottom:var(--space-md)">📝 Ready Description Template</h3>
          <div style="background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md); font-family:monospace; font-size:var(--font-xs); white-space:pre-wrap; max-height:250px; overflow-y:auto">
            ${sanitize(cleanDesc)}
          </div>
          <button class="btn btn-secondary btn-sm btn-copy" data-copy="${sanitize(cleanDesc)}" style="width:100%; margin-top:var(--space-md)">Copy Full Description</button>
        </div>

        <!-- Tags Section -->
        ${tags ? `
        <div class="card" style="padding:var(--space-lg)">
          <h3 style="margin-bottom:var(--space-md)">🏷️ High-CTR Tags</h3>
          <div style="background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md); font-family:monospace; font-size:var(--font-xs); color:var(--primary-light)">
            ${sanitize(tags)}
          </div>
          <button class="btn btn-secondary btn-sm btn-copy" data-copy="${sanitize(tags)}" style="width:100%; margin-top:var(--space-md)">Copy All Tags</button>
        </div>
        ` : ''}
      </div>
    </div>
  `;
  
  container.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      showToast('Copied to clipboard!', 'success');
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = btn.classList.contains('btn-ghost') ? '📋' : 'Copy Template', 2000);
    });
  });
}
