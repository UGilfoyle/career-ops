// content.js - Scrapes JDs and auto-fills application forms

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    const jobData = scrapeJobPage();
    sendResponse(jobData);
  } else if (message.type === 'AUTOFILL_FORM') {
    const fillResult = autofillForm(message.profile);
    sendResponse({ success: true, filled: fillResult });
  }
  return true;
});

// Scrape job description, title, company name from common portals
function scrapeJobPage() {
  const url = window.location.href;
  const title = getJobTitle();
  const company = getCompanyName();
  const jdText = getJdText();

  return {
    url,
    title,
    company,
    jdText: jdText.slice(0, 5000) // Truncate to reasonable size
  };
}

function getJobTitle() {
  // Common h1/h2 classes on job boards - Specific selectors first
  const titleSelectors = [
    'h1.jobs-details-top-card__job-title',
    'h2.jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-details-top-card__job-title',
    '.ashby-job-posting-header-title',
    '.posting-header h2',
    '[data-automation-id="job-title"]',
    '.topcard__title',
    'h2.job-title',
    '.job-title',
    '.job-heading',
    'h1'
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      return el.textContent.trim();
    }
  }
  return document.title.split('-')[0].trim();
}

function getCompanyName() {
  const url = window.location.href.toLowerCase();

  // Deduce from URL hosts
  if (url.includes('greenhouse.io/')) {
    const m = window.location.pathname.match(/^\/([^/]+)/);
    if (m && m[1] !== 'embed') return capitalize(m[1]);
  }
  if (url.includes('lever.co/')) {
    const m = window.location.pathname.match(/^\/([^/]+)/);
    if (m) return capitalize(m[1]);
  }
  if (url.includes('ashbyhq.com/')) {
    const m = window.location.pathname.match(/^\/([^/]+)/);
    if (m) return capitalize(m[1]);
  }

  const companySelectors = [
    '.jobs-unified-top-card a[href*="/company/"]',
    '.jobs-details-top-card a[href*="/company/"]',
    '.job-details-jobs-unified-top-card a[href*="/company/"]',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-details-top-card__company-info a',
    '.jobs-details-top-card__company-info',
    '.jobs-details-top-card__company-name a',
    '.jobs-details-top-card__company-name',
    '.company-name',
    '.posting-header .app-title',
    '.ashby-job-posting-header-company',
    '.topcard__org-name-link',
    '[data-company]',
    '.logo-container img[alt]',
    '.company-profile-name'
  ];

  for (const selector of companySelectors) {
    const el = document.querySelector(selector);
    if (el) {
      if (el.tagName === 'IMG') {
        return el.getAttribute('alt').trim();
      }
      if (el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
  }

  // Fallback to title parsing
  const titleParts = document.title.split(/at|[-|•]/i);
  if (titleParts.length > 1) {
    return titleParts[1].trim();
  }
  return 'Unknown Company';
}

function getJdText() {
  const jdSelectors = [
    '.jobs-description-content__text',
    '.jobs-description__container',
    '.jobs-description__content',
    '.jobs-description',
    '.jobs-box__html-content',
    '#job-details',
    '#content',
    '#job-description',
    '.job-description',
    '.posting-description',
    '.ashby-job-description',
    '[data-automation-id="job-description"]',
    '.description__text',
    'main'
  ];

  for (const selector of jdSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText.trim().length > 200) {
      return el.innerText.trim();
    }
  }
  return document.body.innerText.trim();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Auto-fill form fields using the candidate's profile
function autofillForm(profile) {
  if (!profile || !profile.candidate) return [];

  const c = profile.candidate;
  const n = profile.narrative || {};
  const l = profile.legal || {};
  const comp = profile.compensation || {};

  const filledFields = [];

  // Define key-value mappings for form inputs based on labels or names
  const formMappings = [
    { keys: ['first name', 'given name', 'firstname', 'first_name'], value: c.full_name?.split(' ')[0] },
    { keys: ['last name', 'family name', 'lastname', 'last_name', 'surname'], value: c.full_name?.split(' ').slice(1).join(' ') },
    { keys: ['full name', 'name', 'fullname', 'full_name', 'candidate_name'], value: c.full_name },
    { keys: ['email', 'e-mail', 'email_address', 'emailaddress'], value: c.email },
    { keys: ['phone', 'mobile', 'tel', 'phone_number', 'phonenumber', 'contact'], value: c.phone },
    { keys: ['linkedin', 'linkedin_url', 'linkedinurl', 'social'], value: c.linkedin ? `https://${c.linkedin}` : '' },
    { keys: ['github', 'github_url', 'githuburl', 'portfolio', 'website', 'personal_website', 'homepage'], value: c.github ? `https://${c.github}` : (c.portfolio_url || '') },
    { keys: ['salary', 'expectation', 'ctc', 'compensation', 'target salary'], value: l.salary_expectations || comp.target_range || '' },
    { keys: ['notice', 'notice period', 'noticeperiod', 'start date', 'available'], value: l.notice_period || '' }
  ];

  // Scrape all text inputs, selects, textareas on the page
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]), textarea, select');
  
  inputs.forEach(input => {
    const id = (input.id || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    
    // Find matching label text
    let labelText = '';
    if (input.id) {
      const labelEl = document.querySelector(`label[for="${input.id}"]`);
      if (labelEl) labelText = labelEl.textContent.toLowerCase();
    }
    if (!labelText) {
      // Look up parent hierarchy for text
      const parent = input.closest('div, .field, .question, fieldset');
      if (parent) {
        const labelNode = parent.querySelector('label, span.label, div.label, h3, h4');
        if (labelNode) labelText = labelNode.textContent.toLowerCase();
      }
    }

    // Try to match one of our target field keys
    for (const mapping of formMappings) {
      const isMatch = mapping.keys.some(key => 
        id.includes(key) || 
        name.includes(key) || 
        placeholder.includes(key) || 
        labelText.includes(key)
      );

      if (isMatch && mapping.value) {
        if (input.tagName.toLowerCase() === 'select') {
          selectOption(input, mapping.value);
        } else if (input.type === 'radio' || input.type === 'checkbox') {
          // Skip complex radio/checkboxes for simple matching, or click if values match
          if (input.value && mapping.value.toLowerCase().includes(input.value.toLowerCase())) {
            input.checked = true;
          }
        } else {
          input.value = mapping.value;
          // Trigger events so React/Angular/Vue wrappers catch the change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        filledFields.push(mapping.keys[0]);
        break;
      }
    }
  });

  // Highlight file inputs for Resumes/CVs
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(fileInput => {
    let isResume = false;
    const name = (fileInput.name || '').toLowerCase();
    const id = (fileInput.id || '').toLowerCase();
    
    let labelText = '';
    const parent = fileInput.closest('div, .field, .question');
    if (parent) labelText = parent.textContent.toLowerCase();
    
    if (name.includes('resume') || name.includes('cv') || id.includes('resume') || id.includes('cv') || labelText.includes('resume') || labelText.includes('cv')) {
      isResume = true;
    }
    
    if (isResume) {
      fileInput.style.border = '2px dashed #10b981'; // Green border
      fileInput.style.backgroundColor = '#ecfdf5';
      fileInput.style.padding = '8px';
      fileInput.style.borderRadius = '8px';
    }
  });

  return [...new Set(filledFields)];
}

function selectOption(selectEl, value) {
  const valNorm = value.toLowerCase();
  let bestVal = '';
  let bestScore = 0;

  for (const option of selectEl.options) {
    const textNorm = option.textContent.toLowerCase();
    const optValNorm = option.value.toLowerCase();

    if (textNorm === valNorm || optValNorm === valNorm) {
      selectEl.value = option.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Fuzzy matching score
    let score = 0;
    if (textNorm.includes(valNorm) || valNorm.includes(textNorm)) score += 1;
    if (optValNorm.includes(valNorm) || valNorm.includes(optValNorm)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestVal = option.value;
    }
  }

  if (bestScore > 0) {
    selectEl.value = bestVal;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
