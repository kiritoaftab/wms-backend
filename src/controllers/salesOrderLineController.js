import { sequelize } from "../config/database.js";
import SalesOrderLine from "../models/SalesOrderLine.js";
import SalesOrder from "../models/SaleOrder.js";
import SKU from "../models/SKU.js";
import StockAllocation from "../models/StockAllocation.js";

/**
 * Get all lines for an order
 * GET /api/sales-order-lines/order/:orderId
 */
export async function getOrderLines(req, res) {
  try {
    const { orderId } = req.params;

    const lines = await SalesOrderLine.findAll({
      where: { order_id: orderId },
      include: [
        SKU,
        {
          model: StockAllocation,
          where: { status: ["ACTIVE", "CONSUMED"] },
          required: false,
        },
      ],
      order: [["line_no", "ASC"]],
    });

    res.json(lines);
  } catch (error) {
    console.error("Error fetching order lines:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single order line
 * GET /api/sales-order-lines/:id
 */
export async function getOrderLineById(req, res) {
  try {
    const { id } = req.params;

    const line = await SalesOrderLine.findByPk(id, {
      include: [
        SKU,
        SalesOrder,
        {
          model: StockAllocation,
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
    console.error("Error fetching order line:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Add new line to existing order
 * POST /api/sales-order-lines
 */
export async function addOrderLine(req, res) {
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

    // Verify order exists and is in DRAFT status
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

    // Verify SKU exists
    const sku = await SKU.findByPk(sku_id);
    if (!sku) {
      await transaction.rollback();
      return res.status(404).json({ error: "SKU not found" });
    }

    // Get next line number
    const lastLine = await SalesOrderLine.findOne({
      where: { order_id },
      order: [["line_no", "DESC"]],
      transaction,
    });

    const lineNo = lastLine ? lastLine.line_no + 1 : 1;

    // Create order line
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
      { transaction }
    );

    // Update order totals
    await order.update(
      {
        total_lines: order.total_lines + 1,
        total_ordered_units:
          parseFloat(order.total_ordered_units) + parseFloat(ordered_qty),
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch complete line
    const completeLine = await SalesOrderLine.findByPk(line.id, {
      include: [SKU],
    });

    res.status(201).json({
      message: "Order line added successfully",
      line: completeLine,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding order line:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update order line
 * PUT /api/sales-order-lines/:id
 */
export async function updateOrderLine(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const line = await SalesOrderLine.findByPk(id, {
      include: [SalesOrder],
      transaction,
    });

    if (!line) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order line not found" });
    }

    // Can only update if order is DRAFT
    if (line.SalesOrder.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot update line for order with status: ${line.SalesOrder.status}`,
      });
    }

    // If quantity changed, update order totals
    if (updateData.ordered_qty && updateData.ordered_qty !== line.ordered_qty) {
      const qtyDiff =
        parseFloat(updateData.ordered_qty) - parseFloat(line.ordered_qty);

      await line.SalesOrder.update(
        {
          total_ordered_units:
            parseFloat(line.SalesOrder.total_ordered_units) + qtyDiff,
        },
        { transaction }
      );

      // Recalculate line_total if unit_price exists
      if (line.unit_price) {
        updateData.line_total =
          parseFloat(updateData.ordered_qty) * parseFloat(line.unit_price);
      }
    }

    await line.update(updateData, { transaction });

    await transaction.commit();

    // Fetch updated line
    const updatedLine = await SalesOrderLine.findByPk(id, {
      include: [SKU],
    });

    res.json({
      message: "Order line updated successfully",
      line: updatedLine,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating order line:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete order line
 * DELETE /api/sales-order-lines/:id
 */
export async function deleteOrderLine(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const line = await SalesOrderLine.findByPk(id, {
      include: [SalesOrder],
      transaction,
    });

    if (!line) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order line not found" });
    }

    // Can only delete if order is DRAFT
    if (line.SalesOrder.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot delete line for order with status: ${line.SalesOrder.status}`,
      });
    }

    // Update order totals
    await line.SalesOrder.update(
      {
        total_lines: line.SalesOrder.total_lines - 1,
        total_ordered_units:
          parseFloat(line.SalesOrder.total_ordered_units) -
          parseFloat(line.ordered_qty),
      },
      { transaction }
    );

    await line.destroy({ transaction });

    await transaction.commit();

    res.json({ message: "Order line deleted successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting order line:", error);
    res.status(500).json({ error: error.message });
  }
}
