// popup.js - Handles extension popup interactions and messages

let activeProfile = null;
let currentTabJob = null;
let serverOnline = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved backend URL and initialize UI
  const { backendUrl = 'http://localhost:4242' } = await chrome.storage.local.get('backendUrl');
  const inputUrl = document.getElementById('input-backend-url');
  inputUrl.value = backendUrl;

  await checkServerStatus();
  await initJobScraping();
  
  // Wire up buttons
  document.getElementById('btn-autofill').addEventListener('click', handleAutofill);
  document.getElementById('btn-tailor').addEventListener('click', handleTailor);
  document.getElementById('btn-eval').addEventListener('click', handleEvaluate);

  // Settings Panel Toggle
  const toggleBtn = document.getElementById('btn-toggle-settings');
  const settingsCard = document.getElementById('settings-card');
  toggleBtn.addEventListener('click', () => {
    const isHidden = settingsCard.style.display === 'none';
    settingsCard.style.display = isHidden ? 'block' : 'none';
  });

  // Save Settings
  document.getElementById('btn-save-backend').addEventListener('click', async () => {
    let url = inputUrl.value.trim();
    if (!url) url = 'http://localhost:4242';
    // Ensure URL has protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    await chrome.storage.local.set({ backendUrl: url });
    settingsCard.style.display = 'none';
    await checkServerStatus();
    await initJobScraping();
  });
});

// Check if the career-ops backend is running/connected
async function checkServerStatus() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const { backendUrl = 'http://localhost:4242' } = await chrome.storage.local.get('backendUrl');

  showMsg(`Connecting to backend at ${backendUrl}...`, false);

  try {
    // Send message to background service worker to fetch profile
    chrome.runtime.sendMessage({ type: 'FETCH_PROFILE' }, (response) => {
      if (response && response.success) {
        serverOnline = true;
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Connected';
        
        // Populate profile view
        activeProfile = response.data.profile;
        if (activeProfile && activeProfile.candidate) {
          document.getElementById('profile-name').textContent = activeProfile.candidate.full_name || '—';
          document.getElementById('profile-email').textContent = activeProfile.candidate.email || '—';
          
          const compRange = activeProfile.compensation?.target_range || '—';
          const currency = activeProfile.compensation?.currency || 'USD';
          document.getElementById('profile-comp').textContent = `${compRange} ${currency}`;
        }
        hideMsg();
      } else {
        markBackendOffline(response ? response.error : 'No response from backend');
      }
    });
  } catch (err) {
    markBackendOffline(err.message);
  }
}

async function markBackendOffline(reason) {
  serverOnline = false;
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const { backendUrl = 'http://localhost:4242' } = await chrome.storage.local.get('backendUrl');
  statusDot.className = 'status-dot';
  statusText.textContent = 'Offline';
  
  if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    showMsg(`Local backend offline.\nMake sure the local server is running:\nRun "node web-dashboard/server.mjs" in the terminal.\nReason: ${reason}`, true);
  } else {
    showMsg(`Cloud backend unreachable.\nIf using a deployed dashboard (Vercel):\n1. Click the Gear icon above to verify the URL.\n2. Open your deployed dashboard in Chrome and ensure you are logged in so your session cookies are loaded.\nReason: ${reason}`, true);
  }
}

// Scrape job description and details from current tab
async function initJobScraping() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  // Check if it's a web page
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    document.getElementById('job-title').textContent = 'System/Local Tab';
    document.getElementById('job-company').textContent = 'Please open a public job description URL.';
    document.getElementById('job-status').textContent = 'N/A';
    return;
  }

  // Inject content script if not already loaded (failsafe)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (err) {
    // Content script might already be injected or page restricts scripting
    console.warn('Content script injection warning:', err.message);
  }

  // Ask content script to scrape the page
  chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_JOB' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      document.getElementById('job-title').textContent = 'Unable to parse page';
      document.getElementById('job-company').textContent = 'Make sure the tab is fully loaded.';
      return;
    }

    if (response) {
      currentTabJob = response;
      document.getElementById('job-title').textContent = response.title || 'Unknown Title';
      document.getElementById('job-company').textContent = response.company || 'Unknown Company';
      document.getElementById('job-status').textContent = 'Detected';
      
      // Update autofill indicators if profile is available
      if (serverOnline && activeProfile) {
        const btnAutofill = document.getElementById('btn-autofill');
        btnAutofill.className = 'btn btn-primary';
        btnAutofill.disabled = false;
        document.getElementById('autofill-indicator').textContent = 'Ready';
        document.getElementById('autofill-indicator').style.color = 'var(--green)';
      }
      
      // Check if job exists in the pipeline (fetch from local server)
      checkIfJobExists(response.url);
    }
  });
}

