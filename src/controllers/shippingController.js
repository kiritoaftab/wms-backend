import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import {
  Shipment,
  SalesOrder,
  SalesOrderLine,
  Carton,
  CartonItem,
  Carrier,
  Warehouse,
} from "../models/index.js";

/**
 * Generate sequential Shipment number
 * Format: SHP-00001
 */
async function generateShipmentNo(transaction) {
  const lastShipment = await Shipment.findOne({
    order: [["id", "DESC"]],
    attributes: ["shipment_no"],
    transaction,
  });

  if (!lastShipment) {
    return "SHP-00001";
  }

  const lastNumber = parseInt(lastShipment.shipment_no.split("-")[1]);
  return `SHP-${String(lastNumber + 1).padStart(5, "0")}`;
}

// POST /api/shipping/:orderId/create
// Create Shipment, assign carrier, AWB
const createShipment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const order = await SalesOrder.findByPk(req.params.orderId, {
      include: [{ model: Carton, as: "cartons" }],
      transaction,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    if (order.status !== "PACKED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Order must be in PACKED status to create shipment. Current status: ${order.status}`,
      });
    }

    // Check if shipment already exists for this order
    const existing = await Shipment.findOne({
      where: { sales_order_id: order.id, status: { [Op.ne]: "CANCELLED" } },
      transaction,
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Shipment ${existing.shipment_no} already exists for this order`,
      });
    }

    const {
      carrier_id,
      awb_no,
      shipping_method,
      estimated_delivery_date,
      shipping_cost,
      notes,
    } = req.body;

    // Validate carrier if provided
    if (carrier_id) {
      const carrier = await Carrier.findByPk(carrier_id, { transaction });
      if (!carrier || !carrier.is_active) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Carrier not found or inactive",
        });
      }
    }

    // Calculate totals from closed cartons
    const closedCartons = order.cartons.filter((c) => c.status === "CLOSED");
    const totalCartons = closedCartons.length;
    const totalWeight = closedCartons.reduce(
      (sum, c) => sum + (Number(c.gross_weight) || 0),
      0,
    );

    const shipment_no = await generateShipmentNo(transaction);

    const shipment = await Shipment.create(
      {
        shipment_no,
        sales_order_id: order.id,
        warehouse_id: order.warehouse_id,
        carrier_id: carrier_id || null,
        awb_no: awb_no || null,
        total_cartons: totalCartons,
        total_weight: totalWeight || null,
        ship_to_name: order.ship_to_name,
        ship_to_address: [order.ship_to_address_line1, order.ship_to_address_line2]
          .filter(Boolean)
          .join(", "),
        ship_to_city: order.ship_to_city,
        ship_to_state: order.ship_to_state,
        ship_to_pincode: order.ship_to_pincode,
        ship_to_phone: order.ship_to_phone,
        shipping_method: shipping_method || "STANDARD",
        estimated_delivery_date: estimated_delivery_date || null,
        shipping_cost: shipping_cost || null,
        notes: notes || null,
        created_by: req.user?.id || null,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Shipment created",
      data: shipment,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// POST /api/shipping/:shipmentId/dispatch
// Mark shipment as dispatched, update order status → SHIPPED
const dispatchShipment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const shipment = await Shipment.findByPk(req.params.shipmentId, {
      transaction,
    });

    if (!shipment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Shipment not found" });
    }

    if (shipment.status !== "CREATED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Shipment must be in CREATED status to dispatch. Current status: ${shipment.status}`,
      });
    }

    const { awb_no } = req.body;

    await shipment.update(
      {
        status: "DISPATCHED",
        dispatched_at: new Date(),
        dispatched_by: req.user?.id || null,
        awb_no: awb_no || shipment.awb_no,
        updated_by: req.user?.id || null,
      },
      { transaction },
    );

    // Update order status → SHIPPED
    const order = await SalesOrder.findByPk(shipment.sales_order_id, {
      include: [{ model: SalesOrderLine, as: "lines" }],
      transaction,
    });

    if (order) {
      // Set shipped_qty = packed_qty on all non-cancelled lines
      for (const line of order.lines) {
        if (line.status !== "CANCELLED") {
          await line.update(
            { shipped_qty: line.packed_qty, status: "SHIPPED" },
            { transaction },
          );
        }
      }

      await order.update(
        {
          status: "SHIPPED",
          total_shipped_units: order.total_packed_units,
          shipped_at: new Date(),
          tracking_number: awb_no || shipment.awb_no || order.tracking_number,
          updated_by: req.user?.id || null,
        },
        { transaction },
      );

      // Mark cartons as SHIPPED
      await Carton.update(
        { status: "SHIPPED" },
        {
          where: { sales_order_id: order.id, status: "CLOSED" },
          transaction,
        },
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Shipment dispatched",
      data: shipment,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// GET /api/shipping?warehouse_id=1&status=CREATED
// List shipments with filters
const getShipments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.warehouse_id) where.warehouse_id = req.query.warehouse_id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.carrier_id) where.carrier_id = req.query.carrier_id;

    const { count, rows } = await Shipment.findAndCountAll({
      where,
      include: [
        { model: SalesOrder, attributes: ["id", "order_no", "customer_name", "status"] },
        { model: Warehouse, attributes: ["id", "warehouse_name"] },
        { model: Carrier, attributes: ["id", "carrier_name", "carrier_code"] },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        shipments: rows,
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

// GET /api/shipping/:shipmentId
// Shipment details with cartons and items
const getShipmentById = async (req, res, next) => {
  try {
    const shipment = await Shipment.findByPk(req.params.shipmentId, {
      include: [
        {
          model: SalesOrder,
          attributes: ["id", "order_no", "customer_name", "status", "order_type", "priority"],
          include: [
            {
              model: Carton,
              as: "cartons",
              include: [{ model: CartonItem, as: "items" }],
            },
          ],
        },
        { model: Warehouse, attributes: ["id", "warehouse_name"] },
        { model: Carrier },
      ],
    });

    if (!shipment) {
      return res.status(404).json({ success: false, message: "Shipment not found" });
    }

    res.json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    next(error);
  }
};

export {
  createShipment,
  dispatchShipment,
  getShipments,
  getShipmentById,
};
