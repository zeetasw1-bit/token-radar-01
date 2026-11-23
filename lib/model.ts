// The token radar's model, radar-3: a power-law model.
//
// The board ranks every pre-token protocol the snapshot records (the watchlist is the floor, never
// the ceiling) by an implied value that follows only from the snapshot's own figures. The flat
// multiple radar-2 used — market cap per dollar of TVL, the same at every size — is wrong in a
// way the snapshot itself shows: among the live tokens, log(market cap / TVL) falls with
// log(TVL) with slope -0.48, so market cap grows as TVL to the power 0.52, not in proportion to
// TVL. A protocol ten times bigger is worth about three times more, not ten times more. So
// radar-3 fits that exponent from the snapshot's own live tokens by least squares, calibrates
// the scale so the median prediction is exact, and then adjusts each category by its shrunken
// median log-residual: a category that trades above the power law is priced above it, a thin
// category is pulled back toward the market as a whole. No protocol name is ever special-cased:
// the same function scores every row, and the dashboard shows the fit it was priced from.
//
//   log10(mcap / mults) = log10(scale) + alpha x log10(tvl)   (OLS on the live tokens)
//   scale     recalibrated so the median live token is predicted exactly
//   residual  = exp( n x median(log residual in the category) / (n + 5) ), clamped to [0.2, 5]
//   growth    = clamp(change_7d, -40, 80) per cent; growthMult = 1 + growth/100 x 0.6
//   maturity  = 0.7 + 0.3 x min(age_days, 1095) / 1095   (age unknown: 365 days)
//   chains    = 1 + 0.04 x min(chains - 1, 5)           (more chains, more surface to farm)
//   implied   = max(1, round( scale x tvl_usd^alpha x residual x growthMult x maturity x chains ))
//
// The model is checked, not just claimed: leaveOneOut prices each of the snapshot's live tokens
// as if it had no token — refitting the exponent, the scale and the residuals without it — and
// compares the prediction with its real market cap. The dashboard reports that check.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_bonus: number;
  chain_max_extra: number;
  residual_shrink: number;
  residual_floor: number;
  residual_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -40,
  growth_cap: 80,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_bonus: 0.04,
  chain_max_extra: 5,
  residual_shrink: 5,
  residual_floor: 0.2,
  residual_cap: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    power_base: number;
    category_residual: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  power_base: number;
  category_residual: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's residual: how far its live tokens sit from the power law, shrunk toward 1. */
export interface CategoryResidual {
  category: string;
  samples: number;
  residual: number;
}

/** The fitted power law: its exponent, its calibrated scale, and each category's residual. */
export interface PowerLawFit {
  alpha: number;
  scale: number;
  residuals: Map<string, number>;
  table: CategoryResidual[];
}

/** The leave-one-out check of the model against the snapshot's own live tokens. */
export interface ModelValidation {
  n: number;
  alpha: number;
  spearman: number;
  med_abs_log10: number;
  within_2x: number;
  within_5x: number;
}

/** Everything the dashboard needs: the board, the live set, the fit, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  power_law: { alpha: number; scale: number };
  residuals: CategoryResidual[];
  validation: ModelValidation;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The growth, maturity and chain multipliers one protocol gets under `model`. */
export function multipliers(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): { growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_extra);
  const chainMult = 1 + extraChains * model.chain_bonus;
  return { growthPct, growthMult, maturityMult, chainMult, age };
}

/** The live-token protocols a fit is measured from: a market cap and a TVL, both positive. */
function liveTokens(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/**
 * The power-law fit from a list of protocols: least squares on log10(market cap / multipliers)
 * against log10(TVL), the scale recalibrated so the median protocol is predicted exactly, and
 * each category's median log-residual shrunk toward 1 by `residual_shrink` pseudo-observations.
 * A category with no live token prices at the power law itself (residual 1). The exponent is the
 * snapshot's own number, never a hand-picked constant.
 */
export function fitPowerLawFrom(
  protocols: SnapshotProtocol[],
  asOf: string,
  model: ModelConstants = MODEL,
): PowerLawFit {
  const live = liveTokens(protocols);
  if (live.length < 10) {
    // Too few live tokens to fit: a flat 0.5 exponent at the market's own median scale.
    const scale =
      live.length > 0
        ? median(live.map((p) => p.mcap_usd! / (Math.pow(p.tvl_usd, 0.5) * multipliers(p, asOf, model).growthMult * multipliers(p, asOf, model).maturityMult * multipliers(p, asOf, model).chainMult)))
        : 1;
    return { alpha: 0.5, scale, residuals: new Map(), table: [] };
  }
  const xs = live.map((p) => Math.log10(p.tvl_usd));
  const ys = live.map((p) => {
    const m = multipliers(p, asOf, model);
    return Math.log10(p.mcap_usd! / (m.growthMult * m.maturityMult * m.chainMult));
  });
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const alpha = den === 0 ? 0.5 : num / den;
  let scale = 10 ** (my - alpha * mx);
  // Recalibrate the scale on the median residual, so the median live token is priced exactly.
  const baseResiduals = live.map((p) => {
    const m = multipliers(p, asOf, model);
    return p.mcap_usd! / (scale * Math.pow(p.tvl_usd, alpha) * m.growthMult * m.maturityMult * m.chainMult);
  });
  scale *= median(baseResiduals);
  const residuals = new Map<string, number>();
  const table: CategoryResidual[] = [];
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    const m = multipliers(p, asOf, model);
    const r = Math.log(p.mcap_usd! / (scale * Math.pow(p.tvl_usd, alpha) * m.growthMult * m.maturityMult * m.chainMult));
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(r);
    byCategory.set(key, list);
  }
  for (const [category, values] of byCategory) {
    const shrunk = Math.exp((values.length * median(values)) / (values.length + model.residual_shrink));
    const residual = round4(Math.min(model.residual_cap, Math.max(model.residual_floor, shrunk)));
    residuals.set(category, residual);
    table.push({ category, samples: values.length, residual });
  }
  table.sort((a, b) => b.residual - a.residual);
  return { alpha, scale, residuals, table };
}

