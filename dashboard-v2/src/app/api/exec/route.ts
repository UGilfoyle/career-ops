import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

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
        } else if (cmd === 'tailor' || cmd === 'offer-match') {
          if (args.includes('--deep')) {
            const jobId = args.find(a => a !== '--deep');
            if (!jobId) {
              send({ type: 'stderr', content: `Usage: ${cmd} <id> --deep\n` });
              send({ type: 'done', code: 1 });
              controller.close();
              return;
            }
            await triggerGitHubAction(send, controller, userId, 'agentic-tailor.mjs', jobId);
            return;
          }
          scriptName = 'agentic-tailor.mjs';
          if (args.length === 0) {
            send({ type: 'stderr', content: `Usage: ${cmd} <job_id_or_url>\n  Example: ${cmd} 42\n  Example: ${cmd} https://linkedin.com/jobs/view/123\n` });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
        } else if (cmd === 'apply') {
          if (args.includes('--deep')) {
            const jobId = args.find(a => a !== '--deep');
            if (!jobId) {
              send({ type: 'stderr', content: `Usage: apply <id> --deep\n` });
              send({ type: 'done', code: 1 });
              controller.close();
              return;
            }
            await triggerGitHubAction(send, controller, userId, 'auto-apply.mjs', jobId);
            return;
          }
          scriptName = 'auto-apply.mjs';
          if (args.length === 0) {
            send({ type: 'stderr', content: `Usage: apply <job_id_or_url>\n  Example: apply 42\n  Example: apply https://linkedin.com/jobs/view/123\n` });
            send({ type: 'done', code: 1 });
            controller.close();
            return;
          }
        } else if (cmd === 'ls') {
          send({ type: 'stdout', content: 'config/  data/  output/  templates/  agentic-tailor.mjs  auto-apply.mjs  rank-pipeline.mjs  scratch-scan.mjs\n' });
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
        } else if (cmd === 'skill-gap' || cmd === 'sync-stories') {
          if (process.env.VERCEL === '1') {
            const actionName = cmd === 'skill-gap' ? 'Skill Gap Heatmap' : 'Story Bank Sync';
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
  ┌─────────────────────────────────────────────────────┐
  │  THE CAREER-OPS SEQUENCE                             │
  │    1. scan --deep      Auto-discover new job matches │
  │    2. rank --deep      Score & rank discovered roles │
  │    3. tailor <id> --deep Generate hyper-custom Resumes │
  │    4. apply <id> --deep Automatically apply to role  │
  │                                                     │
  │  UTILITIES                                          │
  │    scan              Quick discovery check           │
  │    tailor <id>       Quick Resume preview            │
  │    skill-gap         Analyze CV-JD missing skills    │
  │    sync-stories      Sync STAR stories to master bank│
  │    ls                List project files              │
  │    clear             Clear terminal screen           │
  │    help              Show this reference             │
  │                                                     │
  └─────────────────────────────────────────────────────┘
\n`;
          send({ type: 'stdout', content: helpText });
          send({ type: 'done', code: 0 });
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

        // Write the profile.yml for the script to read
        const profileYaml = yaml.dump(profile.resume_context);
        fs.writeFileSync(path.join(configDir, 'profile.yml'), profileYaml);
        
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
        const isRootScript = cmd === 'skill-gap' || cmd === 'sync-stories';
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
    send({ type: 'stderr', content: '⚠ GITHUB_PAT not configured.\nPlease set your GitHub Personal Access Token in Settings or Vercel environment variables to enable deep actions.\n' });
    send({ type: 'done', code: 1 });
    controller.close();
    return;
  }

  const actionName = script === 'scratch-scan.mjs' ? 'deep scan' : script === 'agentic-tailor.mjs' ? 'deep tailoring (PDF)' : 'auto-apply';
  send({ type: 'stdout', content: `[EXEC] ▶ Triggering ${actionName} via GitHub Actions (Playwright + Chromium)...\n` });

  try {
    // Create a run record (for lifecycle + traceability)
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await sql`
      CREATE TABLE IF NOT EXISTS background_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_script TEXT NOT NULL,
        action_args TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        run_url TEXT,
        queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `;
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
      send({ type: 'stdout', content: `[OK] ✔ ${actionName} successfully queued on GitHub Actions\n` });
      send({ type: 'stdout', content: `     → Run ID: ${runId}\n` });
      
      if (script === 'agentic-tailor.mjs') {
        send({ type: 'stdout', content: '[FILE] 📄 Crafting tailored resume PDF... The completed document will automatically appear in your Resume Manager (Generated Docs) once finished.\n' });
      } else {
        send({ type: 'stdout', content: `[WAIT] ⏳ Initializing ${actionName} in the background...\n` });
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
            send({ type: 'stdout', content: `[PROGRESS] [██████████] 100% completed!\n` });
            send({ type: 'stdout', content: `[OK] ✔ ${actionName} completed successfully!\n` });
            if (runUrl) {
              send({ type: 'stdout', content: `     → Execution Details: ${runUrl}\n` });
            }
          } else if (runStatus === 'failure') {
            send({ type: 'stderr', content: `[ERR] ✗ ${actionName} failed in the background.\n` });
            if (runUrl) {
              send({ type: 'stderr', content: `      Execution Details: ${runUrl}\n` });
            }
          } else {
            send({ type: 'stdout', content: `[WARN] ⚠ ${actionName} was cancelled.\n` });
          }
          break;
        }

        // Calculate simulated progress based on script type
        let statusText = 'Processing';

        if (script === 'agentic-tailor.mjs') {
          if (tick < 4) {
            percentage = 10 + tick * 5;
            statusText = 'Provisioning container & starting Node runner';
          } else if (tick < 10) {
            percentage = 30 + (tick - 4) * 5;
            statusText = 'Scraping and analyzing job description';
          } else if (tick < 18) {
            percentage = 60 + (tick - 10) * 3;
            statusText = 'Generating tailored experiences & skills via LLM';
          } else if (tick < 26) {
            percentage = 84 + (tick - 18) * 2;
            statusText = 'Compiling LaTeX/HTML and generating PDF package';
          } else {
            percentage = 98;
            statusText = 'Syncing profile database (wrapping up)';
          }
        } else if (script === 'scratch-scan.mjs') {
          if (tick < 4) {
            percentage = 10 + tick * 5;
            statusText = 'Initializing job scanners';
          } else if (tick < 12) {
            percentage = 30 + (tick - 4) * 4;
            statusText = 'Crawling target company portals';
          } else if (tick < 22) {
            percentage = 62 + (tick - 12) * 3;
            statusText = 'Parsing job listings & filtering roles';
          } else {
            percentage = 92 + (tick - 22) * 1;
            statusText = 'Deduplicating scan history & writing to pipeline';
          }
          if (percentage > 98) percentage = 98;
        } else {
          percentage = Math.min(98, 10 + tick * 4);
          statusText = 'Executing background action';
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
          content: `[INFO] ⏳ ${actionName} is still processing in the background. You can safely close this terminal; the results will update on your dashboard once finished.\n`
        });
      }

      send({ type: 'done', code: 0 });
    } else {
      const errBody = await res.text();
      send({ type: 'stderr', content: `[ERR] ✗ Failed to trigger action. GitHub API responded with ${res.status}:\n${errBody}\n` });
      send({ type: 'done', code: 1 });
    }
  } catch (err: any) {
    send({ type: 'stderr', content: `[ERR] ✗ Network error: ${err.message}\n` });
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
        scriptArgs = args.find((a: string) => a !== '--deep') || '';
      } else if (cmd === 'apply') {
        script = 'auto-apply.mjs';
        scriptArgs = args.find((a: string) => a !== '--deep') || '';
      } else if (cmd === 'scan') {
        script = 'scratch-scan.mjs';
        scriptArgs = '';
      } else if (/^\d+$/.test(cmd)) {
        script = 'agentic-tailor.mjs';
        scriptArgs = cmd;
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
        return NextResponse.json({ error: 'GITHUB_PAT not configured. Please set your GitHub Personal Access Token in Settings.' }, { status: 400 });
      }

      const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await sql`
        CREATE TABLE IF NOT EXISTS background_runs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          action_script TEXT NOT NULL,
          action_args TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          run_url TEXT,
          queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMP
        );
      `;
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
      fs.writeFileSync(path.join(configDir, 'profile.yml'), yaml.dump(profile.resume_context));
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
