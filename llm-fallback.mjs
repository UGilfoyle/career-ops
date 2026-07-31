/**
 * llm-fallback.mjs — OpenAI-compatible + Gemini fallback providers.
 *
 * GitHub Models (models.github.ai) was fully retired 2026-07-30 — never call it.
 * Closest drop-in for the old `openai/gpt-4o-mini` catalog IDs: OpenRouter.
 *
 * Priority (first configured wins):
 *   1. OpenRouter   — multi-model catalog (openai/gpt-4o-mini, anthropic/…, google/…)
 *   2. DeepSeek     — cheap strong chat
 *   3. Groq         — fast open models
 *   4. Together AI  — open models
 *   5. ModelScope   — Qwen etc.
 *   6. Custom FALLBACK_* (non-GitHub OpenAI-compatible URL)
 *   7. Gemini       — Google Generative Language API (non-OpenAI shape)
 */

export function isGithubModelsUrl(url = '') {
  return String(url).includes('models.github.ai');
}

export function isGithubModelsRetirementError(status, body = '') {
  const text = String(body || '');
  return (
    Number(status) === 410
    || /github_models_retirement/i.test(text)
    || /models\.github\.ai.*(?:unavailable|retired|brownout)/i.test(text)
  );
}

/** Catalog of supported OpenAI-compatible providers + default models. */
export const FALLBACK_PROVIDER_CATALOG = [
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_MODEL',
    // Same publisher/model shape GitHub Models used
    defaultModel: 'openai/gpt-4o-mini',
    headers: () => ({
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://github.com/UGilfoyle/career-ops',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'career-ops',
    }),
  },
  {
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    headers: () => ({}),
  },
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    headers: () => ({}),
  },
  {
    name: 'Together',
    envKey: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    modelEnv: 'TOGETHER_MODEL',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    headers: () => ({}),
  },
  {
    name: 'ModelScope',
    envKey: ['MODELSCOPE_API_KEY', 'MODELSCOPE_TOKEN'],
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    modelEnv: 'MODELSCOPE_MODEL',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    headers: () => ({}),
  },
];

function firstEnv(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const k of list) {
    const v = process.env[k];
    if (v && !isPlaceholder(v)) return v;
  }
  return '';
}

/**
 * Ordered OpenAI-compatible fallback candidates.
 * Never includes GitHub Models.
 */
export function resolveFallbackProviders() {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    if (!p?.apiKey || !p?.baseUrl || !p?.model) return;
    if (isGithubModelsUrl(p.baseUrl)) return;
    const key = `${p.name}|${p.baseUrl}|${p.model}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  for (const entry of FALLBACK_PROVIDER_CATALOG) {
    const apiKey = firstEnv(entry.envKey);
    if (!apiKey) continue;
    push({
      name: entry.name,
      apiKey,
      baseUrl: entry.baseUrl,
      model: process.env[entry.modelEnv] || entry.defaultModel,
      headers: typeof entry.headers === 'function' ? entry.headers() : (entry.headers || {}),
    });
  }

  // Explicit custom FALLBACK_* (must not be GitHub Models)
  const configuredUrl = process.env.FALLBACK_BASE_URL || '';
  const configuredKey = firstEnv(['FALLBACK_API_KEY', 'MODELSCOPE_API_KEY', 'MODELSCOPE_TOKEN']);
  if (configuredKey && configuredUrl && !isGithubModelsUrl(configuredUrl)) {
    const url = configuredUrl.replace(/\/$/, '');
    let apiKey = configuredKey;
    if (/deepseek\.com/i.test(url)) {
      apiKey = firstEnv('DEEPSEEK_API_KEY') || configuredKey;
    } else if (/openrouter\.ai/i.test(url)) {
      apiKey = firstEnv('OPENROUTER_API_KEY') || configuredKey;
    } else if (/groq\.com/i.test(url)) {
      apiKey = firstEnv('GROQ_API_KEY') || configuredKey;
    } else if (/together\.(xyz|ai)/i.test(url)) {
      apiKey = firstEnv('TOGETHER_API_KEY') || configuredKey;
    } else if (/^gh[pousr]_|github_pat_/i.test(configuredKey)) {
      // Stale GitHub PAT cannot auth against non-GitHub APIs
      apiKey = '';
    }
    if (apiKey) {
      let model =
        process.env.FALLBACK_MODEL
        || process.env.OPENROUTER_MODEL
        || process.env.DEEPSEEK_MODEL
        || process.env.MODELSCOPE_MODEL
        || 'deepseek-chat';
      if (/openrouter\.ai/i.test(url) && !model.includes('/')) model = `openai/${model}`;
      if (/deepseek\.com/i.test(url) && /^openai\//i.test(model)) model = 'deepseek-chat';
      push({
        name: 'Custom Fallback',
        apiKey,
        baseUrl: url.replace(/\/v1$/, ''),
        model,
        headers: /openrouter\.ai/i.test(url)
          ? {
              'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://github.com/UGilfoyle/career-ops',
              'X-Title': process.env.OPENROUTER_APP_NAME || 'career-ops',
            }
          : {},
      });
    }
  }

  return out;
}

export function chatCompletionsUrl(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/$/, '');
  if (u.endsWith('/chat/completions')) return u;
  // Groq already includes /openai/v1 in base
  return `${u}/chat/completions`;
}

export async function callChatCompletion(provider, { messages, maxTokens = 3000, temperature = 0.2 }) {
  const url = chatCompletionsUrl(provider.baseUrl);
  const headers = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
    ...(provider.headers || {}),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    const err = new Error(`${provider.name} API error ${response.status}: ${body.slice(0, 200)}`);
    err.status = response.status;
    err.body = body;
    err.provider = provider.name;
    throw err;
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`${provider.name} returned non-JSON response`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Empty or malformed response from ${provider.name}`);
  return { data, content, provider: provider.name };
}

