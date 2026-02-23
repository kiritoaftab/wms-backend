import {
  BillableEvent,
  Client,
  Warehouse,
  RateCard,
  User,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";
import { generateEventId } from "../utils/billingHelpers.js";

// GET /api/billable-events
const getAllBillableEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { client_id, status, charge_type, warehouse_id, date_from, date_to } =
      req.query;

    const whereClause = {};
    if (client_id) whereClause.client_id = client_id;
    if (status) whereClause.status = status;
    if (charge_type) whereClause.charge_type = charge_type;
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (date_from || date_to) {
      whereClause.event_date = {};
      if (date_from) whereClause.event_date[Op.gte] = date_from;
      if (date_to) whereClause.event_date[Op.lte] = date_to;
    }

    const { count, rows } = await BillableEvent.findAndCountAll({
      where: whereClause,
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
      limit,
      offset,
      order: [
        ["event_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: {
        billable_events: rows,
        pagination: {
          total: count,
          page,
          pages: Math.ceil(count / limit),
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/billable-events/summary
// Returns PENDING/READY/BLOCKED totals grouped by client (unbilled only).
const getSummary = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;

    const whereClause = {
      status: { [Op.in]: ["PENDING", "READY", "BLOCKED"] },
    };
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;

    // Raw aggregation — avoids GROUP BY + include complexity in MySQL
    const rows = await BillableEvent.findAll({
      where: whereClause,
      attributes: [
        "client_id",
        "status",
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("COUNT", sequelize.col("id")), "event_count"],
      ],
      group: ["client_id", "status"],
      raw: true,
    });

    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Fetch client names in a single query
    const clientIds = [...new Set(rows.map((r) => r.client_id))];
    const clients = await Client.findAll({
      where: { id: clientIds },
      attributes: ["id", "client_name", "client_code"],
    });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.toJSON()]));

    // Pivot rows into one object per client
    const byClient = {};
    for (const row of rows) {
      const cid = row.client_id;
      if (!byClient[cid]) {
        byClient[cid] = {
          client_id: cid,
          client: clientMap[cid] ?? null,
          pending_amount: 0,
          ready_amount: 0,
          blocked_amount: 0,
          pending_count: 0,
          ready_count: 0,
          blocked_count: 0,
        };
      }
      const key = row.status.toLowerCase();
      byClient[cid][`${key}_amount`] = parseFloat(row.total_amount) || 0;
      byClient[cid][`${key}_count`] = parseInt(row.event_count) || 0;
    }

    const summary = Object.values(byClient).map((c) => ({
      ...c,
      total_unbilled: c.pending_amount + c.ready_amount + c.blocked_amount,
    }));

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// GET /api/billable-events/:id
const getBillableEventById = async (req, res, next) => {
  try {
    const event = await BillableEvent.findByPk(req.params.id, {
      include: [
        { model: Client },
        { model: Warehouse },
        { model: RateCard },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Billable event not found",
      });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

// PUT /api/billable-events/:id
// Adjustable fields: qty, rate, amount, notes, description, status, blocked_reason.
// Blocked if event is already INVOICED.
const updateBillableEvent = async (req, res, next) => {
  try {
    const event = await BillableEvent.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Billable event not found",
      });
    }

    if (event.status === "INVOICED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a billable event that has been invoiced",
      });
    }

    const { qty, rate, amount, notes, description, status, blocked_reason } =
      req.body;

    await event.update({
      qty,
      rate,
      amount,
      notes,
      description,
      status,
      blocked_reason,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Billable event updated successfully",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/billable-events/manual
const createManualEvent = async (req, res, next) => {
  try {
    const { warehouse_id, client_id, description, qty, rate, amount, event_date, notes } =
      req.body;

    const event_id = await generateEventId();

    const event = await BillableEvent.create({
      event_id,
      warehouse_id,
      client_id,
      charge_type: "MANUAL",
      reference_type: "MANUAL",
      billing_basis: "MANUAL",
      qty,
      rate,
      amount,
      description,
      event_date,
      notes,
      status: "PENDING",
      rate_card_id: null,
      created_by: req.user.id,
    });

    const createdEvent = await BillableEvent.findByPk(event.id, {
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Manual billable event created successfully",
      data: createdEvent,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/billable-events/:id/void
const voidBillableEvent = async (req, res, next) => {
  try {
    const event = await BillableEvent.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Billable event not found",
      });
    }

    if (event.status === "INVOICED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot void a billable event that has been invoiced. Void the invoice first.",
      });
    }

    if (event.status === "VOID") {
      return res.status(400).json({
        success: false,
        message: "Billable event is already voided",
      });
    }

    await event.update({
      status: "VOID",
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Billable event voided successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllBillableEvents,
  getSummary,
  getBillableEventById,
  updateBillableEvent,
  createManualEvent,
  voidBillableEvent,
};
