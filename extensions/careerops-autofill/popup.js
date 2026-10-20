document.addEventListener('DOMContentLoaded', () => {
  // Load saved profile or defaults
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['careerops_profile'], (res) => {
      const p = res?.careerops_profile;
      if (p) {
        if (p.fullName) document.getElementById('profile-name').innerText = p.fullName;
        if (p.email) document.getElementById('profile-email').innerText = p.email;
        if (p.phone) document.getElementById('profile-phone').innerText = p.phone;
        if (p.currentRole) document.getElementById('profile-role').innerText = p.currentRole;
      }
    });
  }

  document.getElementById('btn-trigger-fill').addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const btn = document.getElementById('careerops-autofill-btn');
            if (btn) btn.click();
            else console.warn('CareerOps auto-fill script not ready on this page.');
          },
        });
      }
    }
  });
});