/** The power-law fit from the snapshot's own live tokens. */
export function fitPowerLaw(snapshot: Snapshot, model: ModelConstants = MODEL): PowerLawFit {
  return fitPowerLawFrom(snapshot.protocols, snapshot.as_of, model);
}

/** The multipliers and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: PowerLawFit,
  model: ModelConstants = MODEL,
): {
  implied: number;
  powerBase: number;
  categoryResidual: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const m = multipliers(protocol, asOf, model);
  // The power-law base is the fit's own arithmetic, carried whole into the row so the number the
  // board carries, the number data.js carries and the number the page recomputes are the same.
  const powerBase = fit.scale * Math.pow(protocol.tvl_usd, fit.alpha);
  const categoryResidual = fit.residuals.get(protocol.category ?? 'Other') ?? 1;
  const implied = Math.max(
    1,
    Math.round(powerBase * categoryResidual * m.growthMult * m.maturityMult * m.chainMult),
  );
  return { implied, powerBase, categoryResidual, growthPct: m.growthPct, growthMult: m.growthMult, maturityMult: m.maturityMult, chainMult: m.chainMult, age: m.age };
}

/** Spearman rank correlation, with ties averaged. */
export function spearman(xs: number[], ys: number[]): number {
  const rank = (arr: number[]): number[] => {
    const idx = arr.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]![1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

/**
 * The leave-one-out check: each live token is priced as if it had no token, refitting the
 * exponent, the scale and the residuals without it, and the prediction is compared with its real
 * market cap. This is the number the dashboard reports for the model, and the number the
 * category-benchmark model it replaces scored on the same check.
 */
export function leaveOneOut(snapshot: Snapshot, model: ModelConstants = MODEL): ModelValidation {
  const live = liveTokens(snapshot.protocols);
  const fit = fitPowerLaw(snapshot, model);
  const preds: number[] = [];
  const actuals: number[] = [];
  for (const p of live) {
    const others = snapshot.protocols.filter((q) => q.slug !== p.slug);
    const loo = fitPowerLawFrom(others, snapshot.as_of, model);
    preds.push(impliedValue(p, snapshot.as_of, loo, model).implied);
    actuals.push(p.mcap_usd!);
  }
  const errs = preds.map((pr, i) => Math.abs(Math.log10(pr / actuals[i]!)));
  const within = (k: number): number =>
    preds.filter((pr, i) => pr / actuals[i]! >= 1 / k && pr / actuals[i]! <= k).length / preds.length;
  return {
    n: live.length,
    alpha: round4(fit.alpha),
    spearman: round4(spearman(preds, actuals)),
    med_abs_log10: round4(median(errs)),
    within_2x: round4(within(2)),
    within_5x: round4(within(5)),
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word that says it is a wrapped or staked product of another token. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;

/** Categories that are a token that already trades, worn in another shape. */
const NOT_A_LAUNCH = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, bridge, wrapped or
 *  staked product, and not a versioned pool of another protocol. The watchlist's own rule, applied
 *  to every protocol below the floor too. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !NOT_A_LAUNCH.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = fitPowerLaw(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, ranked on its own record.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, floor or no floor. The board is the
  // whole pre-token universe the snapshot records, not a capped sample of it.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      power_base: s.powerBase,
      category_residual: s.categoryResidual,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, borrowing a small amount against it once.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain}, in the pair the protocol itself promotes, and keep the position open.`;
  if (c.includes('yield') || c.includes('yield aggregator')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in its own app instead of bridging straight back.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it after a week.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, on a market that settles within the month.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares through at least one rebalance.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it, claiming any yield it pays.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position through one funding cycle.`;
  if (c.includes('privacy')) return `Use $${capital} through ${name}'s private pool on ${chain} for one shielded deposit and one withdrawal.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index token on ${chain} and hold it.`;
  if (c.includes('launchpad')) return `Stake $${capital} through ${name}'s launchpad on ${chain} and join one sale or allocation round.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different action on the protocol's second chain, when it runs on more than one. */
function secondChainAction(p: SnapshotProtocol, capital: number): string | null {
  if (p.chains.length < 2) return null;
  const second = p.chains[1]!;
  return `Repeat the same position with $${Math.max(25, Math.round(capital / 2))} on ${second}, the protocol's second chain, so activity is recorded on more than one chain.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Every step names what it costs and how long it takes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondChainAction(p, capital);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline, never in a screenshot or a form.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    steps.push({
      text: second,
      cost: `about $${Math.max(25, Math.round(capital / 2))} of capital and $3 of gas`,
      time: '10 minutes',
    });
  }
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet shows steady use rather than one deposit.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot of the protocol.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from the link its own site publishes, and claim only there. Never pay a fee to claim, and never follow a claim link from a chat or a search ad.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then plan the exit: one withdrawal, the gas it needs, and what you do with the position if no token ever comes.`,
      cost: 'nothing but the log, plus about $3 of gas to exit',
      time: '5 minutes to log, 10 to exit',
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    power_base: row.model.power_base,
    category_residual: row.model.category_residual,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const fit = fitPowerLaw(snapshot, model);
  const validation = leaveOneOut(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    power_law: { alpha: round4(fit.alpha), scale: fit.scale },
    residuals: fit.table,
    validation,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
