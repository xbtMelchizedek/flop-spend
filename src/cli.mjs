#!/usr/bin/env node
// flop-spend: has this address spent on Flop inference yet? Explorer rows, re-read on chain.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { hasSpent } from './hasSpent.mjs';
import { networkStatus } from './status.mjs';
import { buildData, fallbackData, SITE } from './build.mjs';
import { InputError } from './explorer.mjs';
import { MEASURED, DOCS } from './docs.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const HELP = `flop-spend ${VERSION}: settled Flop inference spend per address, cross-checked on chain

  flop-spend has-spent <SS58 address> [--network auto|devnet|testnet] [--check 3] [--max-rows 1000] [--json]
  flop-spend status                     which network is measurable now (testnet once it has settlements)
  flop-spend mcp                        stdio MCP server: flop_has_spent, flop_spend_status
  flop-spend build [--out _site] [--last-blocks 86400]

has-spent exit codes: 0 yes (newest settlements re-read on chain and they agree), 1 no, 2 error or the chain disagrees.
Measured: ${MEASURED}
Not measured: airdrop amounts or eligibility. Flop's docs: ${DOCS.map((d) => d.url).join(' , ')}
Dashboard: ${SITE}`;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a.startsWith('--')) { if (argv[i + 1] === undefined) throw new InputError(a, 'missing value'); o[a.slice(2)] = argv[++i]; }
    else o._.push(a);
  }
  return o;
}

const num = (v, name, d) => {
  if (v === undefined) return d;
  if (!/^\d+$/.test(String(v))) throw new InputError(name, 'must be a whole number');
  return Number(v);
};

export function summary(r) {
  const s = r.settlements;
  const lines = [];
  if (r.note) lines.push(r.note);
  if (!r.spent) lines.push(`NO: ${r.address} has no finalized, charged inference settlement on ${r.network} as an agent (explorer reports ${s.explorerTotal ?? 'unknown'} settlement(s)).`);
  else {
    const scope = s.complete ? `${s.charged} settlement(s)` : `the newest ${s.fetched} of ${s.explorerTotal} settlements (pass --max-rows for more)`;
    lines.push(`${r.verified ? 'YES' : 'UNVERIFIED'}: ${r.address} spent ${r.spentFlop} FLOP on ${r.network} across ${scope}.`);
    lines.push(`Newest: block ${r.newest.block}${r.newest.at ? ` at ${r.newest.at}` : ''}, ${r.newest.spentFlop} FLOP.`);
    lines.push(r.check.agree ? `Chain agrees on the newest ${r.check.checked} (RPC finalized ${r.check.chainFinalized}).` : `Chain check: ${r.check.checked ? 'DISAGREES' : 'nothing final on the RPC node yet'} ${JSON.stringify(r.check.problems)}`);
  }
  lines.push(`Measured: minerPaid + burned per settlement. No airdrop estimate: see ${DOCS[0].url}`);
  return lines.join('\n');
}

const codeOf = (r) => (!r.spent ? 1 : r.verified ? 0 : 2);

export async function main(argv, { out = console.log, fetchImpl, chainFor } = {}) {
  const [cmd, ...rest] = argv;
  try {
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { out(HELP); return cmd ? 0 : 2; }
    if (cmd === '--version' || cmd === 'version') { out(VERSION); return 0; }
    const o = parse(rest);
    if (cmd === 'has-spent') {
      if (o._.length !== 1) throw new InputError('address', 'give exactly one SS58 address');
      const r = await hasSpent(o._[0], { network: o.network ?? 'auto', check: num(o.check, '--check', 3), maxRows: num(o['max-rows'], '--max-rows', 1000), fetchImpl, chainFor });
      out(o.json ? JSON.stringify(r, null, 1) : summary(r));
      return codeOf(r);
    }
    if (cmd === 'status') { out(JSON.stringify(await networkStatus({ fetchImpl }), null, 1)); return 0; }
    if (cmd === 'build') {
      const dir = o.out ?? '_site';
      mkdirSync(`${dir}/data`, { recursive: true });
      let data; let epoch = null;
      try {
        ({ data, epoch } = await buildData({ lastBlocks: num(o['last-blocks'], '--last-blocks', 86400), maxRows: num(o['max-rows'], '--max-rows', 3000), fetchImpl, chainFor }));
      } catch (e) {
        // Degrade, don't fail the deploy: last good data marked stale, or an empty state with the reason.
        data = await fallbackData(e.problems ? `cross-check failed: ${JSON.stringify(e.problems.slice(0, 3))}` : e.message, { fetchImpl });
        try { data.status ??= await networkStatus({ fetchImpl }); } catch { /* keep going */ }
      }
      writeFileSync(`${dir}/data/spend.json`, JSON.stringify(data, null, 1) + '\n');
      if (epoch) writeFileSync(`${dir}/data/epoch.json`, JSON.stringify(epoch, null, 1) + '\n');
      out(JSON.stringify({ network: data.network, totals: data.totals, window: data.window ?? null, empty: data.empty ?? null, stale: data.stale ?? null, unavailable: data.unavailable ?? null, testnet: data.status?.reason ?? null }));
      return 0;
    }
    if (cmd === 'mcp') return serveMcp({ fetchImpl, chainFor });
    throw new InputError('command', `unknown command ${cmd}`);
  } catch (e) {
    out(JSON.stringify({ ok: false, error: e.message }));
    return 2;
  }
}

export const TOOLS = [
  {
    name: 'flop_has_spent',
    description: 'Has this SS58 address spent on Flop inference yet? Reads the address\'s settlements from the Flop explorer, counts only finalized computeChannel settlements where it is the agent, sums minerPaid + burned, and re-reads the newest ones on chain. Uses testnet once testnet has settlements, otherwise devnet (unscored, no value) and says so. It measures spend only; it does not estimate airdrops.',
    inputSchema: { type: 'object', required: ['address'], properties: {
      address: { type: 'string', description: 'SS58 address, e.g. 5F...' },
      network: { type: 'string', enum: ['auto', 'devnet', 'testnet'], default: 'auto' },
      check: { type: 'integer', minimum: 1, maximum: 50, default: 3, description: 'newest settlements to re-read on chain' },
    } },
  },
  {
    name: 'flop_spend_status',
    description: 'Whether Flop testnet spend is measurable yet: testnet explorer health and settlement count, and the justweight testnet watcher stage.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export function makeHandler({ fetchImpl, chainFor } = {}) {
  return async (msg) => {
    const { id, method, params } = msg ?? {};
    const reply = (result) => ({ jsonrpc: '2.0', id, result });
    if (method === 'initialize') return reply({ protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'flop-spend', version: VERSION } });
    if (method?.startsWith('notifications/')) return null;
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: TOOLS });
    if (method === 'tools/call') {
      const a = params?.arguments ?? {};
      const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }] });
      try {
        if (params?.name === 'flop_has_spent') {
          const r = await hasSpent(a.address, { network: a.network ?? 'auto', check: a.check ?? 3, fetchImpl, chainFor });
          return reply({ ...text(`${summary(r)}\n\n${JSON.stringify(r, null, 1)}`), isError: codeOf(r) === 2 });
        }
        if (params?.name === 'flop_spend_status') return reply(text(await networkStatus({ fetchImpl })));
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool ${params?.name}` } };
      } catch (e) {
        return reply({ ...text({ error: e.message }), isError: true });
      }
    }
    return id === undefined ? null : { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  };
}

function serveMcp(opts) {
  const handle = makeHandler(opts);
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n'); return; }
    const res = await handle(msg);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
  return new Promise((resolve) => rl.on('close', () => resolve(0)));
}

function isEntry() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}
if (isEntry()) main(process.argv.slice(2)).then((c) => process.exit(c));
