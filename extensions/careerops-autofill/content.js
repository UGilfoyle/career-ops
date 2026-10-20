// CareerOps ATS Auto-Fill Content Script
(function () {
  console.log("[CareerOps] ATS Auto-Fill content script active.");

  // Authentic candidate profile (Akash Kaintura)
  const defaultProfile = {
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

  // Check if cached profile contains dummy test strings
  function isDummyProfile(p) {
    if (!p) return true;
    const combined = [p.fullName, p.email, p.linkedin, p.portfolio].filter(Boolean).join(" ").toLowerCase();
    return (
      combined.includes("candidate engineer") ||
      combined.includes("candidate@example.com") ||
      combined.includes("example.com") ||
      combined.includes("/in/candidate")
    );
  }

  // Helper to trigger framework input events (React, Vue, Angular)
  function setNativeValue(element, value) {
    if (!element || value === undefined || value === null) return;
    try {
      element.focus();
    } catch {}

    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    try {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(value) }));
    } catch {
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
  }

  // Extract comprehensive context about an input element
  function getFieldInfo(el) {
    const parts = [];

    if (el.name) parts.push(el.name);
    if (el.id) parts.push(el.id);
    if (el.placeholder) parts.push(el.placeholder);
    if (el.autocomplete) parts.push(el.autocomplete);
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    if (el.getAttribute("data-qa")) parts.push(el.getAttribute("data-qa"));
    if (el.getAttribute("data-test")) parts.push(el.getAttribute("data-test"));
    if (el.getAttribute("title")) parts.push(el.getAttribute("title"));

    // ARIA labelledby
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\\s+/).forEach((id) => {
        const target = document.getElementById(id);
        if (target) parts.push(target.innerText || target.textContent || "");
      });
    }

    // Direct label via "for"
    if (el.id) {
      try {
        const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (explicitLabel) parts.push(explicitLabel.innerText || explicitLabel.textContent || "");
      } catch {}
    }

    // Enclosing label tag
    const parentLabel = el.closest("label");
    if (parentLabel) {
      parts.push(parentLabel.innerText || parentLabel.textContent || "");
    }

    // Field wrapper container
    const container = el.closest(
      "[class*=\"field\"], [class*=\"Field\"], [class*=\"form-group\"], [class*=\"formGroup\"], " +
      "[class*=\"control\"], [class*=\"Control\"], [class*=\"question\"], [class*=\"Question\"], " +
      "[class*=\"row\"], [class*=\"Row\"], [data-qa], [data-test], fieldset"
    );
    if (container) {
      const heading = container.querySelector(
        "label, [class*=\"label\"], [class*=\"Label\"], [class*=\"title\"], [class*=\"Title\"], " +
        "legend, h3, h4, h5, [class*=\"name\"], [class*=\"Name\"]"
      );
      if (heading && heading !== parentLabel) {
        parts.push(heading.innerText || heading.textContent || "");
      }
    }

    // Previous sibling label
    let prev = el.previousElementSibling;
    while (prev) {
      if (/^(LABEL|LEGEND|SPAN|DIV|P|H[1-6])$/i.test(prev.tagName)) {
        const text = (prev.innerText || prev.textContent || "").trim();
        if (text.length > 0 && text.length < 120) {
          parts.push(text);
          break;
        }
      }
      prev = prev.previousElementSibling;
    }

    return parts.join(" ").toLowerCase();
  }

  // Handle select dropdowns with regex option matching
  function matchSelectOption(selectEl, regexPattern) {
    if (!selectEl || selectEl.tagName !== "SELECT") return false;
    const options = Array.from(selectEl.options);
    const matched = options.find((opt) => regexPattern.test(opt.text) || regexPattern.test(opt.value));
    if (matched) {
      selectEl.value = matched.value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  async function autofillPage(profile) {
    let p = profile;
    if (!p || isDummyProfile(p)) {
      p = defaultProfile;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ careerops_profile: defaultProfile });
      }
    }

    const inputs = Array.from(
      document.querySelectorAll(
        "input:not([type=\"hidden\"]):not([type=\"submit\"]):not([type=\"button\"]), textarea, select"
      )
    );

    let filledCount = 0;

    for (const input of inputs) {
      const idStr = getFieldInfo(input);
      const isFile = input.type === "file";

      // 1. Resume / CV File upload
      if (isFile) {
        if (idStr.includes("resume") || idStr.includes("cv") || idStr.includes("file") || inputs.filter(i => i.type === "file").length === 1) {
          try {
            if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
              const resUrl = chrome.runtime.getURL("resume.pdf");
              const fetchRes = await fetch(resUrl);
              if (fetchRes.ok) {
                const blob = await fetchRes.blob();
                const resumeFile = new File([blob], "Akash_Kaintura_Resume.pdf", { type: "application/pdf" });
                const dt = new DataTransfer();
                dt.items.add(resumeFile);
                input.files = dt.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));
                input.dispatchEvent(new Event("input", { bubbles: true }));
                filledCount++;
                console.log("[CareerOps] Attached authentic resume PDF.");
              }
            }
          } catch (e) {
            console.warn("[CareerOps] Resume upload skip:", e);
          }
        }
        continue;
      }

      // 2. Email Address
      if (idStr.includes("email") || input.type === "email" || input.autocomplete === "email") {
        setNativeValue(input, p.email);
        filledCount++;
      }

      // 3. LinkedIn Profile URL
      else if (idStr.includes("linkedin")) {
        setNativeValue(input, p.linkedin);
        filledCount++;
      }

      // 4. Portfolio / Personal Website (Distinguish from pure GitHub field)
      else if (
        idStr.includes("portfolio") ||
        idStr.includes("behance") ||
        idStr.includes("personal website") ||
        idStr.includes("website") ||
        idStr.includes("blog") ||
        idStr.includes("personal link")
      ) {
        setNativeValue(input, p.portfolio || p.website || p.github);
        filledCount++;
      }

      // 5. GitHub Profile URL
      else if (idStr.includes("github") || idStr.includes("git profile") || idStr.includes("git url")) {
        setNativeValue(input, p.github);
        filledCount++;
      }

      // 6. Phone / Mobile
      else if (
        idStr.includes("phone") ||
        idStr.includes("mobile") ||
        idStr.includes("cell") ||
        idStr.includes("tel") ||
        input.type === "tel" ||
        input.autocomplete === "tel"
      ) {
        const phoneVal = input.maxLength === 10 ? (p.phone10 || "8979594537") : (p.phone || "+91 8979594537");
        setNativeValue(input, phoneVal);
        filledCount++;
      }

      // 7. First Name
      else if (
        idStr.includes("first name") ||
        idStr.includes("fname") ||
        idStr.includes("given name") ||
        idStr.includes("forename") ||
        input.autocomplete === "given-name"
      ) {
        setNativeValue(input, p.firstName || p.fullName?.split(" ")[0] || "Akash");
        filledCount++;
      }

      // 8. Last Name
      else if (
        idStr.includes("last name") ||
        idStr.includes("lname") ||
        idStr.includes("family name") ||
        idStr.includes("surname") ||
        input.autocomplete === "family-name"
      ) {
        setNativeValue(input, p.lastName || p.fullName?.split(" ").slice(1).join(" ") || "Kaintura");
        filledCount++;
      }

      // 9. Full Name / Name (Filtered to exclude company/school names)
      else if (
        idStr.includes("full name") ||
        idStr.includes("candidate name") ||
        input.autocomplete === "name" ||
        (
          (idStr.includes("name") || input.name === "name") &&
          !idStr.includes("company") &&
          !idStr.includes("employer") &&
          !idStr.includes("school") &&
          !idStr.includes("university") &&
          !idStr.includes("college") &&
          !idStr.includes("user") &&
          !idStr.includes("file")
        )
      ) {
        setNativeValue(input, p.fullName || `${p.firstName} ${p.lastName}`);
        filledCount++;
      }

      // 10. Current Company / Employer
      else if (
        idStr.includes("current company") ||
        idStr.includes("employer") ||
        idStr.includes("most recent company") ||
        idStr.includes("current organization")
      ) {
        setNativeValue(input, p.currentCompany || "Quest Global");
        filledCount++;
      }

      // 11. Current Role / Title / Headline
      else if (
        idStr.includes("current title") ||
        idStr.includes("current role") ||
        idStr.includes("headline") ||
        idStr.includes("designation") ||
        idStr.includes("job title")
      ) {
        setNativeValue(input, p.currentRole || "Lead Backend Engineer");
        filledCount++;
      }

      // 12. Years of Experience
      else if (
        (idStr.includes("year") && idStr.includes("exp")) ||
        idStr.includes("total experience") ||
        idStr.includes("years of experience")
      ) {
        if (input.tagName === "SELECT") {
          matchSelectOption(input, /7|5\\+|6-8|senior/i);
        } else {
          setNativeValue(input, p.yearsExperience || "7");
        }
        filledCount++;
      }

      // 13. Location / Address / City / Country
      else if (idStr.includes("country")) {
        if (input.tagName === "SELECT") {
          matchSelectOption(input, /india/i);
        } else {
          setNativeValue(input, p.country || "India");
        }
        filledCount++;
      } else if (idStr.includes("state") || idStr.includes("province")) {
        setNativeValue(input, p.state || "Maharashtra");
        filledCount++;
      } else if (idStr.includes("city")) {
        setNativeValue(input, p.city || "Pune");
        filledCount++;
      } else if (idStr.includes("zip") || idStr.includes("postal") || idStr.includes("pin code") || idStr.includes("pincode")) {
        setNativeValue(input, p.postalCode || "411057");
        filledCount++;
      } else if (idStr.includes("location") || idStr.includes("address") || idStr.includes("residence")) {
        setNativeValue(input, p.location || "Pune, India");
        filledCount++;
      }

      // 14. Notice Period / Availability
      else if (idStr.includes("notice") || idStr.includes("availability") || idStr.includes("how soon") || idStr.includes("start date")) {
        if (input.tagName === "SELECT") {
          matchSelectOption(input, /30|month|immediate/i);
        } else {
          setNativeValue(input, p.noticePeriod || "30 Days");
        }
        filledCount++;
      }

      // 15. Work Authorization (Yes)
      else if (idStr.includes("authorized") || idStr.includes("legally") || idStr.includes("right to work")) {
        if (input.tagName === "SELECT") {
          matchSelectOption(input, /yes|authorized/i);
        } else if (input.type === "radio" || input.type === "checkbox") {
          if (/yes/i.test(idStr) || input.value.toLowerCase() === "yes") {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
          setNativeValue(input, p.workAuthorized || "Yes");
        }
        filledCount++;
      }

      // 16. Visa Sponsorship (No)
      else if (idStr.includes("sponsor") || idStr.includes("visa")) {
        if (input.tagName === "SELECT") {
          matchSelectOption(input, /no|not required/i);
        } else if (input.type === "radio" || input.type === "checkbox") {
          if (/no/i.test(idStr) || input.value.toLowerCase() === "no") {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
          setNativeValue(input, p.sponsorshipRequired || "No");
        }
        filledCount++;
      }

      // 17. Cover letter / Professional Summary
      else if (
        idStr.includes("cover letter") ||
        idStr.includes("summary") ||
        idStr.includes("additional info") ||
        idStr.includes("note") ||
        idStr.includes("tell us")
      ) {
        if (input.tagName === "TEXTAREA") {
          setNativeValue(input, p.summary);
          filledCount++;
        }
      }
    }

    showToast(`⚡ CareerOps autofilled ${filledCount} field(s) for ${p.fullName}!`);
  }

  function showToast(msg) {
    const existing = document.getElementById("careerops-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "careerops-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 76px;
      right: 24px;
      background: #059669;
      color: white;
      padding: 10px 20px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.22);
      z-index: 9999999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function injectFloatingButton() {
    if (document.getElementById("careerops-autofill-btn")) return;

    const btn = document.createElement("button");
    btn.id = "careerops-autofill-btn";
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>Auto-Fill with CareerOps</span>
    `;
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #0F172A;
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 9999px;
      border: 1px solid rgba(255,255,255,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 9999998;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)";
      btn.style.background = "#1E293B";
      btn.style.boxShadow = "0 12px 30px rgba(0,0,0,0.4)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
      btn.style.background = "#0F172A";
      btn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      getActiveProfile((profile) => {
        autofillPage(profile);
      });
    });

    document.body.appendChild(btn);
  }

  function getActiveProfile(callback) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["careerops_profile"], (res) => {
        let p = res?.careerops_profile;
        if (!p || isDummyProfile(p)) {
          p = defaultProfile;
          chrome.storage.local.set({ careerops_profile: defaultProfile });
        }
        callback(p);
      });
    } else {
      callback(defaultProfile);
    }
  }

  // Inject once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFloatingButton);
  } else {
    injectFloatingButton();
  }
})();
