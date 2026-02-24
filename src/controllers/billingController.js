import {
  BillableEvent,
  RateCard,
  Inventory,
  InventoryTransaction,
  Client,
  SKU,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";
import { generateEventId } from "../utils/billingHelpers.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns an inclusive array of YYYY-MM-DD strings between two date strings. */
const getDayRange = (start, end) => {
  const days = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

/**
 * Fetch inventory transactions for a specific client in a warehouse,
 * filtered by a created_at range.  Uses a raw query because grouping
 * InventoryTransaction by SKU.client_id through Sequelize include+GROUP
 * is unreliable in MySQL.
 */
const getClientTransactions = async (warehouse_id, client_id, fromDate, toDate) => {
  return sequelize.query(
    `SELECT it.qty, it.created_at
     FROM inventory_transactions it
     JOIN skus s ON it.sku_id = s.id
     WHERE it.warehouse_id = :warehouse_id
       AND s.client_id    = :client_id
       AND it.created_at  BETWEEN :from_date AND :to_date
     ORDER BY it.created_at ASC`,
    {
      replacements: {
        warehouse_id,
        client_id,
        from_date: fromDate,
        to_date: toDate,
      },
      type: sequelize.QueryTypes.SELECT,
    },
  );
};

// ---------------------------------------------------------------------------
// Core billing engine (shared by /run and /preview)
// ---------------------------------------------------------------------------

const processBillingRun = async (params, dryRun, t) => {
  const { warehouse_id, start_date, end_date, client_id, charge_types, user_id } =
    params;

  const summary = {
    events_created: 0,
    events_ready: 0,
    events_blocked: 0,
    total_amount: 0,
  };
  const previewItems = []; // populated only in dry-run mode

  // Convenience: spread transaction/lock options only when persisting
  const txOpts = dryRun ? {} : { transaction: t };
  const txLockOpts = dryRun ? {} : { transaction: t, lock: t.LOCK.UPDATE };

  // -------------------------------------------------------------------------
  // 1. NON-STORAGE charges — update existing PENDING events
  // -------------------------------------------------------------------------
  const nonStorageTypes = charge_types.filter((ct) => ct !== "STORAGE");

  if (nonStorageTypes.length > 0) {
    const whereClause = {
      warehouse_id,
      status: "PENDING",
      charge_type: { [Op.in]: nonStorageTypes },
      event_date: { [Op.between]: [start_date, end_date] },
    };
    if (client_id) whereClause.client_id = client_id;

    const pendingEvents = await BillableEvent.findAll({
      where: whereClause,
      ...txLockOpts,
    });

    for (const event of pendingEvents) {
      const rateCard = await RateCard.findOne({
        where: {
          client_id: event.client_id,
          charge_type: event.charge_type,
          is_active: true,
        },
        ...txOpts,
      });

      if (dryRun) {
        const wouldBeAmount = rateCard
          ? parseFloat(event.qty) * parseFloat(rateCard.rate)
          : 0;
        previewItems.push({
          type: "existing_event",
          event_id: event.event_id,
          id: event.id,
          client_id: event.client_id,
          charge_type: event.charge_type,
          qty: parseFloat(event.qty),
          rate: rateCard ? parseFloat(rateCard.rate) : 0,
          amount: wouldBeAmount,
          current_status: event.status,
          would_be_status: rateCard ? "READY" : "BLOCKED",
          blocked_reason: rateCard
            ? null
            : `Missing rate card for ${event.charge_type}`,
        });
        if (rateCard) {
          summary.events_ready++;
          summary.total_amount += wouldBeAmount;
        } else {
          summary.events_blocked++;
        }
      } else {
        if (rateCard) {
          const amount = parseFloat(event.qty) * parseFloat(rateCard.rate);
          await event.update(
            {
              rate: rateCard.rate,
              amount,
              rate_card_id: rateCard.id,
              status: "READY",
              updated_by: user_id,
            },
            { transaction: t },
          );
          summary.events_ready++;
          summary.total_amount += amount;
        } else {
          await event.update(
            {
              status: "BLOCKED",
              blocked_reason: `Missing rate card for ${event.charge_type}`,
              updated_by: user_id,
            },
            { transaction: t },
          );
          summary.events_blocked++;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. STORAGE charges — reconstruct daily balances from InventoryTransaction
  // -------------------------------------------------------------------------
  if (charge_types.includes("STORAGE")) {
    // Find all distinct clients with inventory in this warehouse
    const invWhere = { warehouse_id };
    if (client_id) invWhere.client_id = client_id;

    // Combine: clients with current stock + clients with transactions in period
    const [currentInvRows, periodTxnClientRows] = await Promise.all([
      Inventory.findAll({
        where: invWhere,
        attributes: ["client_id"],
        group: ["client_id"],
        raw: true,
      }),
      sequelize.query(
        `SELECT DISTINCT s.client_id
         FROM inventory_transactions it
         JOIN skus s ON it.sku_id = s.id
         WHERE it.warehouse_id = :warehouse_id
           AND it.created_at BETWEEN :start AND :end
           ${client_id ? "AND s.client_id = :client_id" : ""}`,
        {
          replacements: {
            warehouse_id,
            start: start_date + " 00:00:00",
            end: end_date + " 23:59:59",
            ...(client_id ? { client_id } : {}),
          },
          type: sequelize.QueryTypes.SELECT,
        },
      ),
    ]);

    const clientIds = [
      ...new Set([
        ...currentInvRows.map((r) => r.client_id),
        ...periodTxnClientRows.map((r) => r.client_id),
      ]),
    ];

    for (const cid of clientIds) {
      // Skip if a non-void storage event already exists for this exact period
      const existingEvent = await BillableEvent.findOne({
        where: {
          client_id: cid,
          warehouse_id,
          charge_type: "STORAGE",
          storage_start_date: start_date,
          storage_end_date: end_date,
          status: { [Op.ne]: "VOID" },
        },
        ...txOpts,
      });
      if (existingEvent) continue;

      // Current on-hand total for this client in this warehouse
      const [invSumRow] = await Inventory.findAll({
        where: { warehouse_id, client_id: cid },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("on_hand_qty")), "total"],
        ],
        raw: true,
      });
      const currentQty = parseFloat(invSumRow?.total) || 0;

      // Transactions AFTER the period end → subtract to get closing balance
      const postTxns = await getClientTransactions(
        warehouse_id,
        cid,
        end_date + " 23:59:59.001",
        "9999-12-31 23:59:59",
      );
      const postTotal = postTxns.reduce((sum, tx) => sum + tx.qty, 0);
      const closingQty = currentQty - postTotal;

      // Transactions WITHIN the period → needed for day-by-day replay
      const periodTxns = await getClientTransactions(
        warehouse_id,
        cid,
        start_date + " 00:00:00",
        end_date + " 23:59:59",
      );
      const periodTotal = periodTxns.reduce((sum, tx) => sum + tx.qty, 0);

      // Opening balance at period start
      const openingQty = closingQty - periodTotal;

      // Build daily quantity snapshot (qty at end of each day)
      const days = getDayRange(start_date, end_date);
      const storageDetails = {};
      let totalUnitDays = 0;

      for (const day of days) {
        const dayEnd = new Date(day + "T23:59:59");
        const cumulative = periodTxns
          .filter((tx) => new Date(tx.created_at) <= dayEnd)
          .reduce((sum, tx) => sum + tx.qty, 0);
        const dayQty = Math.max(0, openingQty + cumulative);
        storageDetails[day] = dayQty;
        totalUnitDays += dayQty;
      }

      // Look up storage rate card for this client
      const rateCard = await RateCard.findOne({
        where: { client_id: cid, charge_type: "STORAGE", is_active: true },
        ...txOpts,
      });

      const rate = rateCard ? parseFloat(rateCard.rate) : 0;
      const amount = totalUnitDays * rate;
      const status = rateCard ? "READY" : "BLOCKED";
      const blocked_reason = rateCard ? null : "Missing rate card for STORAGE";

      if (dryRun) {
        previewItems.push({
          type: "storage_event",
          client_id: cid,
          charge_type: "STORAGE",
          period: `${start_date} to ${end_date}`,
          total_unit_days: totalUnitDays,
          rate,
          amount,
          would_be_status: status,
          blocked_reason,
          daily_breakdown: storageDetails,
        });
      } else {
        const event_id = await generateEventId(t);
        await BillableEvent.create(
          {
            event_id,
            warehouse_id,
            client_id: cid,
            charge_type: "STORAGE",
            reference_type: "STORAGE_PERIOD",
            reference_no: `${start_date} to ${end_date}`,
            billing_basis: rateCard?.billing_basis ?? "PER_UNIT_PER_DAY",
            qty: totalUnitDays,
            rate,
            amount,
            currency: rateCard?.currency ?? "INR",
            rate_card_id: rateCard?.id ?? null,
            storage_start_date: start_date,
            storage_end_date: end_date,
            storage_details: storageDetails,
            event_date: end_date,
            description: `Storage charges: ${start_date} to ${end_date}`,
            status,
            blocked_reason,
            created_by: user_id,
          },
          { transaction: t },
        );
        summary.events_created++;
      }

      if (status === "READY") {
        summary.events_ready++;
        summary.total_amount += amount;
      } else {
        summary.events_blocked++;
      }
    }
  }

  return { summary, previewItems };
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

// POST /api/billing/run
const runBilling = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { warehouse_id, start_date, end_date, client_id, charge_types } =
      req.body;

    const { summary } = await processBillingRun(
      { warehouse_id, start_date, end_date, client_id, charge_types, user_id: req.user.id },
      false,
      t,
    );

    await t.commit();

    res.json({ success: true, data: summary });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// POST /api/billing/preview — same logic, no writes
const previewBilling = async (req, res, next) => {
  try {
    const { warehouse_id, start_date, end_date, client_id, charge_types } =
      req.body;

    const { summary, previewItems } = await processBillingRun(
      { warehouse_id, start_date, end_date, client_id, charge_types, user_id: req.user.id },
      true,
      null,
    );

    res.json({
      success: true,
      data: {
        preview: true,
        summary,
        events: previewItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/billing/ready-to-invoice — READY events grouped by client with totals
const getReadyToInvoice = async (req, res, next) => {
  try {
    const { warehouse_id, client_id } = req.query;

    const whereClause = { status: "READY" };
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (client_id) whereClause.client_id = client_id;

    const rows = await BillableEvent.findAll({
      where: whereClause,
      attributes: [
        "client_id",
        "warehouse_id",
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("COUNT", sequelize.col("id")), "event_count"],
      ],
      group: ["client_id", "warehouse_id"],
      raw: true,
    });

    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const clientIds = [...new Set(rows.map((r) => r.client_id))];
    const clients = await Client.findAll({
      where: { id: clientIds },
      attributes: ["id", "client_name", "client_code"],
    });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.toJSON()]));

    // Fetch all READY events for the matched client/warehouse combinations
    const events = await BillableEvent.findAll({
      where: whereClause,
      order: [["event_date", "ASC"]],
    });

    // Group events by client_id + warehouse_id key
    const eventMap = {};
    for (const event of events) {
      const key = `${event.client_id}_${event.warehouse_id}`;
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push(event);
    }

    const result = rows.map((r) => ({
      client_id: r.client_id,
      warehouse_id: r.warehouse_id,
      client: clientMap[r.client_id] ?? null,
      ready_amount: parseFloat(r.total_amount) || 0,
      event_count: parseInt(r.event_count) || 0,
      events: eventMap[`${r.client_id}_${r.warehouse_id}`] ?? [],
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export { runBilling, previewBilling, getReadyToInvoice };
