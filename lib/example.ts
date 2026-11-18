import { generateGo, generateTs } from "./codegen";
import { buildSchema } from "./schema";

/**
 * Two payloads used on the landing page. The code shown there is produced by
 * the same generator the app uses, so the example cannot drift from the tool.
 */
const samples: unknown[] = [
  {
    id: "evt_8f2c41",
    type: "payment.succeeded",
    created_at: "2026-11-17T14:02:11Z",
    amount: 12000,
    currency: "USD",
    customer: {
      id: "cus_2Kq",
      email: "buyer@example.com",
    },
    coupon: null,
    metadata: {
      order_id: "ord_9174",
    },
  },
  {
    id: "evt_8f2d02",
    type: "payment.succeeded",
    created_at: "2026-11-17T14:04:38Z",
    amount: 4500,
    currency: "USD",
    customer: {
      id: "cus_3Lm",
      email: "second@example.com",
    },
    coupon: "LAUNCH20",
    metadata: {
      order_id: "ord_9175",
    },
  },
];

export const exampleSchema = buildSchema(samples, new Date(0));
export const exampleGo = generateGo(exampleSchema, "payment.succeeded");
export const exampleTs = generateTs(exampleSchema, "payment.succeeded");
