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

  async callModel(prompt) {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    
    if (!apiKey) {
      throw new Error("Please set your OpenRouter API Key in Settings first.");
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
          messages: [{ role: "user", content: prompt }]
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

  async runResearchWorkflow(niche) {
    const researchPrompt = `Act as a YouTube SEO Expert. For the niche '${niche}', identify 3 'Low Competition' angles that viewers are searching for but big channels are ignoring. Focus on specific technical details or recent news gaps. Return as a clear list.`;
    return await this.callModel(researchPrompt);
  },

  async runOptimizationWorkflow(researchData) {
    const optimizationPrompt = `Based on this research: ${researchData}\n\n1. Generate 5 High-CTR Titles (under 50 chars, use curiosity gaps).\n2. Write a 'Customizable Description' template with:\n- A hook for the first 2 lines.\n- A section for 'Key Video Details'.\n- SEO keywords to include.\n\nFORMATTING: Wrap titles in [TITLE] tags and description in [DESC] tags.`;
    return await this.callModel(optimizationPrompt);
  }
};
