import { Payment, Invoice, Client, Warehouse, User } from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Generate next sequential payment_no: PAY-00001 */
const generatePaymentNo = async (transaction) => {
  const last = await Payment.findOne({
    order: [["id", "DESC"]],
    transaction,
  });
  const next = last ? last.id + 1 : 1;
  return `PAY-${String(next).padStart(5, "0")}`;
};

/**
 * Recalculate invoice status after paid_amount changes.
 * Returns { newStatus, newPaidAt }
 */
const resolveInvoiceStatus = (invoice, newPaidAmount) => {
  const newBalance = parseFloat(invoice.total_amount) - newPaidAmount;
  const today = new Date().toISOString().split("T")[0];

  if (newBalance <= 0) {
    return { newStatus: "PAID", newBalance: 0, newPaidAt: new Date() };
  }
  if (newPaidAmount > 0) {
    return { newStatus: "PARTIAL", newBalance, newPaidAt: null };
  }
  // No payments remaining — restore SENT or OVERDUE depending on due_date
  const isOverdue = invoice.due_date < today;
  return {
    newStatus: isOverdue ? "OVERDUE" : "SENT",
    newBalance,
    newPaidAt: null,
  };
};

// ---------------------------------------------------------------------------
// GET /api/payments
// ---------------------------------------------------------------------------
const listPayments = async (req, res, next) => {
  try {
    const { client_id, invoice_id, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {};
    if (client_id) where.client_id = client_id;
    if (invoice_id) where.invoice_id = invoice_id;
    if (status) where.status = status;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        {
          model: Invoice,
          attributes: ["id", "invoice_no", "total_amount", "status"],
        },
        {
          model: User,
          as: "recorder",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
      order: [["id", "DESC"]],
      limit: parseInt(limit, 10),
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
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
// GET /api/payments/aging  — Aging report by client
// ---------------------------------------------------------------------------
const getAgingReport = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;
    const today = new Date().toISOString().split("T")[0];

    const where = {
      status: { [Op.in]: ["SENT", "PARTIAL", "OVERDUE"] },
      balance_due: { [Op.gt]: 0 },
    };
    if (warehouse_id) where.warehouse_id = warehouse_id;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
      ],
      order: [["due_date", "ASC"]],
    });

    // Group by client_id
    const clientMap = {};
    for (const inv of invoices) {
      const cid = inv.client_id;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          client_id: cid,
          client: inv.client ?? null,
          total_outstanding: 0,
          overdue_amount: 0,
          max_days_overdue: 0,
          oldest_invoice: null,
        };
      }

      const balance = parseFloat(inv.balance_due);
      clientMap[cid].total_outstanding += balance;

      if (inv.due_date < today) {
        clientMap[cid].overdue_amount += balance;
        const daysOverdue = Math.floor(
          (new Date(today) - new Date(inv.due_date)) / (1000 * 60 * 60 * 24),
        );
        if (daysOverdue > clientMap[cid].max_days_overdue) {
          clientMap[cid].max_days_overdue = daysOverdue;
        }
      }

      // oldest_invoice = first one per client (query ordered by due_date ASC)
      if (!clientMap[cid].oldest_invoice) {
        clientMap[cid].oldest_invoice = {
          id: inv.id,
          invoice_no: inv.invoice_no,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          balance_due: balance,
          status: inv.status,
        };
      }
    }

    const result = Object.values(clientMap).map((c) => {
      let risk_level;
      if (c.total_outstanding <= 0) {
        risk_level = "GOOD";
      } else if (c.overdue_amount <= 0) {
        risk_level = "LOW";
      } else if (c.max_days_overdue <= 30) {
        risk_level = "MEDIUM";
      } else {
        risk_level = "HIGH";
      }

      return {
        client_id: c.client_id,
        client: c.client,
        total_outstanding: parseFloat(c.total_outstanding.toFixed(2)),
        overdue_amount: parseFloat(c.overdue_amount.toFixed(2)),
        max_days_overdue: c.max_days_overdue,
        oldest_invoice: c.oldest_invoice,
        risk_level,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/payments/:id
// ---------------------------------------------------------------------------
const getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        {
          model: Invoice,
          attributes: [
            "id",
            "invoice_no",
            "period_start",
            "period_end",
            "subtotal",
            "tax_amount",
            "total_amount",
            "paid_amount",
            "balance_due",
            "status",
          ],
        },
        { model: User, as: "recorder", attributes: ["id", "name"] },
        { model: User, as: "confirmer", attributes: ["id", "name"] },
      ],
    });

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/payments  — Record payment
// ---------------------------------------------------------------------------
const recordPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  let newPaymentId = null;
  try {
    const {
      invoice_id,
      amount,
      payment_date,
      payment_method,
      reference_no,
      bank_name,
      tds_amount = 0,
      notes,
    } = req.body;

    if (!invoice_id || !amount || !payment_date || !payment_method) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "invoice_id, amount, payment_date, and payment_method are required",
      });
    }

    // Fetch and lock the invoice
    const invoice = await Invoice.findByPk(invoice_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!invoice) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status === "VOID" || invoice.status === "CANCELLED") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot record payment on a ${invoice.status} invoice`,
      });
    }

    const effectiveAmount = parseFloat(amount) + parseFloat(tds_amount);
    const currentPaid = parseFloat(invoice.paid_amount);
    const invoiceTotal = parseFloat(invoice.total_amount);

    // 2. Validate: amount + tds + existing paid_amount <= invoice.total_amount
    if (currentPaid + effectiveAmount > invoiceTotal) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment would exceed invoice total. Outstanding balance: ${(invoiceTotal - currentPaid).toFixed(2)}`,
      });
    }

    // 1. Auto-generate payment_no
    const payment_no = await generatePaymentNo(t);

    // 3. Create Payment with status = RECORDED
    const payment = await Payment.create(
      {
        payment_no,
        invoice_id,
        client_id: invoice.client_id,
        amount: parseFloat(amount),
        payment_date,
        payment_method,
        reference_no: reference_no ?? null,
        bank_name: bank_name ?? null,
        tds_amount: parseFloat(tds_amount),
        notes: notes ?? null,
        status: "RECORDED",
        recorded_by: req.user.id,
        created_by: req.user.id,
      },
      { transaction: t },
    );

    // 4. Update invoice paid_amount
    const newPaidAmount = parseFloat(
      (currentPaid + effectiveAmount).toFixed(2),
    );

    // 5 & 6. Recalculate balance_due and status
    const { newStatus, newBalance, newPaidAt } = resolveInvoiceStatus(
      invoice,
      newPaidAmount,
    );

    await invoice.update(
      {
        paid_amount: newPaidAmount,
        balance_due: parseFloat(newBalance.toFixed(2)),
        status: newStatus,
        paid_at: newPaidAt,
        updated_by: req.user.id,
      },
      { transaction: t },
    );

    await t.commit();
    newPaymentId = payment.id;
  } catch (error) {
    await t.rollback();
    return next(error);
  }

  // Post-commit fetch
  try {
    const result = await Payment.findByPk(newPaymentId, {
      include: [
        { model: Client, attributes: ["id", "client_name", "client_code"] },
        {
          model: Invoice,
          attributes: [
            "id",
            "invoice_no",
            "total_amount",
            "paid_amount",
            "balance_due",
            "status",
          ],
        },
      ],
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/payments/:id/confirm  — RECORDED → CONFIRMED
// ---------------------------------------------------------------------------
const confirmPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "RECORDED") {
      return res.status(400).json({
        success: false,
        message: `Payment is in ${payment.status} status and cannot be confirmed`,
      });
    }

    await payment.update({
      status: "CONFIRMED",
      confirmed_by: req.user.id,
      confirmed_at: new Date(),
      updated_by: req.user.id,
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/payments/:id/reverse  — Reverse payment, adjust invoice
// ---------------------------------------------------------------------------
const reversePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "REVERSED") {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Payment is already reversed" });
    }

    const invoice = await Invoice.findByPk(payment.invoice_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!invoice) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Associated invoice not found" });
    }

    // Subtract this payment's contribution (amount + tds) from invoice
    const effectiveAmount =
      parseFloat(payment.amount) + parseFloat(payment.tds_amount || 0);
    const newPaidAmount = parseFloat(
      Math.max(0, parseFloat(invoice.paid_amount) - effectiveAmount).toFixed(2),
    );

    const { newStatus, newBalance, newPaidAt } = resolveInvoiceStatus(
      invoice,
      newPaidAmount,
    );

    await invoice.update(
      {
        paid_amount: newPaidAmount,
        balance_due: parseFloat(newBalance.toFixed(2)),
        status: newStatus,
        paid_at: newPaidAt,
        updated_by: req.user.id,
      },
      { transaction: t },
    );

    await payment.update(
      { status: "REVERSED", updated_by: req.user.id },
      { transaction: t },
    );

    await t.commit();

    res.json({ success: true, data: payment });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export {
  listPayments,
  getPayment,
  recordPayment,
  confirmPayment,
  reversePayment,
  getAgingReport,
};
