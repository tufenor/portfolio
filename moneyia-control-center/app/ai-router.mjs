// app/ai-router.mjs — Sintaxe rápida com num_predict curto, keep_alive e timeouts enxutos

const PROVIDERS = {
  heavy: [
    { name: 'openai', kind: 'openai', url: 'https://api.openai.com/v1/chat/completions', keyEnv: 'OPENAI_API_KEY', model: process.env.OPENAI_HEAVY_MODEL || 'gpt-4o' },
    { name: 'gemini', kind: 'gemini-native', keyEnv: 'GEMINI_API_KEY', models: [process.env.GEMINI_HEAVY_MODEL || 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest'] },
    { name: 'deepseek', kind: 'openai', url: 'https://api.deepseek.com/v1/chat/completions', keyEnv: 'DEEPSEEK_API_KEY', model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner' },
    { name: 'ollama', kind: 'ollama', url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat', model: process.env.OLLAMA_HEAVY_MODEL || process.env.OLLAMA_FAST_MODEL || 'qwen3.5:4b', timeoutMs: 45000 }
  ],
  fast: [
    { name: 'groq', kind: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
    { name: 'gemini-flash', kind: 'gemini-native', keyEnv: 'GEMINI_API_KEY', models: [process.env.GEMINI_FAST_MODEL || 'gemini-2.5-flash', 'gemini-flash-latest'] },
    { name: 'ollama', kind: 'ollama', url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat', model: process.env.OLLAMA_FAST_MODEL || 'qwen3.5:4b', timeoutMs: 25000 }
  ]
};

async function callGeminiNative(apiKey, models, prompt, system) {
  let lastErr = '';
  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 450, temperature: 0.3 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      lastErr = `${model} HTTP ${res.status}`;
      continue;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p?.text || '').join('\n').trim();
    if (!text) {
      lastErr = `${model} retornou vazio`;
      continue;
    }
    return { ok: true, provider: `gemini:${model}`, text };
  }
  throw new Error(lastErr || 'Gemini sem modelo disponível');
}

export async function runAiCascade(prompt, { tier = 'fast', system = 'Responda de forma objetiva e direta em português.' } = {}) {
  const chain = PROVIDERS[tier] || PROVIDERS.fast;
  const errors = [];

  for (const provider of chain) {
    try {
      if (provider.kind === 'ollama') {
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            stream: false,
            think: false,
            keep_alive: '15m',
            options: { num_predict: 350, temperature: 0.3 },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ]
          }),
          signal: AbortSignal.timeout(provider.timeoutMs || 25000)
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        const text = String(data?.message?.content || data?.message?.thinking || '').trim();
        if (!text) throw new Error('Ollama retornou vazio');
        return { ok: true, provider: `ollama:${provider.model}`, text };
      }

      const apiKey = process.env[provider.keyEnv];
      if (!apiKey) continue;

      if (provider.kind === 'gemini-native') {
        return await callGeminiNative(apiKey, provider.models, prompt, system);
      }

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
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error(`${provider.name} retornou vazio`);

      return { ok: true, provider: `${provider.name}:${provider.model}`, text };
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  return { ok: false, provider: 'none', text: '', errors };
}