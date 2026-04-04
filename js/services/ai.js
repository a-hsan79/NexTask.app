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

  async generateTitlesOnly(researchData, attachments = []) {
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    const titlePrompt = `Act as a YouTube CTR Expert (2025 Specialist). ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nBased on this research: ${researchData}\n\nGenerate 5 High-CTR 'Viral' Titles. Each title MUST be between 60 to 90 characters for maximum impact and SEO coverage. Wrap each title in [TITLE] tags. Focus on high-retention curiosity gaps.`;
    return await this.callModel(titlePrompt, attachments);
  },

  async generateFullDescription(selectedTitle, researchData, attachments = []) {
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    const descPrompt = `Act as a world-class YouTube SEO Copywriter. ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nTitle chosen: "${selectedTitle}"\nContext: ${researchData}\n\nProduce a 5-Part 'Copy-Paste Ready' SEO Pack:\n- PART 1 (Description): A detailed, high-engagement summary of exactly 300 words. Use relevant keywords naturally.\n- PART 2 (Highlights): 3 key points from the video.\n- PART 3 (Social): Engagement CTA (Like/Sub).\n- PART 4 (Disclaimer): Fair-use/Copyright disclaimer.\n- PART 5 (Tags): 10 High-Volume tags separated by commas.\n\nFORMATTING: Wrap everything from PART 1 to PART 4 inside [DESC] tags and PART 5 strictly inside [TAGS] tags. Ensure [TAGS] are never empty!`;
    return await this.callModel(descPrompt, attachments);
  }
};
