#!/usr/bin/env node

import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';

async function sync() {
  const profilePath = path.join(process.cwd(), 'config', 'profile.yml');
  const cvPath = path.join(process.cwd(), 'cv.md');

  console.log(`🔄 Syncing...`);

  try {
    const yamlContent = await fs.readFile(profilePath, 'utf8');
    const p = yaml.load(yamlContent);

    let md = `# ${p.candidate.full_name}\n\n`;
    md += `**${p.target_roles.primary[0]}**  \n`;
    md += `${p.candidate.location} | ${p.candidate.email} | ${p.candidate.phone}  \n`;
    md += `[${p.candidate.linkedin}](https://${p.candidate.linkedin}) | [${p.candidate.github}](https://${p.candidate.github})\n\n`;
    md += `---\n\n`;

    md += `## Professional Summary\n\n`;
    md += `${p.narrative.headline}\n\n`;
    md += `${p.narrative.exit_story}\n\n`;
    
    md += `## Superpowers\n\n`;
    p.narrative.superpowers.forEach(s => {
      md += `▸ ${s}  \n`;
    });
    md += `\n---\n\n`;

    md += `## Professional Experience\n\n`;
    p.experience.forEach(exp => {
      md += `### ${exp.role}\n`;
      md += `**${exp.company}** | ${exp.period}\n\n`;
      exp.bullets.forEach(b => {
        md += `- ${b}\n`;
      });
      md += `\n`;
    });

    md += `---\n\n`;
    md += `## Education\n\n`;
    p.education.forEach(edu => {
      md += `**${edu.degree}** (${edu.period}) | ${edu.school}  \n`;
    });

    await fs.writeFile(cvPath, md.trim() + '\n');
    console.log('✅ cv.md updated successfully!');

    try {
      const uploadScript = path.join(process.cwd(), 'upload-profile.mjs');
      const { execSync } = await import('child_process');
      execSync(`node "${uploadScript}"`, { stdio: 'inherit' });
    } catch {
      // Non-blocking if offline or DB not configured
    }

  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

sync();
