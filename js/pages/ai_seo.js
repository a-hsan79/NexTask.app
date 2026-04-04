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
        <div style="display:flex; flex-direction:column; gap:var(--space-md); max-width:600px; margin:0 auto">
          <div style="display:flex; gap:var(--space-md); width:100%; position:relative">
            <input type="text" id="seo-niche-input" class="form-input" placeholder="e.g. US Aircraft Carriers in Middle East conflict" value="${sanitize(initialNiche)}" style="padding-left: 45px" />
            <button class="btn-icon" id="btn-attach-file" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); opacity:0.7; font-size:1.2rem" title="Attach image/file">📎</button>
            <input type="file" id="seo-file-input" class="hidden" accept="image/*,application/pdf,text/plain" />
            <button class="btn btn-primary" id="btn-run-seo">✨ Run Agent</button>
          </div>
          <div id="attachment-preview-container" class="hidden" style="margin-top:var(--space-sm)"></div>
        </div>
      </div>

      <div id="seo-workflow-container" class="hidden">
        <div class="workflow-stepper" style="display:flex; justify-content:center; gap:var(--space-xl); margin-bottom:var(--space-lg)">
            <div class="step" id="step-1">
                <span class="step-num">1</span>
                <span>Research</span>
            </div>
            <div class="step" id="step-2">
                <span class="step-num">2</span>
                <span>Titles</span>
            </div>
            <div class="step" id="step-3">
                <span class="step-num">3</span>
                <span>Final SEO Pack</span>
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
  const btnAttach = document.getElementById('btn-attach-file');
  const inputFile = document.getElementById('seo-file-input');
  const previewContainer = document.getElementById('attachment-preview-container');

  let currentAttachments = [];

  document.getElementById('btn-back-yt-dash')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'yt_dashboard' } }));
  });

  btnAttach?.addEventListener('click', () => inputFile.click());

  inputFile?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('File too large (max 5MB)', 'error');
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        currentAttachments.push(base64);
        renderAttachmentPreview(file, base64);
      } catch (err) {
        showToast('Error reading file', 'error');
      }
    }
    inputFile.value = ''; // Reset for next selection
  });

  function renderAttachmentPreview(file, base64) {
    previewContainer.classList.remove('hidden');
    const isImage = file.type.startsWith('image/');
    const div = document.createElement('div');
    div.className = 'attachment-card';
    div.style = 'display:inline-flex; align-items:center; gap:var(--space-sm); background:var(--bg-secondary); padding:var(--space-xs) var(--space-sm); border-radius:var(--radius-md); border:1px solid var(--primary-glow); margin:5px';
    div.innerHTML = `
      ${isImage ? `<img src="${base64}" style="width:24px; height:24px; border-radius:4px; object-fit:cover" />` : '📄'}
      <span style="font-size:var(--font-xs); max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${sanitize(file.name)}</span>
      <span class="remove-att" style="cursor:pointer; font-weight:bold; color:var(--danger)">×</span>
    `;
    div.querySelector('.remove-att').onclick = () => {
      currentAttachments = currentAttachments.filter(a => a !== base64);
      div.remove();
      if (currentAttachments.length === 0) previewContainer.classList.add('hidden');
    };
    previewContainer.appendChild(div);
  }

  btnRun?.addEventListener('click', async () => {
    const niche = inputNiche.value.trim();
    if (!niche && currentAttachments.length === 0) { 
      showToast('Please enter a topic or attach a file', 'warning'); 
      return; 
    }
    
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
      const researchData = await AIService.runResearchWorkflow(niche, currentAttachments);
      step1.classList.remove('active');
      step1.innerHTML = `<span class="step-num">✅</span> <span>Research</span>`;
      
      // Step 2: Titles
      step2.classList.add('active');
      results.innerHTML = `<div class="loader-container"><div class="spinner"></div><p>Generating Viral Titles...</p></div>`;
      
      const titleResult = await AIService.generateTitlesOnly(researchData, currentAttachments);
      step2.classList.remove('active');
      step2.innerHTML = `<span class="step-num">✅</span> <span>Titles</span>`;
      
      renderTitlesSelection(titleResult, researchData, currentAttachments);
    } catch (err) {
      showToast(err.message, 'error');
      results.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
    }
  });
}