// Cross-reference current tab URL with local database pipeline
async function checkIfJobExists(url) {
  chrome.runtime.sendMessage({ type: 'FETCH_JOBS' }, (response) => {
    if (response && response.success && response.data) {
      const allJobs = [
        ...(response.data.pipeline || []),
        ...(response.data.apps || [])
      ];
      
      // Try to find matching job in database
      const matched = allJobs.find(j => {
        try {
          const urlA = new URL(j.url);
          const urlB = new URL(url);
          // Match by origin + pathname (ignore query string parameters)
          return urlA.origin === urlB.origin && urlA.pathname === urlB.pathname;
        } catch {
          return j.url === url;
        }
      });
      
      if (matched) {
        document.getElementById('job-status').textContent = matched.score ? `Match Score: ${matched.score}/5` : 'Stored';
        document.getElementById('job-status').style.color = matched.score >= 4.0 ? 'var(--green)' : 'var(--yellow)';
        currentTabJob.id = matched.id;
        currentTabJob.score = matched.score;
        
        // Update Tailor button text
        document.getElementById('btn-tailor').textContent = 'Regenerate Resume';
      }
    }
  });
}

// Autofill the form elements on current page
async function handleAutofill() {
  if (!serverOnline || !activeProfile) {
    showMsg('Cannot autofill: Profile not loaded or backend offline.', true);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  showMsg('Filling out form fields...', false);

  chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_FORM', profile: activeProfile }, (response) => {
    if (response && response.success) {
      if (response.filled && response.filled.length > 0) {
        showMsg(`Autofill complete! Filled fields: ${response.filled.join(', ')}`, false);
      } else {
        showMsg('Autofill run. No matching form fields found on this page.', false);
      }
    } else {
      showMsg('Failed to autofill: form script failed.', true);
    }
  });
}

// Trigger "tailor" command for this job on local backend
async function handleTailor() {
  if (!serverOnline || !currentTabJob) return;

  const btnTailor = document.getElementById('btn-tailor');
  const oldText = btnTailor.textContent;
  btnTailor.innerHTML = '<span class="loader"></span> Tailoring...';
  btnTailor.disabled = true;

  showMsg('Running agentic-tailor.mjs in the background...', false);

  // If we have a job ID from the DB, run tailor <id>
  // Otherwise, run tailor <url> directly
  const target = currentTabJob.id ? String(currentTabJob.id) : `"${currentTabJob.url}"`;
  
  const { backendUrl = 'http://localhost:4242' } = await chrome.storage.local.get('backendUrl');
  const isLocal = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
  const cmd = isLocal ? `tailor ${target}` : `tailor ${target} --deep`;

  chrome.runtime.sendMessage({ type: 'RUN_COMMAND', command: cmd }, (response) => {
    btnTailor.textContent = oldText;
    btnTailor.disabled = false;

    if (response && response.success) {
      const isCloud = !isLocal;
      const targetLocation = isCloud ? 'GitHub Actions pipeline' : 'dashboard terminal';
      showMsg(`Resume tailoring job queued successfully (Job ID: ${currentTabJob.id || 'new'}). Check the ${targetLocation}.`, false);
    } else {
      showMsg(`Tailor command failed: ${response ? response.error : 'Unknown backend error'}`, true);
    }
  });
}

// Trigger "add" and evaluation command on local backend
async function handleEvaluate() {
  if (!serverOnline || !currentTabJob) return;

  const btnEval = document.getElementById('btn-eval');
  const oldText = btnEval.textContent;
  btnEval.innerHTML = '<span class="loader"></span> Evaluating...';
  btnEval.disabled = true;

  showMsg('Adding and scoring job description in the pipeline...', false);

  const cmd = `add "${currentTabJob.url}"`;

  chrome.runtime.sendMessage({ type: 'RUN_COMMAND', command: cmd }, (response) => {
    btnEval.textContent = oldText;
    btnEval.disabled = false;

    if (response && response.success) {
      showMsg(`Job added/scored. Wait a few seconds, then refresh the dashboard.`, false);
      // Refresh status check after addition
      setTimeout(() => checkIfJobExists(currentTabJob.url), 3000);
    } else {
      showMsg(`Evaluation failed: ${response ? response.error : 'Unknown backend error'}`, true);
    }
  });
}

// UI notification helper
function showMsg(text, isError) {
  const box = document.getElementById('msg-box');
  box.style.display = 'block';
  box.style.color = isError ? 'var(--red)' : 'var(--text)';
  box.style.borderLeftColor = isError ? 'var(--red)' : 'var(--mauve)';
  box.style.whiteSpace = 'pre-wrap';
  box.textContent = text;
}

function hideMsg() {
  document.getElementById('msg-box').style.display = 'none';
}
