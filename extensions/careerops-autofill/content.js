// CareerOps ATS Auto-Fill Content Script
(function () {
  console.log('[CareerOps] ATS Auto-Fill content script active.');

  // Default fallback profile if not synced from dashboard
  const defaultProfile = {
    firstName: 'Candidate',
    lastName: 'Engineer',
    fullName: 'Candidate Engineer',
    email: 'candidate@example.com',
    phone: '+1 555-0199',
    location: 'Remote',
    linkedin: 'https://linkedin.com/in/candidate',
    github: 'https://github.com/candidate',
    portfolio: 'https://portfolio.example.com',
    currentCompany: 'Technology Company',
    currentRole: 'Senior Software Engineer',
    noticePeriod: 'Immediate / 2 Weeks',
    workAuthorized: 'Yes',
    sponsorshipRequired: 'No',
    summary: 'Experienced Software Engineer specializing in backend systems, distributed architectures, and cloud platforms.',
  };

  // Helper to trigger framework input events (React, Vue, Angular)
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function getFieldIdentifier(el) {
    const parts = [
      el.name || '',
      el.id || '',
      el.placeholder || '',
      el.getAttribute('aria-label') || '',
    ];
    // Look up parent label text
    const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
    if (label) parts.push(label.innerText || '');
    return parts.join(' ').toLowerCase();
  }

  function autofillPage(profile) {
    const p = profile || defaultProfile;
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'));
    let filledCount = 0;

    inputs.forEach((input) => {
      const idStr = getFieldIdentifier(input);

      if (idStr.includes('first name') || idStr.includes('fname') || idStr.includes('given name')) {
        setNativeValue(input, p.firstName || p.fullName?.split(' ')[0] || '');
        filledCount++;
      } else if (idStr.includes('last name') || idStr.includes('lname') || idStr.includes('family name') || idStr.includes('surname')) {
        setNativeValue(input, p.lastName || p.fullName?.split(' ').slice(1).join(' ') || '');
        filledCount++;
      } else if (idStr.includes('full name') || (idStr.includes('name') && !idStr.includes('company') && !idStr.includes('school'))) {
        setNativeValue(input, p.fullName || `${p.firstName} ${p.lastName}`);
        filledCount++;
      } else if (idStr.includes('email')) {
        setNativeValue(input, p.email);
        filledCount++;
      } else if (idStr.includes('phone') || idStr.includes('mobile') || idStr.includes('tel')) {
        setNativeValue(input, p.phone);
        filledCount++;
      } else if (idStr.includes('linkedin')) {
        setNativeValue(input, p.linkedin);
        filledCount++;
      } else if (idStr.includes('github')) {
        setNativeValue(input, p.github);
        filledCount++;
      } else if (idStr.includes('portfolio') || idStr.includes('website') || idStr.includes('blog') || idStr.includes('personal link')) {
        setNativeValue(input, p.portfolio);
        filledCount++;
      } else if (idStr.includes('location') || idStr.includes('city') || idStr.includes('address')) {
        setNativeValue(input, p.location);
        filledCount++;
      } else if (idStr.includes('current company') || idStr.includes('employer') || idStr.includes('most recent company')) {
        setNativeValue(input, p.currentCompany);
        filledCount++;
      } else if (idStr.includes('current title') || idStr.includes('current role') || idStr.includes('headline')) {
        setNativeValue(input, p.currentRole);
        filledCount++;
      } else if (idStr.includes('notice') || idStr.includes('availability')) {
        setNativeValue(input, p.noticePeriod);
        filledCount++;
      } else if (idStr.includes('authorized') || idStr.includes('legally')) {
        if (input.tagName === 'SELECT') {
          Array.from(input.options).forEach((opt) => {
            if (/yes|authorized/i.test(opt.text)) input.value = opt.value;
          });
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.type === 'radio' || input.type === 'checkbox') {
          if (/yes/i.test(idStr)) input.checked = true;
        }
        filledCount++;
      } else if (idStr.includes('sponsor') || idStr.includes('visa')) {
        if (input.tagName === 'SELECT') {
          Array.from(input.options).forEach((opt) => {
            if (/no/i.test(opt.text)) input.value = opt.value;
          });
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.type === 'radio' || input.type === 'checkbox') {
          if (/no/i.test(idStr)) input.checked = true;
        }
        filledCount++;
      } else if (idStr.includes('cover letter') || idStr.includes('summary') || idStr.includes('additional info') || idStr.includes('note')) {
        if (input.tagName === 'TEXTAREA') {
          setNativeValue(input, p.summary);
          filledCount++;
        }
      }
    });

    showToast(`⚡ CareerOps autofilled ${filledCount} field(s)!`);
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 76px;
      right: 24px;
      background: #10B981;
      color: white;
      padding: 10px 18px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.18);
      z-index: 9999999;
      transition: all 0.3s ease;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function injectFloatingButton() {
    if (document.getElementById('careerops-autofill-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'careerops-autofill-btn';
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
      background: #111827;
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 9999px;
      border: 1px solid rgba(255,255,255,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(0,0,0,0.25);
      z-index: 9999998;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.background = '#1F2937';
      btn.style.boxShadow = '0 12px 28px rgba(0,0,0,0.35)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.background = '#111827';
      btn.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Try reading custom synced profile from chrome.storage
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['careerops_profile'], (res) => {
          autofillPage(res?.careerops_profile || defaultProfile);
        });
      } else {
        autofillPage(defaultProfile);
      }
    });

    document.body.appendChild(btn);
  }

  // Inject once DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFloatingButton);
  } else {
    injectFloatingButton();
  }
})();
