// app/ai-router.mjs — Cascata de IA com distribuição de carga e fallback para Ollama local

const PROVIDERS = {
  heavy: [
    { name: 'openai', url: 'https://api.openai.com/v1/chat/completions', keyEnv: 'OPENAI_API_KEY', model: 'gpt-4o' },
    { name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyEnv: 'GEMINI_API_KEY', model: 'gemini-2.5-pro' },
    { name: 'deepseek', url: 'https://api.deepseek.com/v1/chat/completions', keyEnv: 'DEEPSEEK_API_KEY', model: 'deepseek-reasoner' },
    { name: 'ollama', url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat', local: true, model: process.env.OLLAMA_HEAVY_MODEL || 'qwen2.5:14b' }
  ],
  fast: [
    { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
    { name: 'gemini-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyEnv: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
    { name: 'ollama', url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat', local: true, model: process.env.OLLAMA_FAST_MODEL || 'llama3.2:latest' }
  ]
};

export async function runAiCascade(prompt, { tier = 'fast', system = 'Você é o núcleo autônomo do moneyIA.' } = {}) {
  const chain = PROVIDERS[tier] || PROVIDERS.fast;
  const errors = [];

  for (const provider of chain) {
    try {
      if (provider.local) {
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            stream: false,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ]
          }),
          signal: AbortSignal.timeout(45000)
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        return { ok: true, provider: `ollama:${provider.model}`, text: data?.message?.content || '' };
      }

      const apiKey = process.env[provider.keyEnv];
      if (!apiKey) continue;

      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ]
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) throw new Error(`${provider.name} retornou vazio`);

      return { ok: true, provider: `${provider.name}:${provider.model}`, text };
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  return { ok: false, provider: 'none', text: '', errors };
}
