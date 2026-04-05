// ===========================
// NexTask — Multi-Provider AI Service
// ===========================

export const AIService = {
  getProvider() {
    return localStorage.getItem('ai_provider') || 'openrouter';
  },

  getApiKey() {
    const provider = this.getProvider();
    return localStorage.getItem(`${provider}_api_key`) || localStorage.getItem('openrouter_api_key');
  },

  getModel() {
    return localStorage.getItem('ai_model') || 'openrouter/auto';
  },

  async callModel(prompt, attachments = []) {
    const provider = this.getProvider();
    const apiKey = this.getApiKey();
    const model = this.getModel();
    
    if (!apiKey || apiKey.length < 5) {
      throw new Error(`Please set your ${provider.toUpperCase()} API Key in Settings first.`);
    }

    try {
      if (provider === 'anthropic') return await this.callAnthropic(model, [{ role: 'user', content: prompt }], attachments);
      if (provider === 'google') return await this.callGoogle(model, [{ role: 'user', content: prompt }], attachments);
      
      // Default for OpenAI and OpenRouter (OpenAI-compatible)
      const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
      
      let content;
      if (attachments && attachments.length > 0) {
        content = [
          { type: "text", text: prompt },
          ...attachments.map(att => ({
            type: "image_url",
            image_url: { url: att }
          }))
        ];
      } else {
        content = prompt;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin || "http://localhost:3000",
          "X-Title": "NexTube App",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: content }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error(`${provider.toUpperCase()} Service Error:`, err);
      throw err;
    }
  },

  async callChat(userMessage, history = [], attachments = []) {
    const provider = this.getProvider();
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    
    if (!apiKey || apiKey.length < 5) {
      throw new Error(`Please set your ${provider.toUpperCase()} API Key in Settings.`);
    }

    const messages = [
      { role: "system", content: `You are a helpful NexTube AI Assistant. ${customPersona ? `PERSONA: ${customPersona}` : ''}` },
      ...history,
      { role: "user", content: userMessage }
    ];

    try {
      if (provider === 'anthropic') return await this.callAnthropic(model, messages, attachments);
      if (provider === 'google') return await this.callGoogle(model, messages, attachments);

      // Default OpenAI-compatible
      const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
      
      const apiMessages = messages.map((m, i) => {
          if (i === messages.length - 1 && attachments.length > 0) {
              return {
                  role: m.role,
                  content: [
                      { type: "text", text: m.content },
                      ...attachments.map(att => ({ type: "image_url", image_url: { url: att } }))
                  ]
              };
          }
          return m;
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin || "http://localhost:3000",
          "X-Title": "NexTube App",
        },
        body: JSON.stringify({ model, messages: apiMessages })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Chat API Error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) { throw err; }
  },

  // Anthropic Specific Implementation
  async callAnthropic(model, messages, attachments = []) {
    const apiKey = this.getApiKey();
    const system_msg = messages.find(m => m.role === 'system')?.content || '';
    const user_msgs = messages.filter(m => m.role !== 'system');
    
    // Format attachments for Anthropic
    const lastMsgContent = user_msgs[user_msgs.length - 1].content;
    const finalContent = attachments.length > 0 ? [
        ...attachments.map(att => {
            const [meta, data] = att.split(',');
            const mediaType = meta.split(':')[1].split(';')[0];
            return {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: data }
            };
        }),
        { type: "text", text: lastMsgContent }
    ] : lastMsgContent;

    user_msgs[user_msgs.length - 1].content = finalContent;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-browser': 'true' // For front-end direct calls
        },
        body: JSON.stringify({
            model: model.includes('/') ? model.split('/')[1] : model, // strip provider prefix if any
            system: system_msg,
            messages: user_msgs,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Anthropic API Error");
    }
    const data = await response.json();
    return data.content[0].text;
  },

  // Google Gemini Specific Implementation
  async callGoogle(model, messages, attachments = []) {
    const apiKey = this.getApiKey();
    const cleanModel = model.includes('/') ? model.split('/')[1] : model;
    
    // Gemini message format
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    // System prompt as a special instruction
    const systemValue = messages.find(m => m.role === 'system')?.content;
    
    // Handle attachments for Gemini
    if (attachments.length > 0) {
        const lastPart = contents[contents.length - 1].parts;
        attachments.forEach(att => {
            const [meta, data] = att.split(',');
            const mimeType = meta.split(':')[1].split(';')[0];
            lastPart.unshift({
                inline_data: { mime_type: mimeType, data: data }
            });
        });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents,
        system_instruction: systemValue ? { parts: [{ text: systemValue }] } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Gemini API Error");
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
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
    const titlePrompt = `Act as a YouTube CTR Specialist (2025). ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nBased on this research: ${researchData}\n\nGenerate 5 High-CTR 'Viral' Titles (under 50 chars). Wrap each title in [TITLE] tags. Focus on curiosity gaps and search intent.`;
    return await this.callModel(titlePrompt, attachments);
  },

  async generateFullDescription(selectedTitle, researchData, attachments = []) {
    const customPersona = localStorage.getItem('ai_custom_instructions') || '';
    const descPrompt = `Act as an expert YouTube SEO Copywriter. ${customPersona ? `PERSONA: ${customPersona}` : ''}\n\nFor the video title: "${selectedTitle}"\nBased on research: ${researchData}\n\nCompose a 5-Part 'Copy-Paste Ready' Description in this EXACT order:\n- PART 1 (Description): A detailed, engaging summary of EXACTLY 300 words. Be descriptive and use SEO keywords.\n- PART 2 (Highlights): Exactly 3 key highlights.\n- PART 3 (Social): Like & Subscribe CTA.\n- PART 4 (Disclaimer): Fair-use disclaimer.\n- PART 5 (Tags): 10 High-CTR tags separated by commas.\n\nFORMATTING: Wrap description in [DESC] tags and tags in [TAGS] tags.`;
    return await this.callModel(descPrompt, attachments);
  }
};
