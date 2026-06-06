import { decodePaymentResponseHeader, x402HTTPResourceServer } from "@x402-avm/core/http";
import { HTTPFacilitatorClient } from "@x402-avm/core/server";
import { HonoAdapter, x402ResourceServer } from "@x402-avm/hono";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402-avm/avm";
import {
  ROUTE_KEYS,
  ROUTE_PRICES,
} from "@juicebag-mail/shared";
import type { MiddlewareHandler } from "hono";

import { createId, nowIso } from "./ids.js";
import { payments } from "../db/schema.js";
import type { ServiceDatabase } from "../db/index.js";
import type { ServiceEnv } from "./env.js";

export type PaymentMeta = {
  routeKey: string;
  amountUsd: number;
  agentId?: string;
  mailboxId?: string;
};

export type PaymentFinalizeResult = {
  body: unknown;
  paymentMeta?: Partial<PaymentMeta>;
};

export type ServiceVariables = {
  paymentMeta?: PaymentMeta;
  paymentFinalize?: (txid: string) => Promise<PaymentFinalizeResult>;
};

export function createRouteConfig(env: ServiceEnv) {
  return {
    "POST /v1/registrations": {
      accepts: {
        scheme: "exact",
        price: ROUTE_PRICES.registration,
        network: ALGORAND_TESTNET_CAIP2,
        payTo: env.SELLER_ADDRESS,
        extra: { asset: USDC_TESTNET_ASA_ID },
      },
      description: "Register a Juicebag Mail mailbox",
      mimeType: "application/json",
    },
    "POST /v1/outbound-letters": {
      accepts: {
        scheme: "exact",
        price: ROUTE_PRICES.outboundLetter,
        network: ALGORAND_TESTNET_CAIP2,
        payTo: env.SELLER_ADDRESS,
        extra: { asset: USDC_TESTNET_ASA_ID },
      },
      description: "Queue a physical outbound letter",
      mimeType: "application/json",
    },
    "POST /v1/inbound-letters/unlock": {
      accepts: {
        scheme: "exact",
        price: ROUTE_PRICES.inboundUnlock,
        network: ALGORAND_TESTNET_CAIP2,
        payTo: env.SELLER_ADDRESS,
        extra: { asset: USDC_TESTNET_ASA_ID },
      },
      description: "Unlock OCR text for an inbound letter",
      mimeType: "application/json",
    },
  } as const;
}

export function createResourceServer(env: ServiceEnv, db: ServiceDatabase) {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: env.FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);
  registerExactAvmScheme(resourceServer, {
    networks: [ALGORAND_TESTNET_CAIP2],
  });

  resourceServer.onAfterSettle(async () => {
    void db;
  });

  return resourceServer;
}

export function createPaymentMiddleware(
  env: ServiceEnv,
  db: ServiceDatabase,
  resourceServer: x402ResourceServer,
): MiddlewareHandler<{ Variables: ServiceVariables }> {
  const httpServer = new x402HTTPResourceServer(
    resourceServer,
    createRouteConfig(env),
  );

  let initPromise: Promise<void> | null = httpServer.initialize();

  return async (c, next) => {
    const adapter = new HonoAdapter(c);
    const requestContext = {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader:
        adapter.getHeader("payment-signature") ?? adapter.getHeader("x-payment"),
    };

    if (!httpServer.requiresPayment(requestContext)) {
      await next();
      return;
    }

    if (initPromise) {
      await initPromise;
      initPromise = null;
    }

    const result = await httpServer.processHTTPRequest(requestContext);

    if (result.type === "no-payment-required") {
      await next();
      return;
    }

    if (result.type === "payment-error") {
      Object.entries(result.response.headers).forEach(([key, value]) => {
        c.header(key, value);
      });

      if (result.response.isHtml) {
        c.res = new Response(String(result.response.body ?? ""), {
          status: result.response.status,
          headers: result.response.headers,
        });
        return;
      }

      c.res = Response.json(result.response.body ?? {}, {
        status: result.response.status,
        headers: result.response.headers,
      });
      return;
    }

    await next();

    let res = c.res;

    if (!res || res.status >= 400) {
      return;
    }

    const responseBody = Buffer.from(await res.clone().arrayBuffer());
    c.res = undefined;

    const settleResult = await httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      {
        request: requestContext,
        responseBody,
      },
    );

    if (!settleResult.success) {
      const response = settleResult.response;
      c.res = new Response(
        response.isHtml
          ? String(response.body ?? "")
          : JSON.stringify(response.body ?? {}),
        {
          status: response.status,
          headers: response.headers,
        },
      );
      return;
    }

    const settlement = decodePaymentResponseHeader(
      settleResult.headers["PAYMENT-RESPONSE"],
    );
    const txid = settlement.transaction;
    const finalize = c.get("paymentFinalize");
    const initialMeta = c.get("paymentMeta");

    let responsePayload: unknown;
    let finalMeta = initialMeta;

    if (finalize) {
      const finalized = await finalize(txid);
      responsePayload = finalized.body;
      finalMeta = initialMeta
        ? {
            ...initialMeta,
            ...finalized.paymentMeta,
          }
        : undefined;
    } else if (res.headers.get("content-type")?.includes("application/json")) {
      responsePayload = JSON.parse(responseBody.toString("utf8"));
    }

    if (finalMeta) {
      await db.insert(payments).values({
        id: createId("pay"),
        routeKey: finalMeta.routeKey,
        agentId: finalMeta.agentId ?? null,
        mailboxId: finalMeta.mailboxId ?? null,
        txid,
        amountUsd: String(finalMeta.amountUsd),
        network: result.paymentRequirements.network,
        payTo: result.paymentRequirements.payTo,
        status: "settled",
        createdAt: nowIso(),
      });
    }

    Object.entries(settleResult.headers).forEach(([key, value]) => {
      res.headers.set(key, value);
    });

    if (responsePayload && typeof responsePayload === "object" && !Array.isArray(responsePayload)) {
      const body = {
        ...(responsePayload as Record<string, unknown>),
        x402: {
          txid,
        },
      };

      c.res = Response.json(body, {
        status: res.status,
        headers: res.headers,
      });
      return;
    }

    c.res = res;
  };
}

export const PAYMENT_ROUTE_KEYS = ROUTE_KEYS;
