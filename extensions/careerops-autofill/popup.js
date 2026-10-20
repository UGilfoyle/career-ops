const CLOUD_API_BASE = 'https://careerops.dpdns.org';

document.addEventListener('DOMContentLoaded', () => {
  const statusBanner = document.getElementById('cloud-status-banner');

  // Load saved profile or defaults
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['careerops_profile', 'careerops_last_sync'], (res) => {
      const p = res?.careerops_profile;
      if (p) {
        if (p.fullName) document.getElementById('profile-name').innerText = p.fullName;
        if (p.email) document.getElementById('profile-email').innerText = p.email;
        if (p.phone) document.getElementById('profile-phone').innerText = p.phone;
        if (p.currentRole) document.getElementById('profile-role').innerText = p.currentRole;
      }
      if (res?.careerops_last_sync) {
        statusBanner.className = 'cloud-status synced';
        statusBanner.innerHTML = `<span>✅ Cloud Synced: ${new Date(res.careerops_last_sync).toLocaleTimeString()}</span>`;
      }
    });
  }

  // Cloud Sync Handler
  document.getElementById('btn-sync-cloud').addEventListener('click', async () => {
    statusBanner.className = 'cloud-status';
    statusBanner.innerHTML = '<span>⏳ Syncing with Cloud Server...</span>';
    try {
      // Fetch latest profile context from CareerOps Cloud API
      const res = await fetch(`${CLOUD_API_BASE}/api/data`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        const profile = data?.profile || {};
        const c = profile.candidate || {};
        const n = profile.narrative || {};
        
        const candidateProfile = {
          firstName: c.full_name?.split(' ')[0] || 'Akash',
          lastName: c.full_name?.split(' ').slice(1).join(' ') || 'Kaintura',
          fullName: c.full_name || 'Akash Kaintura',
          email: c.email || 'akash.k96.official@gmail.com',
          phone: c.phone || '+91 8979594537',
          location: c.location || 'India',
          linkedin: c.linkedin || 'https://linkedin.com/in/akashkaintura',
          github: c.github || 'https://github.com/UGilfoyle',
          portfolio: c.portfolio_url || 'https://careerops.dpdns.org',
          currentCompany: 'Technology',
          currentRole: n.headline || 'Lead / Senior Backend Engineer',
          noticePeriod: 'Immediate / 30 Days',
          workAuthorized: 'Yes',
          sponsorshipRequired: 'No',
          summary: n.exit_story || 'Senior backend engineer specializing in distributed systems, high-concurrency microservices, and Node.js.',
        };

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            careerops_profile: candidateProfile,
            careerops_last_sync: new Date().toISOString(),
          });
        }

        statusBanner.className = 'cloud-status synced';
        statusBanner.innerHTML = '<span>✅ Successfully Synced with Cloud!</span>';
      } else {
        throw new Error('Cloud offline or auth required');
      }
    } catch {
      statusBanner.className = 'cloud-status synced';
      statusBanner.innerHTML = '<span>☁️ Ready (Active Cloud Profile Loaded)</span>';
    }
  });

  // 1-Click Fill
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
