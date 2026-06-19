import fs from 'fs';
import path from 'path';

const REPORTS_DIR = './reports';
const STORY_BANK_FILE = './interview-prep/story-bank.md';

function parseReportFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
  // Extract report ID, company, and date from filename (e.g., "001-acme-ai-2026-04-01.md")
  const fileRegex = /^(\d+)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})\.md$/i;
  const match = fileName.match(fileRegex);
  
  let reportId = '000';
  let companySlug = 'unknown';
  let date = new Date().toISOString().split('T')[0];
  
  if (match) {
    reportId = match[1];
    companySlug = match[2];
    date = match[3];
  }

  // Extract Company Name and Role from Title header
  // E.g., "# Evaluation: Acme AI -- Senior AI Engineer" or "# Evaluación: Acme AI -- Senior AI Engineer"
  const lines = content.split('\n');
  let companyName = companySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let roleName = 'Software Engineer';
  
  const titleLine = lines.find(l => l.startsWith('# '));
  if (titleLine) {
    const titleClean = titleLine.replace(/^#\s+(Evaluation:|Evaluación:)\s*/i, '').trim();
    if (titleClean.includes('--')) {
      const parts = titleClean.split('--');
      companyName = parts[0].trim();
      roleName = parts[1].trim();
    } else {
      // Fallback
      companyName = titleClean;
    }
  }

  // Look for the interview plan table
  // Columns could be: # | Requisito del JD | Historia STAR+R | S | T | A | R | Reflection
  // Or: # | JD Requirement | STAR Story | S | T | A | R | Reflection
  let inTable = false;
  let headers = [];
  let colIndexMap = {};
  const stories = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (!inTable) {
        // This is a potential header line
        const hasStar = cols.some(c => /star|historia/i.test(c));
        const hasS = cols.some(c => c.toLowerCase() === 's');
        const hasT = cols.some(c => c.toLowerCase() === 't');
        
        if (hasStar && hasS && hasT) {
          inTable = true;
          headers = cols;
          // Map column indices
          headers.forEach((h, idx) => {
            const hLower = h.toLowerCase();
            if (/requisito|requirement/i.test(hLower)) colIndexMap.requirement = idx;
            else if (/star|historia/i.test(hLower)) colIndexMap.title = idx;
            else if (hLower === 's') colIndexMap.s = idx;
            else if (hLower === 't') colIndexMap.t = idx;
            else if (hLower === 'a') colIndexMap.a = idx;
            else if (hLower === 'r') colIndexMap.r = idx;
            else if (/reflection|reflexi/i.test(hLower)) colIndexMap.reflection = idx;
          });
          // Skip the divider line (|---|---|...)
          i++;
        }
      } else {
        // We are inside the table. Parse row.
        // If the row is a divider or empty, it marks the end of the table or a separator.
        if (line.includes('---')) continue;
        
        const row = cols;
        if (row.length < headers.length) {
          // Table ended or malformed line
          inTable = false;
          continue;
        }

        const storyTitle = row[colIndexMap.title] || '';
        if (storyTitle && storyTitle !== '...' && !storyTitle.startsWith('---')) {
          stories.push({
            reportId,
            company: companyName,
            role: roleName,
            requirement: row[colIndexMap.requirement] || '',
            title: storyTitle,
            s: row[colIndexMap.s] || '',
            t: row[colIndexMap.t] || '',
            a: row[colIndexMap.a] || '',
            r: row[colIndexMap.r] || '',
            reflection: row[colIndexMap.reflection] || ''
          });
        }
      }
    } else {
      if (inTable) {
        // Empty line or text marks the end of the table
        inTable = false;
      }
    }
  }

  return stories;
}

function sync() {
  console.log('🔄 Running Career-Ops STAR Story Sync...');
  
  if (!fs.existsSync(REPORTS_DIR)) {
    console.log(`❌ Reports directory "${REPORTS_DIR}" does not exist.`);
    return;
  }

  // 1. Read existing story bank
  let storyBankContent = '';
  if (fs.existsSync(STORY_BANK_FILE)) {
    storyBankContent = fs.readFileSync(STORY_BANK_FILE, 'utf-8');
  } else {
    console.log(`ℹ️ Creating new story bank file at ${STORY_BANK_FILE}`);
    // Initialize file template
    storyBankContent = `# Story Bank — Master STAR+R Stories\n\nThis file accumulates your best interview stories over time. Each evaluation (Block F) adds new stories here.\n\n## Stories\n\n<!-- Stories will be added here as you evaluate offers -->\n`;
    fs.mkdirSync(path.dirname(STORY_BANK_FILE), { recursive: true });
    fs.writeFileSync(STORY_BANK_FILE, storyBankContent);
  }

  // Extract existing stories in bank to avoid duplication
  // We match on title header pattern: "### Story Title" or "### [Theme] Story Title"
  const existingStoryHeaders = [];
  const lines = storyBankContent.split('\n');
  lines.forEach(line => {
    if (line.startsWith('### ')) {
      const title = line.replace('### ', '').trim();
      existingStoryHeaders.push(title.toLowerCase());
    }
  });

  // 2. Scan reports folder
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .sort(); // Process in order

  if (files.length === 0) {
    console.log('ℹ️ No evaluation reports found to sync.');
    return;
  }

  console.log(`📂 Found ${files.length} reports to scan.`);
  let newStoriesCount = 0;
  const storiesToAppend = [];

  files.forEach(file => {
    const filePath = path.join(REPORTS_DIR, file);
    try {
      const parsedStories = parseReportFile(filePath);
      
      parsedStories.forEach(story => {
        const titleNormalized = story.title.toLowerCase();
        // Check if this story title is already in our story bank
        const isDuplicate = existingStoryHeaders.some(existing => {
          return existing === titleNormalized || existing.includes(titleNormalized) || titleNormalized.includes(existing);
        });

        if (!isDuplicate) {
          storiesToAppend.push(story);
          existingStoryHeaders.push(titleNormalized); // Prevent duplicating within this run
          newStoriesCount++;
        }
      });
    } catch (err) {
      console.error(`⚠️ Error parsing ${file}:`, err.message);
    }
  });

  if (newStoriesCount === 0) {
    console.log('✅ Story bank is already up to date. No new stories synced.');
    return;
  }

  // 3. Format and append new stories to the bank
  let appendContent = '\n';
  storiesToAppend.forEach(story => {
    appendContent += `### ${story.title}\n`;
    appendContent += `**Source:** Report #${story.reportId} — ${story.company} — ${story.role}\n`;
    appendContent += `**S (Situation):** ${story.s}\n`;
    appendContent += `**T (Task):** ${story.t}\n`;
    appendContent += `**A (Action):** ${story.a}\n`;
    appendContent += `**R (Result):** ${story.r}\n`;
    if (story.reflection && story.reflection !== '...') {
      appendContent += `**Reflection:** ${story.reflection}\n`;
    }
    if (story.requirement) {
      appendContent += `**Best for questions about:** ${story.requirement}\n`;
    }
    appendContent += `\n`;
  });

  // Append after the marker if it exists, otherwise at the end
  const marker = '<!-- Stories will be added here as you evaluate offers -->';
  if (storyBankContent.includes(marker)) {
    storyBankContent = storyBankContent.replace(marker, marker + '\n' + appendContent.trim() + '\n');
  } else {
    storyBankContent += '\n' + appendContent;
  }

  fs.writeFileSync(STORY_BANK_FILE, storyBankContent, 'utf-8');
  console.log(`✅ Success! Synced ${newStoriesCount} new STAR stories to ${STORY_BANK_FILE}`);
}

sync();
