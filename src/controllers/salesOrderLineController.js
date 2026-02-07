import { sequelize } from "../config/database.js";
import SalesOrderLine from "../models/SalesOrderLine.js";
import SalesOrder from "../models/SaleOrder.js";
import SKU from "../models/SKU.js";
import StockAllocation from "../models/StockAllocation.js";

// Get all lines for an order
// GET /api/sales-order-lines/order/:orderId
const getOrderLines = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const lines = await SalesOrderLine.findAll({
      where: { order_id: orderId },
      include: [
        { model: SKU, as: "sku" },
        {
          model: StockAllocation,
          as: "allocations",
          where: { status: ["ACTIVE", "CONSUMED"] },
          required: false,
        },
      ],
      order: [["line_no", "ASC"]],
    });

    res.json(lines);
  } catch (error) {
    next(error);
  }
};

// Get single order line
// GET /api/sales-order-lines/:id
const getOrderLineById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const line = await SalesOrderLine.findByPk(id, {
      include: [
        { model: SKU, as: "sku" },
        { model: SalesOrder, as: "order" },
        {
          model: StockAllocation,
          as: "allocations",
          where: { status: ["ACTIVE", "CONSUMED"] },
          required: false,
        },
      ],
    });

    if (!line) {
      return res.status(404).json({ error: "Order line not found" });
    }

    res.json(line);
  } catch (error) {
    next(error);
  }
};

// Add new line to existing order
// POST /api/sales-order-lines
const addOrderLine = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      order_id,
      sku_id,
      ordered_qty,
      uom,
      allocation_rule,
      batch_preference,
      expiry_date_min,
      unit_price,
      discount_percent,
      discount_amount,
      tax_percent,
      tax_amount,
      notes,
    } = req.body;

    const order = await SalesOrder.findByPk(order_id, { transaction });
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot add lines to order with status: ${order.status}`,
      });
    }

    const sku = await SKU.findByPk(sku_id, { transaction });
    if (!sku) {
      await transaction.rollback();
      return res.status(404).json({ error: "SKU not found" });
    }

    const lastLine = await SalesOrderLine.findOne({
      where: { order_id },
      order: [["line_no", "DESC"]],
      transaction,
    });

    const lineNo = lastLine ? lastLine.line_no + 1 : 1;

    const line = await SalesOrderLine.create(
      {
        order_id,
        line_no: lineNo,
        sku_id,
        ordered_qty,
        uom: uom || sku.uom || "EA",
        allocation_rule: allocation_rule || sku.pick_rule || "FIFO",
        batch_preference,
        expiry_date_min,
        unit_price,
        line_total: unit_price
          ? parseFloat(unit_price) * parseFloat(ordered_qty)
          : null,
        discount_percent: discount_percent || 0,
        discount_amount: discount_amount || 0,
        tax_percent: tax_percent || 0,
        tax_amount: tax_amount || 0,
        status: "PENDING",
        notes,
      },
      { transaction },
    );

    await order.update(
      {
        total_lines: order.total_lines + 1,
        total_ordered_units:
          parseFloat(order.total_ordered_units) + parseFloat(ordered_qty),
      },
      { transaction },
    );

    await transaction.commit();

    const completeLine = await SalesOrderLine.findByPk(line.id, {
      include: [{ model: SKU, as: "sku" }],
    });

    res.status(201).json({
      message: "Order line added successfully",
      line: completeLine,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Update order line
// PUT /api/sales-order-lines/:id
const updateOrderLine = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const line = await SalesOrderLine.findByPk(id, {
      include: [{ model: SalesOrder, as: "order" }],
      transaction,
    });

    if (!line) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order line not found" });
    }

    if (line.order.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot update line for order with status: ${line.order.status}`,
      });
    }

    if (updateData.ordered_qty && updateData.ordered_qty !== line.ordered_qty) {
      const qtyDiff =
        parseFloat(updateData.ordered_qty) - parseFloat(line.ordered_qty);

      await line.order.update(
        {
          total_ordered_units:
            parseFloat(line.order.total_ordered_units) + qtyDiff,
        },
        { transaction },
      );

      if (line.unit_price) {
        updateData.line_total =
          parseFloat(updateData.ordered_qty) * parseFloat(line.unit_price);
      }
    }

    await line.update(updateData, { transaction });

    await transaction.commit();

    const updatedLine = await SalesOrderLine.findByPk(id, {
      include: [{ model: SKU, as: "sku" }],
    });

    res.json({
      message: "Order line updated successfully",
      line: updatedLine,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Delete order line
// DELETE /api/sales-order-lines/:id
const deleteOrderLine = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const line = await SalesOrderLine.findByPk(id, {
      include: [{ model: SalesOrder, as: "order" }],
      transaction,
    });

    if (!line) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order line not found" });
    }

    if (line.order.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot delete line for order with status: ${line.order.status}`,
      });
    }

    await line.order.update(
      {
        total_lines: line.order.total_lines - 1,
        total_ordered_units:
          parseFloat(line.order.total_ordered_units) -
          parseFloat(line.ordered_qty),
      },
      { transaction },
    );

    await line.destroy({ transaction });

    await transaction.commit();

    res.json({ message: "Order line deleted successfully" });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

export {
  getOrderLines,
  getOrderLineById,
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
};
