const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const et = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : '');
const short = (a) => `${a.slice(0, 6)}…${a.slice(-6)}`;
const safe = (u) => (/^https:\/\//.test(u ?? '') ? u : null);
let data = null;

function mode(d) {
  const t = d.status?.testnet;
  const watch = t?.watch?.stage ? `justweight's testnet watcher: <span class="badge">${esc(t.watch.stage)}</span> ${esc(t.watch.detail ?? '')}` : '';
  const lines = [];
  if (d.network === 'testnet') lines.push('<h2>Testnet</h2><p>Testnet has settlements, so this page measures testnet.</p>');
  else if (d.network === 'devnet') lines.push(`<h2>Devnet demo: testnet isn't measurable yet</h2><p>${esc(d.status?.reason ?? '')}. Until testnet has settlements, this page shows devnet so you can see how it works. Devnet FLOP has no value and devnet activity is not scored. The page switches to testnet on its own once testnet settlements appear.</p>`);
  else lines.push('<h2>No data right now</h2>');
  if (d.unavailable) lines.push(`<p class="bad">The last build couldn't read the network: ${esc(d.unavailable)}. Nothing is shown rather than numbers that weren't checked.</p>`);
  if (d.stale) lines.push(`<p class="bad">Showing the last good build from ${esc(et(d.stale.since))}. The latest build failed: ${esc(d.stale.reason)}</p>`);
  if (d.empty) lines.push(`<p>${esc(d.empty)}.</p>`);
  if (watch) lines.push(`<p class="muted">${watch}</p>`);
  $('mode').innerHTML = lines.join('');
}

function table(d) {
  const a = d.agents ?? [];
  if (d.window) $('meta').innerHTML = `${esc(d.network)}: blocks ${d.window.fromBlock.toLocaleString()}–${d.window.toBlock.toLocaleString()} (about the last ${Math.round(d.window.blocks / 3600)} h at 1 block per second). ${d.totals.settlements} settlements from ${d.totals.agents} addresses, ${esc(d.totals.spentFlop)} FLOP spent. ${d.sources ? `All ${d.sources.crossChecked} re-read on chain via <code>${esc(d.sources.rpc)}</code>.` : ''} Built ${esc(et(d.generatedAt))}.`;
  else $('meta').textContent = d.generatedAt ? `Built ${et(d.generatedAt)}.` : '';
  $('tbl').innerHTML = a.length
    ? `<thead><tr><th>Address</th><th>Settlements</th><th>Spent (FLOP)</th><th>Models</th><th>Last settled</th></tr></thead><tbody>${a.map((r) => `<tr><td><code title="${esc(r.address)}">${esc(short(r.address))}</code></td><td class="num">${r.settlements}</td><td class="num">${esc(r.spentFlop)}</td><td class="num">${r.models}</td><td class="num">${esc(et(r.lastAt))}</td></tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="muted">No settled spend to show.</td></tr></tbody>';
}

function lookup() {
  const q = $('q').value.trim();
  if (!q || !data) { $('hit').innerHTML = ''; return; }
  const r = (data.agents ?? []).find((x) => x.address === q);
  const cmd = `npx -y github:xbtMelchizedek/flop-spend has-spent ${esc(q)}`;
  $('hit').innerHTML = r
    ? `<p class="ok">Yes. ${esc(short(q))} spent ${esc(r.spentFlop)} FLOP on ${esc(data.network)} in ${r.settlements} settlement(s) in this window, last at block ${r.lastBlock.toLocaleString()} (${esc(et(r.lastAt))}).</p>`
    : `<p>Not in this page's window${data.network ? ` (${esc(data.network)}, last ~${Math.round((data.window?.blocks ?? 0) / 3600)} h)` : ''}. For the full history run:</p><pre>${cmd}</pre>`;
}

function docs(d) {
  $('measured').textContent = d.measured ?? '';
  $('docs').innerHTML = (d.docs ?? []).map((x) => `<blockquote>${x.quotes.map((q) => `<p>“${esc(q)}”</p>`).join('')}<p class="muted">${safe(x.url) ? `<a href="${esc(x.url)}" rel="noopener">${esc(x.page)}</a>` : esc(x.page)}, last updated ${esc(x.updated)}, read ${esc(x.read)}.</p></blockquote>`).join('');
}

$('q').addEventListener('input', lookup);
try {
  const r = await fetch('data/spend.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  data = await r.json();
  mode(data); table(data); docs(data);
} catch (e) {
  $('mode').innerHTML = `<h2>No data right now</h2><p class="bad">Could not load spend.json: ${esc(e.message)}</p>`;
}
lookup();
