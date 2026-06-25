// Career-Ops Companion Service Worker

async function getBackendUrl() {
  const result = await chrome.storage.local.get('backendUrl');
  return (result.backendUrl || 'http://localhost:4242').replace(/\/$/, '');
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const apiBase = await getBackendUrl();
      const fetchOpts = { credentials: 'include' };

      if (message.type === 'FETCH_PROFILE') {
        const res = await fetch(`${apiBase}/api/fs-data`, fetchOpts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        sendResponse({ success: true, data });
      } 
      
      else if (message.type === 'FETCH_JOBS') {
        const res = await fetch(`${apiBase}/api/data`, fetchOpts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        sendResponse({ success: true, data });
      } 
      
      else if (message.type === 'RUN_COMMAND') {
        const res = await fetch(`${apiBase}/api/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: message.command }),
          ...fetchOpts
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        sendResponse({ success: true, data });
      } 
      
      else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('Background API Error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});
