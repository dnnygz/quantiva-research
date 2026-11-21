import type { Context } from 'hono';
import type { Db } from './db/client';
import type { AdminUser } from '@qa/shared';

export interface Bindings {
  HYPERDRIVE: Hyperdrive;
  FIGURES: R2Bucket;
  FRONTEND_ORIGIN: string;
  COOKIE_SECURE: string;
}

export interface Variables {
  db: Db;
  user: AdminUser;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
export type AppContext = Context<AppEnv>;
