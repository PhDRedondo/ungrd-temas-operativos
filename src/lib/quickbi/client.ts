/**
 * Emisor de accessTicket QuickBI (CreateTicket OpenAPI) + caché en memoria.
 * Port del servicio SNI (`quickbi_client.py`) a Next.js.
 */

import QuickBiClient, { CreateTicketRequest } from "@alicloud/quickbi-public20220101";
import { $OpenApiUtil } from "@alicloud/openapi-core";

export class TicketUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketUpstreamError";
  }
}

export type IssuedTicket = {
  ticket: string;
  expiresAt: Date;
};

type CachedTicket = {
  ticket: string;
  expiresAt: Date;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getQuickBiHost(): string {
  return (
    process.env.QUICKBI_HOST?.trim() || "bi-us-east-1.alibabacloud.com"
  ).replace(/^https?:\/\//, "");
}

export function hasQuickBiCredentials(): boolean {
  return Boolean(
    process.env.QUICKBI_ACCESS_KEY_ID?.trim() &&
      process.env.QUICKBI_ACCESS_KEY_SECRET?.trim(),
  );
}

let clientSingleton: InstanceType<typeof QuickBiClient> | null = null;

function getClient(): InstanceType<typeof QuickBiClient> {
  const accessKeyId = process.env.QUICKBI_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.QUICKBI_ACCESS_KEY_SECRET?.trim();
  if (!accessKeyId || !accessKeySecret) {
    throw new TicketUpstreamError("QuickBI AccessKey no configurado");
  }
  if (!clientSingleton) {
    const endpoint =
      process.env.QUICKBI_ENDPOINT?.trim() ||
      "quickbi-public.us-east-1.aliyuncs.com";
    const config = new $OpenApiUtil.Config({
      accessKeyId,
      accessKeySecret,
      endpoint,
    });
    clientSingleton = new QuickBiClient(config);
  }
  return clientSingleton;
}

const cache = new Map<string, CachedTicket>();
const inflight = new Map<string, Promise<IssuedTicket>>();

function refreshThresholdMs(): number {
  return envInt("QUICKBI_TICKET_REFRESH_MINUTES", 10080) * 60_000;
}

function expireMinutes(): number {
  return envInt("QUICKBI_TICKET_EXPIRE_MINUTES", 129_600);
}

async function createTicketUpstream(
  pageId: string,
  globalParamJson?: string | null,
): Promise<IssuedTicket> {
  const client = getClient();
  const request = new CreateTicketRequest({
    worksId: pageId,
    expireTime: expireMinutes(),
    ticketNum: 99_999,
    ...(globalParamJson ? { globalParam: globalParamJson } : {}),
  });

  let response: Awaited<ReturnType<typeof client.createTicket>>;
  try {
    response = await client.createTicket(request);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : "unknown";
    console.warn("[quickbi] createTicket failed", { code, message });
    throw new TicketUpstreamError("QuickBI rechazó CreateTicket");
  }

  const body = response.body;
  const success = Boolean(body?.success);
  const ticket = body?.result;
  if (!success || !ticket || typeof ticket !== "string") {
    throw new TicketUpstreamError("QuickBI devolvió respuesta sin ticket");
  }

  return {
    ticket,
    expiresAt: new Date(Date.now() + expireMinutes() * 60_000),
  };
}

/**
 * Obtiene (o reutiliza) un accessTicket para `pageId`.
 */
export async function getQuickBiTicket(
  pageId: string,
  globalParamJson?: string | null,
): Promise<IssuedTicket> {
  const key = globalParamJson ? `${pageId}|${globalParamJson}` : pageId;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt.getTime() - now > refreshThresholdMs()) {
    return { ticket: cached.ticket, expiresAt: cached.expiresAt };
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const issued = await createTicketUpstream(pageId, globalParamJson);
      cache.set(key, { ticket: issued.ticket, expiresAt: issued.expiresAt });
      return issued;
    } catch (err) {
      cache.delete(key);
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}
