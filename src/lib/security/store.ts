/**
 * Almacén en memoria (Edge-safe) para rate limit y bans.
 * En serverless multi-instancia cada isolate tiene su mapa;
 * para flotas grandes usar Redis (Upstash) — ver docs/SECURITY.md.
 */

type CounterBucket = {
  timestamps: number[];
};

type BanRecord = {
  until: number;
  strikes: number;
  reason: string;
  createdAt: number;
};

type StrikeBucket = {
  count: number;
  resetAt: number;
};

const g = globalThis as typeof globalThis & {
  __ungrdSecCounters?: Map<string, CounterBucket>;
  __ungrdSecBans?: Map<string, BanRecord>;
  __ungrdSecStrikes?: Map<string, StrikeBucket>;
};

function counters() {
  if (!g.__ungrdSecCounters) g.__ungrdSecCounters = new Map();
  return g.__ungrdSecCounters;
}

function bans() {
  if (!g.__ungrdSecBans) g.__ungrdSecBans = new Map();
  return g.__ungrdSecBans;
}

function strikes() {
  if (!g.__ungrdSecStrikes) g.__ungrdSecStrikes = new Map();
  return g.__ungrdSecStrikes;
}

export function pruneOldTimestamps(ts: number[], windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (ts.length && ts[0]! < cutoff) ts.shift();
}

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const map = counters();
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }
  pruneOldTimestamps(bucket.timestamps, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSec: 0,
  };
}

export function getBan(ip: string, now = Date.now()): BanRecord | null {
  const map = bans();
  const rec = map.get(ip);
  if (!rec) return null;
  if (rec.until <= now) {
    map.delete(ip);
    return null;
  }
  return rec;
}

export function setBan(
  ip: string,
  durationMs: number,
  reason: string,
  prevStrikes = 0,
  now = Date.now(),
): BanRecord {
  const map = bans();
  const rec: BanRecord = {
    until: now + durationMs,
    strikes: prevStrikes + 1,
    reason,
    createdAt: now,
  };
  map.set(ip, rec);
  return rec;
}

export function clearBan(ip: string) {
  bans().delete(ip);
}

export function listBans(now = Date.now()) {
  const out: { ip: string; until: number; strikes: number; reason: string }[] =
    [];
  for (const [ip, rec] of bans()) {
    if (rec.until <= now) {
      bans().delete(ip);
      continue;
    }
    out.push({
      ip,
      until: rec.until,
      strikes: rec.strikes,
      reason: rec.reason,
    });
  }
  return out.sort((a, b) => b.until - a.until);
}

/** Acumula strikes en ventana; retorna total actual. */
export function addStrike(
  ip: string,
  windowMs: number,
  now = Date.now(),
): number {
  const map = strikes();
  let b = map.get(ip);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    map.set(ip, b);
  }
  b.count += 1;
  return b.count;
}

export function getStrikeCount(ip: string, now = Date.now()): number {
  const b = strikes().get(ip);
  if (!b || b.resetAt <= now) return 0;
  return b.count;
}

export function securityStats() {
  return {
    activeBans: listBans().length,
    trackedIps: counters().size,
    strikeIps: strikes().size,
  };
}
