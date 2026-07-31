/**
 * llm-fallback.mjs — Resolve OpenAI-compatible fallback providers.
 * GitHub Models (models.github.ai) is retired / in brownout — never prefer it.
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

/**
 * Ordered OpenAI-compatible fallback candidates (DeepSeek → ModelScope → explicit non-GitHub FALLBACK_*).
 * Skips GitHub Models entirely — it returns 410 during retirement brownouts.
 */
export function resolveFallbackProviders() {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    if (!p?.apiKey || !p?.baseUrl || !p?.model) return;
    if (isGithubModelsUrl(p.baseUrl)) return;
    const key = `${p.baseUrl}|${p.model}|${p.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  if (deepseekKey && !isPlaceholder(deepseekKey)) {
    push({
      name: 'DeepSeek',
      apiKey: deepseekKey,
      baseUrl: 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      headers: {},
    });
  }

  const modelscopeKey =
    process.env.MODELSCOPE_API_KEY
    || process.env.MODELSCOPE_TOKEN
    || '';
  if (modelscopeKey && !isPlaceholder(modelscopeKey)) {
    push({
      name: 'ModelScope',
      apiKey: modelscopeKey,
      baseUrl: 'https://api-inference.modelscope.cn/v1',
      model: process.env.MODELSCOPE_MODEL || 'Qwen/Qwen2.5-72B-Instruct',
      headers: {},
    });
  }

  const configuredUrl = process.env.FALLBACK_BASE_URL || '';
  const configuredKey =
    process.env.FALLBACK_API_KEY
    || process.env.MODELSCOPE_API_KEY
    || process.env.MODELSCOPE_TOKEN
    || '';
  if (
    configuredKey
    && !isPlaceholder(configuredKey)
    && configuredUrl
    && !isGithubModelsUrl(configuredUrl)
  ) {
    const url = configuredUrl.replace(/\/v1$/, '').replace(/\/$/, '');
    // If URL is DeepSeek, prefer DEEPSEEK_API_KEY over a leftover GitHub PAT in FALLBACK_API_KEY
    let apiKey = configuredKey;
    if (/deepseek\.com/i.test(url) && deepseekKey && !isPlaceholder(deepseekKey)) {
      apiKey = deepseekKey;
    } else if (/^gh[pousr]_|github_pat_/i.test(configuredKey)) {
      // Stale GitHub PAT cannot auth against non-GitHub OpenAI-compatible APIs
      apiKey = '';
    }
    if (apiKey) {
      push({
        name: 'Custom Fallback',
        apiKey,
        baseUrl: url,
        model:
          process.env.FALLBACK_MODEL
          || process.env.MODELSCOPE_MODEL
          || ( /deepseek\.com/i.test(url) ? 'deepseek-chat' : 'Qwen/Qwen2.5-72B-Instruct'),
        headers: {},
      });
    }
  }

  return out;
}

export function chatCompletionsUrl(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/$/, '');
  if (u.endsWith('/chat/completions')) return u;
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

/**
 * Try each fallback provider until one succeeds.
 */
export async function callFirstAvailableFallback(opts) {
  const providers = resolveFallbackProviders();
  if (!providers.length) {
    throw new Error(
      'No fallback LLM configured. Set DEEPSEEK_API_KEY, or MODELSCOPE_API_KEY, '
      + 'or FALLBACK_BASE_URL (not models.github.ai) + FALLBACK_API_KEY. '
      + 'GitHub Models is retired.',
    );
  }
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
  throw new Error(`All fallback LLM providers failed:\n${errors.join('\n')}`);
}

function isPlaceholder(key) {
  if (!key) return true;
  const lower = String(key).toLowerCase();
  return lower.includes('your_') || lower.includes('placeholder') || lower === 'your';
}
