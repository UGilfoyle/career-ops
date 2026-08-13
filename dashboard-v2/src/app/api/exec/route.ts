import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { rateLimit, formatRetryHint } from '@/lib/rate-limit';
import { ensureBackgroundSchema } from '@/lib/ops-schema';

export const dynamic = 'force-dynamic';

/** Parse `verb <target> [--deep] [--yes]` preserving full URLs (incl. query strings). */
function parseCommandWithDeep(q: string, verb: string) {
  const trimmed = q.trim();
  const deep = /\s--deep\b/i.test(trimmed);
  const yes = /\s--yes\b|\s-y\b|\s--confirm-stale\b/i.test(trimmed);
  const target = trimmed
    .replace(new RegExp(`^${verb}\\s+`, 'i'), '')
    .replace(/\s+--deep\b/gi, '')
    .replace(/\s+--yes\b/gi, '')
    .replace(/\s+-y\b/gi, '')
    .replace(/\s+--confirm-stale\b/gi, '')
    .trim();
  return { target, deep, yes };
}

function buildTailorActionArgs(target: string, deep: boolean, yes: boolean) {
  return [target, deep ? '--deep' : '', yes ? '--yes' : ''].filter(Boolean).join(' ');
}

function tailorUsage(cmd: string, deep = false) {
  const flag = deep ? ' --deep' : '';
  return `Usage: ${cmd} <job_id_or_url>${flag}\n  Example: ${cmd} 42${flag}\n  Example: ${cmd} https://job-boards.greenhouse.io/company/jobs/123${flag}\n`;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q') || ''; // The full command string
  
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      if (!q) {
        send({ type: 'error', message: 'Empty command' });
        controller.close();
        return;
      }

      const execute = async () => {
        const session = await auth();
        if (!session?.user?.id) {
          send({ type: 'stderr', content: 'Unauthorized: Please log in.\n' });
          send({ type: 'done', code: 401 });
          controller.close();
          return;
        }
        const userId = String(session.user.id || '1');

        const execLimit = await rateLimit(`exec:${userId}`, { windowMs: 60 * 60_000, max: 12 });
        if (!execLimit.ok) {
          send({
            type: 'stderr',
            content: `[ERR] Terminal limit reached (12 commands/hour). ${formatRetryHint(execLimit.retryAfterSec)}\n`,
          });
          send({ type: 'done', code: 429 });
          controller.close();
          return;
        }

        // 1. Simple Command Parsing
        const [cmd, ...args] = q.trim().split(/\s+/);
        let scriptName = '';
        let scriptArgs = args;

        const isNumericShortcut = /^\d+$/.test(cmd);
        if (isNumericShortcut) {
          scriptName = 'agentic-tailor.mjs';
          scriptArgs = [cmd];
        } else if (cmd === 'rank' || cmd === 'offer-list') {
          if (args.includes('--deep')) {
            await triggerGitHubAction(send, controller, userId, 'rank-pipeline.mjs', '');
            return;
          }
          scriptName = 'rank-pipeline.mjs';
        } else if (cmd === 'scan') {
          if (args[0] === '--deep') {
            await triggerGitHubAction(send, controller, userId, 'scratch-scan.mjs', '');
            return;
          }
          scriptName = 'scratch-scan.mjs';
        } else if (cmd === 'gcc-scan') {
          if (args.includes('--deep')) {
            await triggerGitHubAction(send, controller, userId, 'gcc-scan.mjs', '');
            return;
          }
          scriptName = 'gcc-scan.mjs';
        } else if (cmd === 'tailor' || cmd === 'offer-match') {
          const { target, deep, yes } = parseCommandWithDeep(q, cmd);
          const useDeep = deep || process.env.VERCEL === '1';
          if (useDeep) {
            if (!target) {
              send({ type: 'stderr', content: tailorUsage(cmd, true) });
              send({ type: 'done', code: 1 });
              controller.close();
              return;
            }
            await triggerGitHubAction(
              send,
              controller,
              userId,
              'agentic-tailor.mjs',
              buildTailorActionArgs(target, true, yes),
            );
            return;
          }
          scriptName = 'agentic-tailor.mjs';
          if (!target) {
            send({ type: 'stderr', content: tailorUsage(cmd, false) });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
          scriptArgs = [target, ...(yes ? ['--yes'] : [])];
        } else if (cmd === 'apply') {
          const { target, deep } = parseCommandWithDeep(q, cmd);
          const useDeep = deep || process.env.VERCEL === '1';
          if (useDeep) {
            if (!target) {
              send({ type: 'stderr', content: `Usage: apply <job_id_or_url> --deep\n  Example: apply 42 --deep\n  Example: apply https://job-boards.greenhouse.io/company/jobs/123 --deep\n` });
              send({ type: 'done', code: 1 });
              controller.close();
              return;
            }
            await triggerGitHubAction(send, controller, userId, 'auto-apply.mjs', target);
            return;
          }
          scriptName = 'auto-apply.mjs';
          if (!target) {
            send({ type: 'stderr', content: `Usage: apply <job_id_or_url>\n  Example: apply 42\n  Example: apply https://linkedin.com/jobs/view/123\n` });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
          scriptArgs = [target];
        } else if (cmd === 'ls') {
          send({ type: 'stdout', content: 'config/  data/  output/  templates/  agentic-tailor.mjs  auto-apply.mjs  rank-pipeline.mjs  scratch-scan.mjs  gcc-scan.mjs\n' });
          send({ type: 'done', code: 0 });
          controller.close();
          return;
        } else if (cmd === 'add') {
          // Take everything after "add " as the URL (LinkedIn URLs contain &query=… and must not be token-split)
          const rest = q.trim().replace(/^add\s+/i, '').trim();
          if (!rest) {
            send({ type: 'stderr', content: `Usage: add <job_url>\n  Example: add https://jobs.ashbyhq.com/company/job-id\n  Example: add https://www.linkedin.com/jobs/view/123?...\n` });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
          if (!/^https?:\/\//i.test(rest)) {
            send({ type: 'stderr', content: `Error: URL must start with http:// or https://\n` });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
          await triggerGitHubAction(send, controller, userId, 'add-job.mjs', rest);
          return;
        } else if (cmd === 'clear') {
          send({ type: 'clear' });
          send({ type: 'done', code: 0 });
          controller.close();
          return;
        } else if (cmd === 'sync-stories') {
          if (process.env.VERCEL === '1') {
            const actionName = 'Story Bank Sync';
            send({ 
              type: 'stderr', 
              content: `\n⚠️  [Vercel Serverless Constraint]\n"${actionName}" parses local reports in your project folder.\nThis cannot run directly on the cloud serverless deployment.\n\n👉 Please run this command locally in your terminal instead:\n   npm run ${cmd}\n\n` 
            });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
          scriptName = `${cmd}.mjs`;
        } else if (cmd === 'help' || cmd === '?') {
          const helpText = `
CAREER-OPS — COMMAND REFERENCE

THE SEQUENCE
  1. scan --deep          Discover roles across job boards
  2. gcc-scan --deep      Hunt GCC/captive employers (India)
  3. rank --deep          Score and rank pipeline roles
  4. tailor <id> --deep   Generate tailored resume + cover
  5. apply <id> --deep    Record / submit application

UTILITIES
  scan, gcc-scan          Quick discovery (no --deep)
  tailor <id|url>         Resume preview
  sync-stories            Sync STAR stories to story bank
  ls, clear, help         Shell helpers

Tip: gcc-scan results show in Job Pipeline (GCC badge) and GCC Campaign tab.
`;
          send({ type: 'stdout', content: helpText });
          send({ type: 'done', code: 0 });
          controller.close();
          return;
        } else if (cmd === 'terminal') {
          const rest = q.trim().replace(/^terminal\s+/i, '').trim();
          if (rest) {
            const fixed = rest.toLowerCase().startsWith('tailor ')
              ? rest
              : `tailor ${rest}${/\s--deep\s*$/i.test(rest) ? '' : ' --deep'}`;
            send({
              type: 'stderr',
              content: `'terminal' is not a command (it's the UI tab name).\nDid you mean:\n  ${fixed}\n`,
            });
          } else {
            send({
              type: 'stderr',
              content: `'terminal' is the UI tab — not a command.\nTry: tailor <job_id_or_url> --deep\n`,
            });
          }
          send({ type: 'done', code: 127 });
          controller.close();
          return;
        } else {
          send({ type: 'stderr', content: `career-ops: command not found: ${cmd}\n` });
          send({ type: 'done', code: 127 });
          controller.close();
          return;
        }

        // 2. Fetch User Profile for Wiring
        const profileRows = await sql`
          SELECT resume_context, targeting_keywords FROM user_profiles WHERE user_id = ${userId}
        `;
        const profile = profileRows[0] || { resume_context: {}, targeting_keywords: { positive: [], negative: [] } };
        
        // 3. Setup Temp Workspace for the script
        const userTmpDir = path.join('/tmp', 'career-ops', userId);
        const configDir = path.join(userTmpDir, 'config');
        const dataDir = path.join(userTmpDir, 'data');
        const outputDir = path.join(userTmpDir, 'output');
        const templatesDir = path.join(userTmpDir, 'templates');
        
        fs.mkdirSync(configDir, { recursive: true });
        fs.mkdirSync(dataDir, { recursive: true });
        fs.mkdirSync(outputDir, { recursive: true });
        fs.mkdirSync(templatesDir, { recursive: true });

        const copyRecursiveIfExists = (src: string, dest: string) => {
          if (!fs.existsSync(src)) return;
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.cpSync(src, dest, { recursive: true });
        };
        const resolveExistingPath = (candidates: string[]) =>
          candidates.find((candidate) => fs.existsSync(candidate));

        // Write the profile.yml for the script to read (merge runtime seed if DB profile is thin)
        let resumeContext = { ...(profile.resume_context || {}) } as Record<string, unknown>;
        const profileSeedPath = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'config', 'profile.yml'),
          path.join(process.cwd(), '..', 'config', 'profile.yml'),
        ]);
        if (profileSeedPath) {
          const seed = yaml.load(fs.readFileSync(profileSeedPath, 'utf8')) as Record<string, unknown>;
          const seedExp = Array.isArray(seed?.experience) ? seed.experience : [];
          const seedEdu = Array.isArray(seed?.education) ? seed.education : [];
          const ctxExp = Array.isArray(resumeContext.experience) ? resumeContext.experience : [];
          const ctxEdu = Array.isArray(resumeContext.education) ? resumeContext.education : [];
          if (seedExp.length > 0 && ctxExp.length === 0) resumeContext.experience = seedExp;
          if (seedEdu.length > 0 && ctxEdu.length === 0) resumeContext.education = seedEdu;
        }
        fs.writeFileSync(path.join(configDir, 'profile.yml'), yaml.dump(resumeContext));

        const cvSeedPath = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'cv.md'),
          path.join(process.cwd(), '..', 'cv.md'),
        ]);
        if (cvSeedPath) {
          fs.copyFileSync(cvSeedPath, path.join(userTmpDir, 'cv.md'));
        }
        
        // Write keywords to a separate file if needed by scripts
        fs.writeFileSync(path.join(configDir, 'keywords.json'), JSON.stringify(profile.targeting_keywords));

        // Provide fallback scanner/template assets expected by scripts in cwd.
        const portalsYmlPath = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'portals.yml'),
          path.join(process.cwd(), '..', 'portals.yml'),
          path.join(process.cwd(), 'portals.yml'),
          '/var/task/portals.yml',
        ]);
        if (portalsYmlPath) {
          fs.copyFileSync(portalsYmlPath, path.join(userTmpDir, 'portals.yml'));
        }
        const templatesSrcDir = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'templates'),
          path.join(process.cwd(), '..', 'templates'),
          path.join(process.cwd(), 'templates'),
          '/var/task/templates',
        ]);
        if (templatesSrcDir) {
          copyRecursiveIfExists(templatesSrcDir, templatesDir);
        }
        const scrapersDir = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'portals', 'scrapers'),
          path.join(process.cwd(), '..', 'portals', 'scrapers'),
          path.join(process.cwd(), 'portals', 'scrapers'),
          '/var/task/portals/scrapers',
        ]);
        if (scrapersDir) {
          copyRecursiveIfExists(scrapersDir, path.join(userTmpDir, 'portals', 'scrapers'));
        }
        const generatePdfScript = resolveExistingPath([
          path.join(process.cwd(), 'runtime-assets', 'generate-pdf.mjs'),
          path.join(process.cwd(), '..', 'generate-pdf.mjs'),
          path.join(process.cwd(), 'generate-pdf.mjs'),
          '/var/task/generate-pdf.mjs',
        ]);
        if (generatePdfScript) {
          fs.copyFileSync(generatePdfScript, path.join(userTmpDir, 'generate-pdf.mjs'));
        }

        // 4. Execute Script from the new 'scripts' location
        const isRootScript = cmd === 'sync-stories';
        const scriptPath = isRootScript 
          ? path.join(process.cwd(), '..', scriptName) 
          : path.join(process.cwd(), 'scripts', scriptName);
        
        const execCwd = isRootScript 
          ? path.join(process.cwd(), '..') 
          : userTmpDir;

        // We run in the temp dir so the script finds its config/profile.yml there
        // but we need to tell Node where to find its modules and local imports
        const child = spawn('node', [scriptPath, ...scriptArgs], {
          cwd: execCwd,
          env: { 
            ...process.env, 
            FORCE_COLOR: '1',
            SCAN_USER_ID: userId,
            APP_ROOT: process.cwd(),
            NODE_PATH: `${path.join(process.cwd(), 'node_modules')}:${path.join(process.cwd(), '..', 'node_modules')}`,
          }
        });

        child.stdout.on('data', (data) => send({ type: 'stdout', content: data.toString() }));
        child.stderr.on('data', (data) => send({ type: 'stderr', content: data.toString() }));
        child.on('close', (code) => {
          send({ type: 'done', code });
          controller.close();
        });

        req.signal.addEventListener('abort', () => {
          child.kill();
          controller.close();
        });
      };

      execute();

    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
