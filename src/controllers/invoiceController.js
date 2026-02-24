import {
  Invoice,
  BillableEvent,
  Client,
  Warehouse,
  Payment,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse payment_terms string into number of days.
 *  "NET30" → 30, "NET60" → 60, "IMMEDIATE" → 0, null → 30 */
const parsePaymentTerms = (terms) => {
  if (!terms) return 30;
  if (terms.toUpperCase() === "IMMEDIATE") return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 30;
};

/** Add `days` days to a YYYY-MM-DD string and return YYYY-MM-DD. */
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

/** Generate next sequential invoice number for the given year: INV-YYYY-XXXX */
const generateInvoiceNo = async (transaction) => {
  const year = new Date().getFullYear();
  const last = await Invoice.findOne({
    where: { invoice_no: { [Op.like]: `INV-${year}-%` } },
    order: [["id", "DESC"]],
    transaction,
  });
  let seq = 1;
  if (last) {
    const parts = last.invoice_no.split("-");
    seq = parseInt(parts[2], 10) + 1;
  }
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
};

// ---------------------------------------------------------------------------
// GET /api/invoices
// ---------------------------------------------------------------------------
const listInvoices = async (req, res, next) => {
  try {
    const {
      client_id,
      status,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {};
    if (client_id) where.client_id = client_id;
    if (status) where.status = status;
    if (date_from || date_to) {
      where.invoice_date = {};
      if (date_from) where.invoice_date[Op.gte] = date_from;
      if (date_to) where.invoice_date[Op.lte] = date_to;
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        { model: Warehouse, attributes: ["id", "warehouse_name"] },
      ],
      order: [["id", "DESC"]],
      limit: parseInt(limit, 10),
      offset,
    });

    res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/invoices/:id
// ---------------------------------------------------------------------------
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          attributes: [
            "id",
            "client_name",
            "client_code",
            "billing_address",
            "tax_id",
          ],
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name"],
          as: "warehouse",
        },
        { model: BillableEvent, as: "lineItems" },
        { model: Payment, as: "payments" },
      ],
    });

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/invoices
// ---------------------------------------------------------------------------
const createInvoice = async (req, res, next) => {
  const t = await sequelize.transaction();
  let newInvoiceId = null;
  try {
    const {
      client_id,
      warehouse_id,
      period_start,
      period_end,
      event_ids,
      is_inter_state,
    } = req.body;

    if (
      !client_id ||
      !warehouse_id ||
      !period_start ||
      !period_end ||
      !Array.isArray(event_ids) ||
      event_ids.length === 0
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "client_id, warehouse_id, period_start, period_end, and event_ids are required",
      });
    }

    // 1. Validate all events are READY and belong to the specified client
    const events = await BillableEvent.findAll({
      where: { id: { [Op.in]: event_ids }, status: "READY" },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (events.length !== event_ids.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Expected ${event_ids.length} READY events but found ${events.length}. Some events may not exist or are not in READY status.`,
      });
    }

    const wrongClient = events.filter(
      (e) => e.client_id !== parseInt(client_id, 10),
    );
    if (wrongClient.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `${wrongClient.length} event(s) do not belong to client ${client_id}`,
      });
    }

    // 2. Auto-generate invoice_no: INV-YYYY-XXXX
    const invoice_no = await generateInvoiceNo(t);

    // 3. Calculate subtotal
    const subtotal = events.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0,
    );

    // 4. GST calculation
    let cgst_rate = 0,
      cgst_amount = 0;
    let sgst_rate = 0,
      sgst_amount = 0;
    let igst_rate = 0,
      igst_amount = 0;

    if (is_inter_state) {
      igst_rate = 18;
      igst_amount = parseFloat(((subtotal * 18) / 100).toFixed(2));
    } else {
      cgst_rate = 9;
      sgst_rate = 9;
      cgst_amount = parseFloat(((subtotal * 9) / 100).toFixed(2));
      sgst_amount = parseFloat(((subtotal * 9) / 100).toFixed(2));
    }

    const tax_amount = parseFloat(
      (cgst_amount + sgst_amount + igst_amount).toFixed(2),
    );

    // 5. total_amount
    const total_amount = parseFloat((subtotal + tax_amount).toFixed(2));

    // 7. due_date = invoice_date + payment_terms days
    const client = await Client.findByPk(client_id, { transaction: t });
    if (!client) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    const invoice_date = new Date().toISOString().split("T")[0];
    const paymentDays = parsePaymentTerms(client.payment_terms);
    const due_date = addDays(invoice_date, paymentDays);

    // 6 & create: paid_amount = 0, balance_due = total_amount
    const invoice = await Invoice.create(
      {
        invoice_no,
        warehouse_id,
        client_id,
        period_start,
        period_end,
        invoice_date,
        due_date,
        subtotal,
        cgst_rate,
        cgst_amount,
        sgst_rate,
        sgst_amount,
        igst_rate,
        igst_amount,
        tax_amount,
        total_amount,
        paid_amount: 0,
        balance_due: total_amount,
        client_gstin: client.tax_id ?? null,
        status: "DRAFT",
        created_by: req.user.id,
      },
      { transaction: t },
    );

    // 8. Update BillableEvents → INVOICED
    await BillableEvent.update(
      { status: "INVOICED", invoice_id: invoice.id, updated_by: req.user.id },
      { where: { id: { [Op.in]: event_ids } }, transaction: t },
    );

    await t.commit();
    newInvoiceId = invoice.id;
  } catch (error) {
    await t.rollback();
    return next(error);
  }

  // Post-commit: fetch result outside the transaction try/catch so a
  // failed include never triggers a rollback on an already-committed tx.
  try {
    const result = await Invoice.findByPk(newInvoiceId, {
      include: [
        {
          model: Client,
          attributes: [
            "id",
            "client_name",
            "client_code",
            "billing_address",
            "tax_id",
          ],
        },
        { model: Warehouse, attributes: ["id", "warehouse_name"] },
        { model: BillableEvent, as: "lineItems" },
      ],
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/invoices/:id  — update notes / due_date (DRAFT only)
// ---------------------------------------------------------------------------
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: `Invoice cannot be updated in ${invoice.status} status. Only DRAFT invoices can be edited.`,
      });
    }

    const { notes, due_date } = req.body;
    const updateFields = { updated_by: req.user.id };
    if (notes !== undefined) updateFields.notes = notes;
    if (due_date !== undefined) updateFields.due_date = due_date;

    await invoice.update(updateFields);

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/invoices/:id/send  — DRAFT → SENT
// ---------------------------------------------------------------------------
const sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: `Invoice is already in ${invoice.status} status and cannot be sent.`,
      });
    }

    await invoice.update({
      status: "SENT",
      sent_at: new Date(),
      updated_by: req.user.id,
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/invoices/:id/void  — Void invoice, release events back to READY
// ---------------------------------------------------------------------------
const voidInvoice = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!invoice) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status === "VOID") {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invoice is already voided" });
    }

    if (invoice.status === "PAID") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "A fully paid invoice cannot be voided",
      });
    }

    // Release all linked BillableEvents back to READY
    await BillableEvent.update(
      { status: "READY", invoice_id: null, updated_by: req.user.id },
      { where: { invoice_id: invoice.id }, transaction: t },
    );

    // Void the invoice
    await invoice.update(
      { status: "VOID", updated_by: req.user.id },
      { transaction: t },
    );

    await t.commit();

    res.json({ success: true, data: invoice });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  sendInvoice,
  voidInvoice,
};
