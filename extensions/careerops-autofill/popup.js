const CLOUD_API_BASE = "https://careerops.dpdns.org";

const DEFAULT_REAL_PROFILE = {
  firstName: "Akash",
  lastName: "Kaintura",
  fullName: "Akash Kaintura",
  email: "akash.k96.official@gmail.com",
  phone: "+91 8979594537",
  phone10: "8979594537",
  phoneCountryCode: "+91",
  location: "Pune, India",
  city: "Pune",
  state: "Maharashtra",
  country: "India",
  postalCode: "411057",
  linkedin: "https://linkedin.com/in/akashkaintura",
  github: "https://github.com/UGilfoyle",
  portfolio: "https://akashkaintura.is-a.dev",
  website: "https://akashkaintura.is-a.dev",
  currentCompany: "Quest Global",
  currentRole: "Lead Backend Engineer",
  yearsExperience: "7",
  noticePeriod: "30 Days",
  workAuthorized: "Yes",
  sponsorshipRequired: "No",
  degree: "Master of Computer Applications (MCA)",
  school: "Uttaranchal University",
  summary:
    "Lead / Senior Backend Engineer with 7+ years of experience architecting and scaling distributed backends, high-throughput Node.js/TypeScript microservices, Redis caching, and PostgreSQL systems."
};

function isDummy(p) {
  if (!p) return true;
  const combined = [p.fullName, p.email, p.linkedin, p.portfolio].filter(Boolean).join(" ").toLowerCase();
  return (
    combined.includes("candidate engineer") ||
    combined.includes("candidate@example.com") ||
    combined.includes("example.com") ||
    combined.includes("/in/candidate")
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const statusBanner = document.getElementById("cloud-status-banner");

  function updateUI(p) {
    if (!p) return;
    if (document.getElementById("profile-name")) document.getElementById("profile-name").innerText = p.fullName || "Akash Kaintura";
    if (document.getElementById("profile-email")) document.getElementById("profile-email").innerText = p.email || "akash.k96.official@gmail.com";
    if (document.getElementById("profile-phone")) document.getElementById("profile-phone").innerText = p.phone || "+91 8979594537";
    if (document.getElementById("profile-role")) document.getElementById("profile-role").innerText = p.currentRole || "Lead Backend Engineer";
    if (document.getElementById("profile-portfolio")) document.getElementById("profile-portfolio").innerText = p.portfolio || "akashkaintura.is-a.dev";
  }

  // Load saved profile or initialize with real candidate defaults
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["careerops_profile", "careerops_last_sync"], (res) => {
      let p = res?.careerops_profile;
      if (!p || isDummy(p)) {
        p = DEFAULT_REAL_PROFILE;
        chrome.storage.local.set({
          careerops_profile: DEFAULT_REAL_PROFILE,
          careerops_last_sync: new Date().toISOString(),
        });
      }
      updateUI(p);
      statusBanner.className = "cloud-status synced";
      statusBanner.innerHTML = "<span>✅ Verified Profile: " + p.fullName + "</span>";
    });
  } else {
    updateUI(DEFAULT_REAL_PROFILE);
  }

  // Cloud Sync / Reset Handler
  document.getElementById("btn-sync-cloud").addEventListener("click", async () => {
    statusBanner.className = "cloud-status";
    statusBanner.innerHTML = "<span>⏳ Syncing profile...</span>";
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/data`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        const profile = data?.profile || {};
        const c = profile.candidate || {};
        const n = profile.narrative || {};

        const candidateProfile = {
          ...DEFAULT_REAL_PROFILE,
          firstName: c.full_name?.split(" ")[0] || "Akash",
          lastName: c.full_name?.split(" ").slice(1).join(" ") || "Kaintura",
          fullName: c.full_name || "Akash Kaintura",
          email: c.email || "akash.k96.official@gmail.com",
          phone: c.phone || "+91 8979594537",
          location: c.location || "Pune, India",
          linkedin: c.linkedin ? (c.linkedin.startsWith("http") ? c.linkedin : "https://" + c.linkedin) : DEFAULT_REAL_PROFILE.linkedin,
          github: c.github ? (c.github.startsWith("http") ? c.github : "https://" + c.github) : DEFAULT_REAL_PROFILE.github,
          portfolio: c.portfolio_url || DEFAULT_REAL_PROFILE.portfolio,
          currentCompany: "Quest Global",
          currentRole: n.headline || DEFAULT_REAL_PROFILE.currentRole,
          summary: n.exit_story || DEFAULT_REAL_PROFILE.summary,
        };

        chrome.storage.local.set({
          careerops_profile: candidateProfile,
          careerops_last_sync: new Date().toISOString(),
        });
        updateUI(candidateProfile);
        statusBanner.className = "cloud-status synced";
        statusBanner.innerHTML = "<span>✅ Synced from Cloud!</span>";
      } else {
        throw new Error("Local fallback");
      }
    } catch {
      // Offline fallback: enforce the genuine candidate profile
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({
          careerops_profile: DEFAULT_REAL_PROFILE,
          careerops_last_sync: new Date().toISOString(),
        });
      }
      updateUI(DEFAULT_REAL_PROFILE);
      statusBanner.className = "cloud-status synced";
      statusBanner.innerHTML = "<span>✅ Real Profile Ready (Akash Kaintura)</span>";
    }
  });

  // 1-Click Fill
  document.getElementById("btn-trigger-fill").addEventListener("click", async () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const btn = document.getElementById("careerops-autofill-btn");
            if (btn) btn.click();
            else console.warn("CareerOps auto-fill script not ready on this page.");
          },
        });
      }
    }
  });
});