async function triggerGitHubAction(send: any, controller: any, userId: string, script: string, args: string) {
  let pat = process.env.GITHUB_PAT;
  let repo = 'UGilfoyle/career-ops';

  try {
    const profileRows = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${userId}
    `;
    if (profileRows && profileRows.length > 0) {
      const resumeContext = profileRows[0].resume_context || {};
      if (resumeContext.github_settings?.pat) {
        pat = resumeContext.github_settings.pat;
      }
      if (resumeContext.github_settings?.repo) {
        repo = resumeContext.github_settings.repo;
      }
    }
  } catch (dbErr) {
    console.error('Failed to fetch user profile for GITHUB_PAT:', dbErr);
  }

  if (!pat) {
    send({
      type: 'stderr',
      content:
        'GITHUB_PAT not configured.\n' +
        'Open Settings → GitHub Automation, paste a classic PAT with the workflow scope, save, then retry.\n' +
        'Deep scan/tailor needs this to dispatch GitHub Actions.\n',
    });
    send({ type: 'done', code: 1 });
    controller.close();
    return;
  }

  const actionName = script === 'scratch-scan.mjs'
    ? 'deep scan'
    : script === 'gcc-scan.mjs'
      ? 'GCC scan'
      : script === 'agentic-tailor.mjs'
        ? 'agentic tailoring'
        : 'auto-apply';
  const actionDesc = script === 'scratch-scan.mjs'
    ? 'Scouting the market for your best-fit opportunities...'
    : script === 'gcc-scan.mjs'
      ? 'Hunting GCC/captive employers in Pune, Bengaluru & Hyderabad...'
      : script === 'agentic-tailor.mjs'
        ? 'Crafting a tailored application package just for you...'
        : 'Submitting your application intelligently...';
  send({ type: 'stdout', content: `[EXEC] ▶ ${actionDesc}\n` });

  try {
    // Create a run record (for lifecycle + traceability)
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await ensureBackgroundSchema(sql);
    await sql`
      INSERT INTO background_runs (id, user_id, action_script, action_args, status)
      VALUES (${runId}, ${String(userId)}, ${script}, ${args || null}, 'queued')
      ON CONFLICT (id) DO NOTHING
    `;

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scraper-cron.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          user_id: String(userId),
          run_id: runId,
          action_script: script,
          action_args: args
        }
      })
    });

    if (res.ok) {
      send({ type: 'stdout', content: `[OK] ✔ Task accepted — working in the background.\n` });
      
      if (script === 'agentic-tailor.mjs') {
        send({ type: 'stdout', content: '[FILE] 📄 Your tailored resume and cover letter are being crafted. They will appear in Resume Manager once ready.\n' });
      } else {
        send({ type: 'stdout', content: `[WAIT] ⏳ Standing by — your request is being processed...\n` });
      }

      const startTime = new Date();
      let percentage = 5;
      const intervalMs = 3000; // 3 seconds per tick
      const maxTicks = 45; // ~135 seconds max polling
      let tick = 0;
      let lastPrintedStatus = '';

      while (tick < maxTicks) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        tick++;

        // Query database to see if the run has completed
        let runStatus: string | null = null;
        let runUrl: string | null = null;

        try {
          const lookbackTime = new Date(startTime.getTime() - 60000);
          const recentRuns = await sql`
            SELECT status, run_url FROM background_runs
            WHERE id = ${runId}
               OR (
                 user_id = ${String(userId)}
                 AND action_script = ${script}
                 AND queued_at >= ${lookbackTime}
                 AND status IN ('success', 'failure', 'cancelled')
               )
            ORDER BY queued_at DESC
            LIMIT 1
          `;

          if (recentRuns && recentRuns.length > 0) {
            const status = recentRuns[0].status;
            if (status === 'success' || status === 'failure' || status === 'cancelled') {
              runStatus = status;
              runUrl = recentRuns[0].run_url || null;
            }
          }
        } catch (dbErr) {
          // Fail silently on DB queries to keep execution flowing
        }

        if (runStatus) {
          if (runStatus === 'success') {
            send({ type: 'stdout', content: `[PROGRESS] [██████████] 100% — All done!\n` });
            send({ type: 'stdout', content: `[OK] ✔ Your ${actionName} is complete. Check your dashboard for results.\n` });
          } else if (runStatus === 'failure') {
            send({ type: 'stderr', content: `[ERR] ✗ Something went wrong during ${actionName}. Please try again or check your configuration.\n` });
          } else {
            send({ type: 'stdout', content: `[WARN] ⚠ ${actionName} was stopped before completion.\n` });
          }
          break;
        }

        // Calculate simulated progress based on script type
        let statusText = 'Processing';

        if (script === 'agentic-tailor.mjs') {
          if (tick < 4) {
            percentage = 10 + tick * 5;
            statusText = 'Reading your profile and understanding the role';
          } else if (tick < 10) {
            percentage = 30 + (tick - 4) * 5;
            statusText = 'Mapping your strengths to what they are looking for';
          } else if (tick < 18) {
            percentage = 60 + (tick - 10) * 3;
            statusText = 'Writing tailored experience highlights and skills';
          } else if (tick < 26) {
            percentage = 84 + (tick - 18) * 2;
            statusText = 'Assembling your final resume and cover letter';
          } else {
            percentage = 98;
            statusText = 'Saving your documents — almost done';
          }
        } else if (script === 'scratch-scan.mjs' || script === 'gcc-scan.mjs') {
          if (tick < 4) {
            percentage = 10 + tick * 5;
            statusText = script === 'gcc-scan.mjs' ? 'Warming up GCC employer scanner' : 'Warming up the opportunity scanner';
          } else if (tick < 12) {
            percentage = 30 + (tick - 4) * 4;
            statusText = script === 'gcc-scan.mjs' ? 'Searching captive employers on LinkedIn & Naukri' : 'Scanning target companies for open roles';
          } else if (tick < 22) {
            percentage = 62 + (tick - 12) * 3;
            statusText = 'Scoring GCC signals and filtering by fit';
          } else {
            percentage = 92 + (tick - 22) * 1;
            statusText = 'Adding GCC matches to your pipeline';
          }
          if (percentage > 98) percentage = 98;
        } else {
          percentage = Math.min(98, 10 + tick * 4);
          statusText = 'Processing your request';
        }

        if (statusText !== lastPrintedStatus) {
          lastPrintedStatus = statusText;
          const barWidth = 10;
          const filledWidth = Math.round((percentage / 100) * barWidth);
          const emptyWidth = barWidth - filledWidth;
          const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);

          send({
            type: 'stdout',
            content: `[WAIT] ⏳ Progress: [${bar}] ${percentage}% (${statusText}...)\n`
          });
        }
      }

      if (tick >= maxTicks) {
        send({
          type: 'stdout',
          content: `[INFO] ⏳ Still working in the background — this one is thorough! Results will appear on your dashboard once ready. You can safely close this terminal.\n`
        });
      }

      send({ type: 'done', code: 0 });
    } else {
      const errText = await res.text().catch(() => '');
      send({ type: 'stderr', content: `[ERR] ✗ GitHub API returned HTTP ${res.status}: ${errText || 'No error details provided.'}\n` });
      send({ type: 'done', code: 1 });
    }
  } catch (err: any) {
    send({ type: 'stderr', content: `[ERR] ✗ A connectivity issue occurred. Please check your network and try again.\n` });
    send({ type: 'done', code: 1 });
  }
  
  controller.close();
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const execLimit = await rateLimit(`exec:${userId}`, { windowMs: 60 * 60_000, max: 12 });
    if (!execLimit.ok) {
      return NextResponse.json(
        {
          error: `Terminal limit reached (12 commands/hour). ${formatRetryHint(execLimit.retryAfterSec)}`,
        },
        { status: 429, headers: { 'Retry-After': String(execLimit.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const q = body.cmd?.trim() || '';
    if (!q) {
      return NextResponse.json({ error: 'Empty command' }, { status: 400 });
    }

    const [cmd, ...args] = q.split(/\s+/);
    
    // Check if we should trigger GitHub Action
    const isDeep = args.includes('--deep') || process.env.VERCEL === '1' || cmd === 'add';
    
    if (isDeep) {
      // Trigger GitHub Action
      let script = '';
      let scriptArgs = '';
      
      if (cmd === 'add') {
        script = 'add-job.mjs';
        scriptArgs = q.replace(/^add\s+/i, '').trim();
      } else if (cmd === 'tailor' || cmd === 'offer-match') {
        script = 'agentic-tailor.mjs';
        const { target, deep, yes } = parseCommandWithDeep(q, cmd);
        scriptArgs = buildTailorActionArgs(target || args.find((a: string) => a !== '--deep' && a !== '--yes' && a !== '-y') || '', true, yes);
      } else if (cmd === 'apply') {
        script = 'auto-apply.mjs';
        const { target } = parseCommandWithDeep(q, 'apply');
        scriptArgs = target || args.find((a: string) => a !== '--deep') || '';
      } else if (cmd === 'scan') {
        script = 'scratch-scan.mjs';
        scriptArgs = '';
      } else if (cmd === 'gcc-scan') {
        script = 'gcc-scan.mjs';
        scriptArgs = '';
      } else if (/^\d+$/.test(cmd)) {
        script = 'agentic-tailor.mjs';
        const yes = args.includes('--yes') || args.includes('-y');
        scriptArgs = buildTailorActionArgs(cmd, true, yes);
      } else {
        return NextResponse.json({ error: `Command ${cmd} not supported in deep mode` }, { status: 400 });
      }

      // Trigger GitHub Action and wait for it
      let pat = process.env.GITHUB_PAT;
      let repo = 'UGilfoyle/career-ops';

      try {
        const profileRows = await sql`
          SELECT resume_context FROM user_profiles WHERE user_id = ${userId}
        `;
        if (profileRows && profileRows.length > 0) {
          const resumeContext = profileRows[0].resume_context || {};
          if (resumeContext.github_settings?.pat) {
            pat = resumeContext.github_settings.pat;
          }
          if (resumeContext.github_settings?.repo) {
            repo = resumeContext.github_settings.repo;
          }
        }
      } catch (dbErr) {
        console.error('Failed to fetch user profile for GITHUB_PAT:', dbErr);
      }

      if (!pat) {
        return NextResponse.json(
          {
            error:
              'GITHUB_PAT not configured. Open Settings → GitHub Automation, add a classic PAT with workflow scope, then retry deep scan/tailor.',
          },
          { status: 400 }
        );
      }

      const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await ensureBackgroundSchema(sql);
      await sql`
        INSERT INTO background_runs (id, user_id, action_script, action_args, status)
        VALUES (${runId}, ${String(userId)}, ${script}, ${scriptArgs || null}, 'queued')
        ON CONFLICT (id) DO NOTHING
      `;

      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scraper-cron.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            user_id: String(userId),
            run_id: runId,
            action_script: script,
            action_args: scriptArgs
          }
        })
      });

      if (res.ok) {
        return NextResponse.json({ ok: true, jobId: runId, isDeep: true });
      } else {
        const errText = await res.text();
        return NextResponse.json({ error: `GitHub Action trigger failed: ${errText}` }, { status: 500 });
      }
    } else {
      // Local Execution
      let scriptName = '';
      let scriptArgs = args;

      if (/^\d+$/.test(cmd)) {
        scriptName = 'agentic-tailor.mjs';
        scriptArgs = [cmd];
      } else if (cmd === 'rank' || cmd === 'offer-list') {
        scriptName = 'rank-pipeline.mjs';
      } else if (cmd === 'scan') {
        scriptName = 'scratch-scan.mjs';
      } else if (cmd === 'gcc-scan') {
        scriptName = 'gcc-scan.mjs';
      } else if (cmd === 'tailor' || cmd === 'offer-match') {
        scriptName = 'agentic-tailor.mjs';
      } else if (cmd === 'apply') {
        scriptName = 'auto-apply.mjs';
      } else {
        return NextResponse.json({ error: `career-ops: command not found: ${cmd}` }, { status: 404 });
      }

      // Spawn child process in the background
      const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
      
      // Setup temp workspace
      const userTmpDir = path.join('/tmp', 'career-ops', userId);
      const configDir = path.join(userTmpDir, 'config');
      const dataDir = path.join(userTmpDir, 'data');
      const outputDir = path.join(userTmpDir, 'output');
      const templatesDir = path.join(userTmpDir, 'templates');
      
      fs.mkdirSync(configDir, { recursive: true });
      fs.mkdirSync(dataDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });
      fs.mkdirSync(templatesDir, { recursive: true });

      // Get profile
      const profileRows = await sql`
        SELECT resume_context, targeting_keywords FROM user_profiles WHERE user_id = ${userId}
      `;
      const profile = profileRows[0] || { resume_context: {}, targeting_keywords: { positive: [], negative: [] } };
      let resumeContext = { ...(profile.resume_context || {}) } as Record<string, unknown>;
      const profileSeedPath = [
        path.join(process.cwd(), 'runtime-assets', 'config', 'profile.yml'),
        path.join(process.cwd(), '..', 'config', 'profile.yml'),
      ].find((p) => fs.existsSync(p));
      if (profileSeedPath) {
        const seed = yaml.load(fs.readFileSync(profileSeedPath, 'utf8')) as Record<string, unknown>;
        const seedExp = Array.isArray(seed?.experience) ? seed.experience : [];
        const seedEdu = Array.isArray(seed?.education) ? seed.education : [];
        const ctxExp = Array.isArray(resumeContext.experience) ? resumeContext.experience : [];
        const ctxEdu = Array.isArray(resumeContext.education) ? resumeContext.education : [];
        if (seedExp.length > 0 && ctxExp.length === 0) resumeContext.experience = seedExp;
        if (seedEdu.length > 0 && ctxEdu.length === 0) resumeContext.education = seedEdu;
      }
      fs.writeFileSync(path.join(configDir, 'profile.yml'), yaml.dump(resumeContext));
      const cvSeedPath = [
        path.join(process.cwd(), 'runtime-assets', 'cv.md'),
        path.join(process.cwd(), '..', 'cv.md'),
      ].find((p) => fs.existsSync(p));
      if (cvSeedPath) fs.copyFileSync(cvSeedPath, path.join(userTmpDir, 'cv.md'));
      fs.writeFileSync(path.join(configDir, 'keywords.json'), JSON.stringify(profile.targeting_keywords));

      // Resolve portals
      const portalsYmlPath = path.join(process.cwd(), 'runtime-assets', 'portals.yml');
      if (fs.existsSync(portalsYmlPath)) {
        fs.copyFileSync(portalsYmlPath, path.join(userTmpDir, 'portals.yml'));
      }
      
      const child = spawn('node', [scriptPath, ...scriptArgs], {
        cwd: userTmpDir,
        env: { 
          ...process.env, 
          FORCE_COLOR: '1',
          SCAN_USER_ID: userId,
          APP_ROOT: process.cwd(),
          NODE_PATH: `${path.join(process.cwd(), 'node_modules')}:${path.join(process.cwd(), '..', 'node_modules')}`,
        }
      });

      child.unref();

      return NextResponse.json({ ok: true, jobId: 'local', isDeep: false });
    }
  } catch (error: any) {
    console.error('POST api/exec Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
