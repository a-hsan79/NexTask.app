// ===========================
// NexTask — AI Research Service
// ===========================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const AIService = {
  getApiKey() {
    return localStorage.getItem('openrouter_api_key');
  },

  getModel() {
    return localStorage.getItem('ai_model') || 'openrouter/auto';
  },

  async callModel(prompt, attachments = []) {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    
    if (!apiKey) {
      throw new Error("Please set your OpenRouter API Key in Settings first.");
    }

    // Build multi-modal messages if attachments exist
    let content;
    if (attachments && attachments.length > 0) {
      content = [
        { type: "text", text: prompt },
        ...attachments.map(att => ({
          type: "image_url",
          image_url: { url: att } // att is base64 data URL
        }))
      ];
    } else {
      content = prompt;
    }

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "NexTask AI Agent",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: content }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to call AI model");
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error('AI Service Error:', err);
      throw err;
    }
  },

  async callChat(userMessage, history = [], attachments = []) {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    
    if (!apiKey) throw new Error("Please set your OpenRouter API Key in Settings.");

    // Format messages for Chat History
    const apiMessages = [
      { role: "system", content: `You are a helpful NexTube AI Assistant. ${customPersona ? `PERSONA: ${customPersona}` : ''}` },
      ...history,
      { role: "user", content: attachments.length > 0 ? [
          { type: "text", text: userMessage },
          ...attachments.map(att => ({ type: "image_url", image_url: { url: att } }))
        ] : userMessage 
      }
    ];

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "NexTask AI Bot",
        },
        body: JSON.stringify({ model, messages: apiMessages })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Chat failed");
      }
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) { throw err; }
  },

  async runResearchWorkflow(niche, attachments = []) {
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    const researchPrompt = `Act as a Senior YouTube Strategist (2025 Specialist). ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nFor the niche '${niche}', perform deep research focusing on:
1. Latest 2024-2025 algorithm-preferred topics (High Audience Retention/Watch Time hooks).
2. Underserved search-intent gaps that big channels are missing.
3. Content that satisfies current YouTube discovery signals.
Identify 3 'Low Competition' but 'High Opportunity' angles. Return as a clear list.`;
    return await this.callModel(researchPrompt, attachments);
  },

  async runOptimizationWorkflow(researchData, attachments = []) {
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    const optimizationPrompt = `Act as a YouTube CTR & Optimization Specialist. ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nBased on this research: ${researchData}\n\n1. Generate 5 High-CTR Titles (under 50 chars, use curiosity gaps). Wrap each title in [TITLE] tags.\n\n2. Compose a 5-Part 'Copy-Paste Ready' Description in this EXACT order:\n- PART 1 (Description): A detailed, engaging summary of EXACTLY 300 words. Be descriptive and use SEO keywords.\n- PART 2 (Highlights): Exactly 3 key highlights of the video.\n- PART 3 (Social): A call-to-action to Like & Subscribe.\n- PART 4 (Disclaimer): A standard fair-use disclaimer.\n- PART 5 (Tags): A block of 10 High-CTR tags separated by commas.\n\nFORMATTING: Wrap the entire 5-part description in [DESC] tags. Wrap the tags specifically in [TAGS] tags.`;
    return await this.callModel(optimizationPrompt, attachments);
  }
};
