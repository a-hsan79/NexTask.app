import { AIService } from '../services/ai.js';
import { sanitize, showToast } from '../utils/helpers.js';

let conversationHistory = [];
let chatAttachments = [];

export async function renderAIChatPage(userProfile) {
  const mainContent = document.getElementById('main-content');
  
  mainContent.innerHTML = `
    <div class="fade-in ai-chat-page" style="height: calc(100vh - 120px); display: flex; flex-direction: column">
      <div class="page-header" style="margin-bottom: var(--space-md)">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
          <div>
            <h1 style="font-size: 1.5rem">🤖 NexTube AI Assistant</h1>
            <p class="subtitle">Conversational Q&A with Memory Support</p>
          </div>
          <button class="btn btn-ghost" id="btn-back-dash">← Dashboard</button>
        </div>
      </div>

      <div class="card chat-main-container" style="flex: 1; display:flex; flex-direction:column; padding:0; overflow:hidden; border:1px solid var(--primary-glow)">
        <!-- Chat Area -->
        <div id="ai-chat-history" style="flex: 1; overflow-y: auto; padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md)">
          ${conversationHistory.length === 0 ? `
            <div class="empty-state" style="margin: auto">
              <div class="empty-icon" style="font-size:3rem">🤖</div>
              <h3>How can I help you today?</h3>
              <p>Ask about video ideas, scripts, or SEO strategies.</p>
            </div>
          ` : conversationHistory.map(msg => `
            <div class="chat-msg msg-${msg.role}" style="${msg.role === 'user' 
              ? 'background:var(--primary); color:white; align-self:flex-end; padding:12px 16px; border-radius:16px 16px 0 16px; font-size:var(--font-sm); max-width:80%; box-shadow:0 4px 15px rgba(108,92,231,0.2)'
              : 'background:var(--bg-secondary); border:1px solid var(--border-light); align-self:flex-start; padding:12px 16px; border-radius:16px 16px 16px 0; font-size:var(--font-sm); max-width:80%; box-shadow:0 4px 15px rgba(0,0,0,0.05)'}">
              ${sanitize(msg.content).replace(/\n/g, '<br>')}
            </div>
          `).join('')}
        </div>

        <!-- Input Area -->
        <div class="chat-input-area" style="padding: var(--space-lg); background: var(--bg-card); border-top: 1px solid var(--border-light)">
          <div id="chat-attachment-preview" class="hidden" style="margin-bottom: 10px; display: flex; gap: 10px; flex-wrap: wrap"></div>
          
          <div style="display:flex; gap:var(--space-md); align-items: flex-end; position:relative">
            <div style="flex:1; position:relative">
              <textarea id="chat-input" class="form-textarea" placeholder="Type your message here... (Shift+Enter for new line)" style="min-height:50px; max-height:150px; padding-left:45px; padding-top:14px; border-radius:var(--radius-lg)"></textarea>
              <button class="btn-icon" id="btn-chat-attach" style="position:absolute; left:12px; bottom:12px; opacity:0.7; font-size:1.4rem" title="Attach image/file">📎</button>
              <input type="file" id="chat-file-input" class="hidden" accept="image/*,application/pdf" />
            </div>
            <button class="btn btn-primary" id="btn-chat-send" style="height:50px; width:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0">
              <span style="font-size:1.5rem; transform:rotate(45deg); margin-left:-2px; margin-top:-2px">🚀</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  initChatEvents();
}

function initChatEvents() {
  const input = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-chat-send');
  const historyEl = document.getElementById('ai-chat-history');
  const btnAttach = document.getElementById('btn-chat-attach');
  const inputFile = document.getElementById('chat-file-input');
  const previewContainer = document.getElementById('chat-attachment-preview');

  document.getElementById('btn-back-dash')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
  });

  btnAttach?.addEventListener('click', () => inputFile.click());

  inputFile?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const base64 = re.target.result;
        chatAttachments = [base64];
        previewContainer.innerHTML = `
          <div class="attachment-card" style="display:inline-flex; align-items:center; gap:8px; background:var(--bg-secondary); padding:6px 12px; border-radius:var(--radius-md); border:1px solid var(--primary-glow); font-size:var(--font-xs)">
            <span>📎 ${file.name}</span>
            <span style="color:var(--danger); cursor:pointer; font-weight:bold" id="btn-remove-chat-att">×</span>
          </div>
        `;
        previewContainer.classList.remove('hidden');
        document.getElementById('btn-remove-chat-att').onclick = () => {
          chatAttachments = [];
          previewContainer.classList.add('hidden');
          inputFile.value = '';
        };
      };
      reader.readAsDataURL(file);
    }
  });

  const appendMsg = (role, content) => {
    // Remove empty state if present
    const empty = historyEl.querySelector('.empty-state');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = `chat-msg msg-${role}`;
    div.style = role === 'user' 
      ? 'background:var(--primary); color:white; align-self:flex-end; padding:12px 16px; border-radius:16px 16px 0 16px; font-size:var(--font-sm); max-width:80%; box-shadow:0 4px 15px rgba(108,92,231,0.2)'
      : 'background:var(--bg-secondary); border:1px solid var(--border-light); align-self:flex-start; padding:12px 16px; border-radius:16px 16px 16px 0; font-size:var(--font-sm); max-width:80%; box-shadow:0 4px 15px rgba(0,0,0,0.05)';
    div.innerHTML = sanitize(content).replace(/\n/g, '<br>');
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  };

  const handleSend = async () => {
    const message = input.value.trim();
    if (!message && chatAttachments.length === 0) return;

    appendMsg('user', message);
    input.value = '';
    input.style.height = '50px';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-msg msg-ai typing';
    typingDiv.style = 'background:var(--bg-secondary); opacity:0.7; align-self:flex-start; padding:12px 16px; border-radius:16px 16px 16px 0; font-size:var(--font-sm); display:flex; align-items:center; gap:8px';
    typingDiv.innerHTML = '<div class="spinner spinner-xs"></div> Assistant is thinking...';
    historyEl.appendChild(typingDiv);
    historyEl.scrollTop = historyEl.scrollHeight;

    try {
      const result = await AIService.callChat(message, conversationHistory, chatAttachments);
      typingDiv.remove();
      appendMsg('assistant', result);
      
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: result });
      
      chatAttachments = [];
      previewContainer.classList.add('hidden');
    } catch (err) {
      typingDiv.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
      showToast(err.message, 'error');
    }
  };

  btnSend?.addEventListener('click', handleSend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = '50px';
    input.style.height = (input.scrollHeight) + 'px';
  });
}
