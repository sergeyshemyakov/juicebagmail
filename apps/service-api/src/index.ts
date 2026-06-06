import "dotenv/config";

import fs from "node:fs";

import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";

import { createServiceDb } from "./db/index.js";
import { loadServiceEnv } from "./lib/env.js";
import {
  createPaymentMiddleware,
  createResourceServer,
} from "./lib/x402.js";
import type { ServiceVariables } from "./lib/x402.js";
import { registerPublicRoutes } from "./routes/public.js";

const env = loadServiceEnv(process.env);

fs.mkdirSync(env.STORAGE_DIR, { recursive: true });

const { db } = createServiceDb(env.SERVICE_DB_PATH);

const app = new Hono<{ Variables: ServiceVariables }>();

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "PAYMENT-SIGNATURE",
      "X-PAYMENT",
    ],
    exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
  }),
);

const resourceServer = createResourceServer(env, db);
app.use("*", createPaymentMiddleware(env, db, resourceServer));

registerPublicRoutes(app, db, env);

serve(
  {
    fetch: app.fetch,
    port: env.SERVICE_PORT,
  },
  () => {
    console.log(`Juicebag service listening on ${env.SERVICE_BASE_URL}`);
  },
);
