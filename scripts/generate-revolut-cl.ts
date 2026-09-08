import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Akash Kaintura - Cover Letter (Revolut)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0.35in; }
        html, body {
            background: #fff;
            color: #1a1a1a;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 9pt;
            line-height: 1.42;
            -webkit-print-color-adjust: exact;
        }
        .container {
            max-width: 760px;
            margin: 0 auto;
            padding: 0 4px;
        }
        header {
            border-bottom: 1.5px solid #111;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        h1 {
            font-size: 19pt;
            font-weight: 800;
            color: #111;
            letter-spacing: -0.4px;
            margin-bottom: 2px;
        }
        .subtitle {
            font-size: 9.5pt;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 6px;
        }
        .contact-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 4px 14px;
            font-size: 8.5pt;
            color: #444;
        }
        .contact-bar a {
            color: #111;
            text-decoration: none;
            font-weight: 500;
        }
        .meta-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 8.5pt;
            color: #333;
        }
        .recipient {
            line-height: 1.35;
        }
        .recipient strong {
            color: #111;
            font-size: 9.5pt;
        }
        .subject-line {
            font-size: 9.5pt;
            font-weight: 700;
            color: #111;
            margin-bottom: 12px;
            padding: 6px 10px;
            background: #f8fafc;
            border-left: 3px solid #2563eb;
        }
        p {
            margin-bottom: 10px;
            text-align: justify;
        }
        ul {
            margin: 6px 0 10px 16px;
        }
        li {
            margin-bottom: 4px;
            font-size: 8.5pt;
            line-height: 1.38;
        }
        li strong {
            color: #0f172a;
        }
        .highlight-box {
            background: #f1f5f9;
            border-left: 3px solid #0f172a;
            padding: 8px 12px;
            margin: 10px 0;
            font-size: 8.5pt;
            line-height: 1.42;
        }
        .signoff {
            margin-top: 14px;
        }
        .signature-name {
            font-size: 10pt;
            font-weight: 700;
            color: #111;
            margin-top: 4px;
        }
        .signature-title {
            font-size: 8.5pt;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Akash Kaintura</h1>
            <div class="subtitle">Senior Backend Engineer — Data Platform & Distributed Systems</div>
            <div class="contact-bar">
                <span>📍 Pune, India (Open to Relocation)</span>
                <span>📞 +91 8979594537</span>
                <span>✉️ <a href="mailto:akash.k96.official@gmail.com">akash.k96.official@gmail.com</a></span>
                <span>🔗 <a href="https://linkedin.com/in/akashkaintura">linkedin.com/in/akashkaintura</a></span>
                <span>💻 <a href="https://github.com/UGilfoyle">github.com/UGilfoyle</a></span>
            </div>
        </header>

        <div class="meta-section">
            <div class="recipient">
                <strong>Artem Mishchenko</strong><br>
                Head of Data Platform<br>
                Revolut<br>
                <em>Via Direct Application & Email</em>
            </div>
            <div>
                <strong>Date:</strong> September 8, 2026
            </div>
        </div>

        <div class="subject-line">
            Subject: Application for Senior / Lead Backend Engineer — Data Platform
        </div>

        <p>Dear Artem,</p>

        <p>
            I am writing to express my strong interest in joining Revolut's Data Platform as a Senior / Lead Backend Engineer. Having engineered high-throughput, mission-critical data systems for 8+ years, your hiring principles directly mirror my own approach to engineering: solving hard distributed problems from first principles using core Linux, Python, and PostgreSQL at scale—without relying on vendor lock-in or superficial framework abstractions.
        </p>

        <p>
            Regarding your request for a real-world service that took severe production load, what broke first, and how it was resolved:
        </p>

        <div class="highlight-box">
            <strong>Production Incident & Architecture Redesign (SKF Industrial Telemetry Platform):</strong><br>
            At Quest Global, I designed and owned an in-house Python ingestion engine on Linux, consuming high-frequency industrial vibration and temperature sensor events directly into PostgreSQL (processing tens of millions of records daily). During peak ingestion bursts, the service experienced severe connection exhaustion: direct client connections saturated PostgreSQL's connection limits, query locks cascaded across a massive unpartitioned table, and p99 write latency spiked from sub-second to 3.8s while database CPU spiked to 95%.<br><br>
            <strong>The Fix:</strong> Rather than patching it with external vendor layers, I tackled the root bottlenecks directly in the storage and transport layer: implemented <em>PgBouncer</em> in transaction pooling mode, migrated the table to declarative time-bucket partitioning, and recalibrated <em>autovacuum_vacuum_scale_factor</em> to prevent rapid table bloat. Post-implementation, p99 write latency stabilized below 110ms, and database CPU dropped by 35% during sustained ingest spikes with 99.9% uptime.
        </div>

        <p>
            Across my technical career at Quest Global, INTVERSE (Kenvue), and Glidewell, my engineering focus has remained deeply hands-on:
        </p>
        <ul>
            <li><strong>PostgreSQL Concurrency & Scalability:</strong> Deep expertise in query execution planning, declarative partitioning, connection pooling topologies, lock contention avoidance, and autovacuum tuning under extreme write pressure.</li>
            <li><strong>High-Performance Linux & Python:</strong> Architecting concurrent, multi-process Python backend microservices, tuning Linux network sockets/kernel parameters, and decoupling high-throughput payloads via Redis and event streaming.</li>
            <li><strong>SRE & Operational Ownership:</strong> Building resilient telemetry pipelines, distributed tracing with ELK/Prometheus, and implementing backoff/retry circuits ensuring zero data loss during upstream spikes.</li>
            <li><strong>Academic Pedigree:</strong> I hold both a Master of Computer Applications (MCA) and a Bachelor of Computer Applications (BCA)—both formally accredited <strong>STEM degrees</strong>.</li>
        </ul>

        <p>
            Revolut’s unmatched engineering velocity and global financial scale require high-ownership engineers who take pride in writing clean, resilient code that performs reliably under extreme pressure. I would welcome the opportunity to discuss how my backend and data infrastructure experience can contribute to the Revolut Data Platform.
        </p>

        <div class="signoff">
            Sincerely,<br>
            <div class="signature-name">Akash Kaintura</div>
            <div class="signature-title">Senior Backend Engineer | Data Platform & Distributed Systems</div>
        </div>
    </div>
</body>
</html>
`;

async function main() {
  const outputDir = path.resolve(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, 'Akash_Kaintura_Revolut_Cover_Letter.html');
  const pdfPath = path.join(outputDir, 'Akash_Kaintura_Revolut_Cover_Letter.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('Saved HTML to:', htmlPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm',
    },
  });
  await browser.close();

  const stats = fs.statSync(pdfPath);
  console.log(`✅ Cover Letter PDF generated: ${pdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