function renderTitlesSelection(titleResult, researchData, attachments) {
    const results = document.getElementById('seo-results');
    const titles = titleResult.match(/\[TITLE\](.*?)\[\/TITLE\]/g)?.map(t => t.replace(/\[\/?TITLE\]/g, '').trim()) || [];
    
    results.innerHTML = `
      <div class="fade-in">
        <h3 style="text-align:center; margin-bottom:var(--space-lg)">Step 2: Choose your favorite title 🎯</h3>
        <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:var(--space-lg)">
          <div class="card" style="padding:var(--space-lg); background:var(--bg-secondary)">
            <h4>🔍 Research Summary</h4>
            <div style="font-size:var(--font-xs); line-height:1.5; opacity:0.8; margin-top:var(--space-md)">${sanitize(researchData)}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--space-md)">
            ${titles.map(t => `
              <div class="card title-select-card" style="padding:var(--space-md); display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border-light); transition:all 0.2s">
                <span style="font-weight:500; font-size:var(--font-sm)">${sanitize(t)}</span>
                <button class="btn btn-primary btn-sm btn-select-title" data-title="${sanitize(t)}">Write SEO Pack</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    results.querySelectorAll('.btn-select-title').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = btn.dataset.title;
        const step3 = document.getElementById('step-3');
        
        step3.classList.add('active');
        results.innerHTML = `<div class="loader-container"><div class="spinner"></div><p>Writing a 300-word SEO Masterpiece for:<br><strong>"${title}"</strong></p></div>`;
        
        try {
          const descResult = await AIService.generateFullDescription(title, researchData, attachments);
          step3.classList.remove('active');
          step3.innerHTML = `<span class="step-num">✅</span> <span>Final SEO Pack</span>`;
          renderFinalSEO(title, researchData, descResult);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function renderFinalSEO(title, research, descResult) {
    const container = document.getElementById('seo-results');
    const fullDesc = descResult.split('[DESC]')[1]?.split('[/DESC]')[0] || descResult;
    const tags = fullDesc.split('[TAGS]')[1]?.split('[/TAGS]')[0] || "";
    const cleanDesc = fullDesc.replace(/\[TAGS\].*?\[\/TAGS\]/gs, '').trim();

    container.innerHTML = `
      <div class="fade-in" style="display:grid; grid-template-columns:1fr 1.5fr; gap:var(--space-xl)">
        <div class="card" style="padding:var(--space-lg); border-right:1px solid var(--border-light)">
          <h3>"${sanitize(title)}"</h3>
          <p class="subtitle" style="margin-top:var(--space-xs)">Strategic Context</p>
          <div style="font-size:var(--font-xs); margin-top:var(--space-md); opacity:0.8">${sanitize(research)}</div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:var(--space-lg)">
           <div class="card" style="padding:var(--space-lg)">
              <h3 style="margin-bottom:var(--space-md)">📝 Ready Description Template (300 Words)</h3>
              <div style="background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md); font-family:monospace; font-size:var(--font-xs); white-space:pre-wrap; max-height:400px; overflow-y:auto">
                ${sanitize(cleanDesc)}
              </div>
              <button class="btn btn-secondary btn-sm btn-copy" data-copy="${sanitize(cleanDesc)}" style="width:100%; margin-top:var(--space-md)">Copy Full Description</button>
           </div>
           
           ${tags ? `
           <div class="card" style="padding:var(--space-lg)">
             <h3 style="margin-bottom:var(--space-md)">🏷️ SEO Tags</h3>
             <div style="background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md); font-family:monospace; font-size:var(--font-xs); color:var(--primary-light)">
               ${sanitize(tags)}
             </div>
             <button class="btn btn-secondary btn-sm btn-copy" data-copy="${sanitize(tags)}" style="width:100%; margin-top:var(--space-md)">Copy Tags</button>
           </div>
           ` : ''}
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.copy);
        showToast('Copied!', 'success');
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    });
  }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