/** Gemini (non-OpenAI shape) — used after OpenAI-compatible providers fail / are missing. */
export async function callGeminiChat({ messages, maxTokens = 3000, temperature = 0.2 }) {
  const key = firstEnv('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const systemParts = [];
  const contents = [];
  for (const m of messages || []) {
    if (m.role === 'system') systemParts.push(String(m.content || ''));
    else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      });
    }
  }
  if (!contents.length) throw new Error('Gemini requires at least one user message');

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    + `?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemParts.length
        ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } }
        : {}),
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = JSON.parse(body);
  const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!content) throw new Error('Empty or malformed response from Gemini');
  // Shape a fake OpenAI-like payload so callers can stay simple
  return {
    data: { choices: [{ message: { content } }], raw: data },
    content,
    provider: `Gemini (${model})`,
  };
}

/**
 * Try each configured provider until one succeeds.
 * OpenAI-compatible catalog first, then Gemini.
 */
export async function callFirstAvailableFallback(opts) {
  const providers = resolveFallbackProviders();
  const errors = [];

  for (const provider of providers) {
    try {
      console.log(`🔄 [Fallback LLM] Trying ${provider.name}: ${provider.baseUrl} / ${provider.model}`);
      const result = await callChatCompletion(provider, opts);
      console.log(`✅ [Fallback LLM] ${provider.name} succeeded.`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ [Fallback LLM] ${provider.name} failed: ${msg}`);
      errors.push(msg);
    }
  }

  if (firstEnv('GEMINI_API_KEY')) {
    try {
      console.log('🔄 [Fallback LLM] Trying Gemini…');
      const result = await callGeminiChat(opts);
      console.log(`✅ [Fallback LLM] ${result.provider} succeeded.`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ [Fallback LLM] Gemini failed: ${msg}`);
      errors.push(msg);
    }
  }

  if (!providers.length && !firstEnv('GEMINI_API_KEY')) {
    throw new Error(
      'No fallback LLM configured. Add one of:\n'
      + '  OPENROUTER_API_KEY  (best GitHub Models replacement — model ids like openai/gpt-4o-mini)\n'
      + '  DEEPSEEK_API_KEY\n'
      + '  GROQ_API_KEY\n'
      + '  TOGETHER_API_KEY\n'
      + '  MODELSCOPE_API_KEY\n'
      + '  GEMINI_API_KEY\n'
      + 'GitHub Models (models.github.ai) is permanently retired.',
    );
  }

  throw new Error(`All fallback LLM providers failed:\n${errors.join('\n')}`);
}

function isPlaceholder(key) {
  if (!key) return true;
  const lower = String(key).toLowerCase();
  return lower.includes('your_') || lower.includes('placeholder') || lower === 'your';
}
