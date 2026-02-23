import { BillableEvent, RateCard } from "../models/index.js";

/**
 * Generate the next sequential event_id (EVT-00001).
 * Pass the current transaction so rows inserted within the same
 * transaction are visible, preventing duplicate IDs in batch runs.
 */
export const generateEventId = async (transaction = null) => {
  const last = await BillableEvent.findOne({
    order: [["id", "DESC"]],
    ...(transaction ? { transaction } : {}),
  });
  const next = last ? last.id + 1 : 1;
  return `EVT-${String(next).padStart(5, "0")}`;
};

/**
 * Create a BillableEvent with automatic rate card lookup.
 * Used by GRN, putaway, packing, and shipping hooks.
 *
 * If a matching active rate card is found  → status = READY, amount = qty * rate
 * If no rate card found                    → status = BLOCKED, amount = 0
 */
export const createBillableEvent = async ({
  warehouse_id,
  client_id,
  charge_type,
  reference_type,
  reference_id,
  reference_no,
  qty,
  event_date,
  created_by,
  transaction = null,
}) => {
  const event_id = await generateEventId(transaction);

  const rateCard = await RateCard.findOne({
    where: { client_id, charge_type, is_active: true },
    ...(transaction ? { transaction } : {}),
  });

  const rate = rateCard ? parseFloat(rateCard.rate) : 0;
  const amount = rateCard ? parseFloat(qty) * rate : 0;
  const status = rateCard ? "READY" : "BLOCKED";

  return BillableEvent.create(
    {
      event_id,
      warehouse_id,
      client_id,
      charge_type,
      reference_type,
      reference_id: reference_id ?? null,
      reference_no: reference_no ?? null,
      billing_basis: rateCard?.billing_basis ?? "FLAT_RATE",
      qty,
      rate,
      amount,
      currency: rateCard?.currency ?? "INR",
      rate_card_id: rateCard?.id ?? null,
      event_date,
      status,
      blocked_reason: rateCard ? null : `Missing rate card for ${charge_type}`,
      created_by,
    },
    { transaction },
  );
};

export const createBillableEventsForWave = async (orders, transaction) => {
  const events = [];
  const event_date = new Date();
  for (const order of orders) {
    const {
      warehouse_id,
      client_id,
      id: order_id,
      order_no,
      total_picked_units,
    } = order;

    // Create pick charge
    const pickEvent = await createBillableEvent({
      warehouse_id,
      client_id,
      charge_type: "PICKING",
      reference_type: "SALES_ORDER",
      reference_id: order_id,
      reference_no: order_no,
      qty: total_picked_units,
      event_date,
      created_by: null,
      transaction,
    });
    events.push(pickEvent);
  }
  return events;
};
