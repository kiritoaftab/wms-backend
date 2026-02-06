import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import PickTask from "../models/PickTask.js";
import PickWave from "../models/PIckWave.js";
import SalesOrder from "../models/SaleOrder.js";
import SalesOrderLine from "../models/SalesOrderLine.js";
import StockAllocation from "../models/StockAllocation.js";
import Inventory from "../models/Inventory.js";
import InventoryTransaction from "../models/InventoryTransaction.js";
import SKU from "../models/SKU.js";
import Location from "../models/Location.js";
import User from "../models/User.js";
import { generatePickTaskNo, generateAllocationNo } from "../utils/sequenceGenerator.js";

/**
 * Get all pick tasks with filters
 * GET /api/pick-tasks?wave_id=1&status=PENDING&assigned_to=5
 */
export async function getAllTasks(req, res) {
  try {
    const {
      wave_id,
      status,
      assigned_to,
      order_id,
      warehouse_id,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};
    if (wave_id) where.wave_id = wave_id;
    if (status) where.status = status;
    if (assigned_to) where.assigned_to = assigned_to;
    if (order_id) where.order_id = order_id;

    // Filter by warehouse through wave
    const waveWhere = {};
    if (warehouse_id) waveWhere.warehouse_id = warehouse_id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PickTask.findAndCountAll({
      where,
      include: [
        {
          model: PickWave,
          where: Object.keys(waveWhere).length > 0 ? waveWhere : undefined,
        },
        {
          model: SalesOrder,
          attributes: ["order_no", "customer_name", "priority"],
        },
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        {
          model: Location,
          as: "sourceLocation",
        },
        {
          model: Location,
          as: "stagingLocation",
          required: false,
        },
        {
          model: User,
          as: "picker",
          attributes: ["id", "username", "first_name", "last_name"],
          required: false,
        },
      ],
      order: [["pick_sequence", "ASC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
      tasks: rows,
    });
  } catch (error) {
    console.error("Error fetching pick tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get my assigned tasks (for picker)
 * GET /api/pick-tasks/my-tasks
 */
export async function getMyTasks(req, res) {
  try {
    const pickerId = req.user?.id;

    const tasks = await PickTask.findAll({
      where: {
        assigned_to: pickerId,
        status: {
          [Op.in]: ["ASSIGNED", "IN_PROGRESS"],
        },
      },
      include: [
        PickWave,
        {
          model: SalesOrder,
          attributes: ["order_no", "customer_name", "priority"],
        },
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        {
          model: Location,
          as: "SourceLocation",
        },
        {
          model: Location,
          as: "StagingLocation",
          required: false,
        },
      ],
      order: [
        ["priority", "ASC"],
        ["pick_sequence", "ASC"],
      ],
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get task by ID
 * GET /api/pick-tasks/:id
 */
export async function getTaskById(req, res) {
  try {
    const { id } = req.params;

    const task = await PickTask.findByPk(id, {
      include: [
        PickWave,
        SalesOrder,
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        {
          model: Location,
          as: "sourceLocation",
        },
        {
          model: Location,
          as: "stagingLocation",
          required: false,
        },
        {
          model: User,
          as: "picker",
          attributes: ["id", "username", "first_name", "last_name"],
          required: false,
        },
        Inventory,
      ],
    });

    if (!task) {
      return res.status(404).json({ error: "Pick task not found" });
    }

    res.json(task);
  } catch (error) {
    console.error("Error fetching pick task:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Manager assigns tasks to picker
 * POST /api/pick-tasks/assign
 */
export async function assignTasks(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { task_ids, user_id } = req.body;

    if (!task_ids || task_ids.length === 0 || !user_id) {
      await transaction.rollback();
      return res.status(400).json({
        error: "task_ids and user_id are required",
      });
    }

    // Verify tasks exist and are PENDING
    const tasks = await PickTask.findAll({
      where: {
        id: task_ids,
        status: "PENDING",
      },
      transaction,
    });

    if (tasks.length !== task_ids.length) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Some tasks are not found or not in PENDING status",
      });
    }

    // Verify user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    // Assign tasks
    await PickTask.update(
      {
        assigned_to: user_id,
        status: "ASSIGNED",
        assigned_at: new Date(),
      },
      {
        where: { id: task_ids },
        transaction,
      }
    );

    await transaction.commit();

    res.json({
      message: `${task_ids.length} tasks assigned to ${user.username}`,
      assigned_count: task_ids.length,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error assigning tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Picker self-assigns next available task
 * POST /api/pick-tasks/self-assign
 */
export async function selfAssignTask(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { wave_id } = req.body;
    const pickerId = req.user?.id;

    const where = {
      status: "PENDING",
      assigned_to: null,
    };

    if (wave_id) {
      where.wave_id = wave_id;
    }

    // Find next available task with row lock
    const task = await PickTask.findOne({
      where,
      order: [["pick_sequence", "ASC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({ error: "No available tasks to assign" });
    }

    // Assign to current user
    await task.update(
      {
        assigned_to: pickerId,
        status: "ASSIGNED",
        assigned_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch complete task
    const completeTask = await PickTask.findByPk(task.id, {
      include: [
        PickWave,
        SalesOrder,
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        {
          model: Location,
          as: "SourceLocation",
        },
      ],
    });

    res.json({
      message: "Task assigned successfully",
      task: completeTask,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error self-assigning task:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Start picking a task
 * POST /api/pick-tasks/:id/start
 */
export async function startPicking(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const task = await PickTask.findByPk(id, {
      include: [PickWave],
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.status !== "ASSIGNED") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot start task with status: ${task.status}`,
      });
    }

    // Update task
    await task.update(
      {
        status: "IN_PROGRESS",
        pick_started_at: new Date(),
      },
      { transaction }
    );

    // Update wave status if first task
    if (task.PickWave.status === "RELEASED") {
      await task.PickWave.update(
        {
          status: "IN_PROGRESS",
          picking_started_at: new Date(),
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.json({ message: "Picking started" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error starting pick:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Complete picking with short pick handling
 * POST /api/pick-tasks/:id/complete
 */
export async function completePicking(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { qty_picked, short_pick_reason, short_pick_notes } = req.body;

    const task = await PickTask.findByPk(id, {
      include: [
        PickWave,
        SalesOrder,
        SalesOrderLine,
        Inventory,
      ],
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.status !== "IN_PROGRESS") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot complete task with status: ${task.status}`,
      });
    }

    if (qty_picked < 0 || qty_picked > task.qty_to_pick) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Invalid qty_picked value",
      });
    }

    const qtyShort = task.qty_to_pick - qty_picked;
    const isShortPick = qtyShort > 0;

    // 1. Update pick task
    await task.update(
      {
        qty_picked,
        qty_short: qtyShort,
        status: isShortPick ? "SHORT_PICK" : "COMPLETED",
        short_pick_reason: isShortPick ? short_pick_reason : null,
        short_pick_notes: isShortPick ? short_pick_notes : null,
        pick_completed_at: new Date(),
      },
      { transaction }
    );

    // 2. Update stock allocation
    const allocation = await StockAllocation.findOne({
      where: {
        order_line_id: task.order_line_id,
        inventory_id: task.inventory_id,
        status: "ACTIVE",
      },
      transaction,
    });

    if (allocation) {
      const newRemainingQty = allocation.remaining_qty - qty_picked;

      await allocation.update(
        {
          consumed_qty: parseFloat(allocation.consumed_qty) + qty_picked,
          remaining_qty: newRemainingQty,
          status: newRemainingQty <= 0 ? "CONSUMED" : "ACTIVE",
          consumed_at: new Date(),
        },
        { transaction }
      );
    }

    // 3. Update inventory
    await task.Inventory.update(
      {
        on_hand_qty: parseFloat(task.Inventory.on_hand_qty) - qty_picked,
        allocated_qty: parseFloat(task.Inventory.allocated_qty) - qty_picked,
      },
      { transaction }
    );

    // 4. Create inventory transaction
    await InventoryTransaction.create(
      {
        transaction_id: `TXN-${Date.now()}`,
        warehouse_id: task.PickWave.warehouse_id,
        sku_id: task.sku_id,
        transaction_type: "PICK",
        from_location_id: task.source_location_id,
        to_location_id: task.staging_location_id,
        qty: qty_picked,
        batch_no: task.batch_no,
        serial_no: task.serial_no,
        reference_type: "PICK_TASK",
        reference_id: task.id,
        performed_by: req.user?.id,
      },
      { transaction }
    );

    // 5. Update order line
    await task.SalesOrderLine.update(
      {
        picked_qty: parseFloat(task.SalesOrderLine.picked_qty) + qty_picked,
        short_qty: parseFloat(task.SalesOrderLine.short_qty) + qtyShort,
      },
      { transaction }
    );

    // 6. SHORT PICK HANDLING: Try reallocation
    let reallocationResult = null;
    if (
      isShortPick &&
      short_pick_reason !== "DAMAGED_INVENTORY" &&
      short_pick_reason !== "EXPIRED"
    ) {
      reallocationResult = await attemptReallocation(
        task,
        qtyShort,
        transaction,
        req.user?.id
      );
    }

    // 7. Update wave progress
    await updateWaveProgress(task.wave_id, transaction);

    // 8. Update order totals
    await updateOrderPickTotals(task.order_id, transaction);

    await transaction.commit();

    res.json({
      message: isShortPick
        ? "Short pick recorded"
        : "Pick completed successfully",
      short_pick: isShortPick,
      qty_short: qtyShort,
      reallocation: reallocationResult,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error completing pick:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Attempt to reallocate short picked quantity
 * Creates new allocation and pick task if inventory available
 */
async function attemptReallocation(task, shortQty, transaction, userId) {
  // Find alternative inventory
  const alternativeInventory = await Inventory.findAll({
    where: {
      warehouse_id: task.PickWave.warehouse_id,
      sku_id: task.sku_id,
      status: "HEALTHY",
      [Op.and]: [
        sequelize.literal(
          "(on_hand_qty - allocated_qty - hold_qty - damaged_qty) > 0"
        ),
      ],
      // Exclude current inventory
      id: { [Op.ne]: task.inventory_id },
      // Exclude already allocated inventory for this order line
      id: {
        [Op.notIn]: sequelize.literal(`
          (SELECT inventory_id FROM stock_allocations
           WHERE order_line_id = ${task.order_line_id} AND status = 'ACTIVE')
        `),
      },
    },
    order: [["created_at", "ASC"]], // FIFO
    limit: 1,
    transaction,
  });

  if (alternativeInventory.length === 0) {
    // No alternative inventory available
    return {
      reallocated: false,
      reason: "No alternative inventory available",
    };
  }

  const inventory = alternativeInventory[0];

  const availableQty =
    parseFloat(inventory.on_hand_qty) -
    parseFloat(inventory.allocated_qty) -
    parseFloat(inventory.hold_qty) -
    parseFloat(inventory.damaged_qty);

  const qtyToReallocate = Math.min(shortQty, availableQty);

  // Create new allocation
  const allocationNo = await generateAllocationNo();
  const allocation = await StockAllocation.create(
    {
      allocation_no: allocationNo,
      order_id: task.order_id,
      order_line_id: task.order_line_id,
      sku_id: task.sku_id,
      inventory_id: inventory.id,
      location_id: inventory.location_id,
      warehouse_id: inventory.warehouse_id,
      allocated_qty: qtyToReallocate,
      consumed_qty: 0,
      remaining_qty: qtyToReallocate,
      batch_no: inventory.batch_no,
      serial_no: inventory.serial_no,
      expiry_date: inventory.expiry_date,
      allocation_rule: task.SalesOrderLine.allocation_rule,
      status: "ACTIVE",
      allocated_at: new Date(),
    },
    { transaction }
  );

  // Update inventory
  await inventory.update(
    {
      allocated_qty: parseFloat(inventory.allocated_qty) + qtyToReallocate,
    },
    { transaction }
  );

  // Update order line allocation
  await task.SalesOrderLine.update(
    {
      allocated_qty:
        parseFloat(task.SalesOrderLine.allocated_qty) + qtyToReallocate,
    },
    { transaction }
  );

  // Create NEW pick task
  const taskNo = await generatePickTaskNo();
  const newTask = await PickTask.create(
    {
      task_no: taskNo,
      wave_id: task.wave_id,
      order_id: task.order_id,
      order_line_id: task.order_line_id,
      sku_id: task.sku_id,
      inventory_id: inventory.id,
      source_location_id: inventory.location_id,
      staging_location_id: task.staging_location_id,
      qty_to_pick: qtyToReallocate,
      qty_picked: 0,
      qty_short: 0,
      batch_no: inventory.batch_no,
      serial_no: inventory.serial_no,
      expiry_date: inventory.expiry_date,
      status: "PENDING",
      priority: 1, // High priority
      pick_sequence: 9999, // Add to end
      notes: `Re-allocated due to short pick from task ${task.task_no}`,
      created_by: userId,
    },
    { transaction }
  );

  // Update wave total tasks
  const wave = await PickWave.findByPk(task.wave_id, { transaction });
  await wave.update(
    {
      total_tasks: wave.total_tasks + 1,
    },
    { transaction }
  );

  return {
    reallocated: true,
    qty: qtyToReallocate,
    new_task_id: newTask.id,
    new_task_no: newTask.task_no,
    location: inventory.Location?.location_code,
  };
}

/**
 * Update wave progress counters
 */
async function updateWaveProgress(waveId, transaction) {
  const wave = await PickWave.findByPk(waveId, {
    include: [PickTask],
    transaction,
  });

  const completedTasks = wave.PickTasks.filter(
    (t) => t.status === "COMPLETED" || t.status === "SHORT_PICK"
  ).length;

  const pickedUnits = wave.PickTasks.reduce(
    (sum, t) => sum + parseFloat(t.qty_picked || 0),
    0
  );

  await wave.update(
    {
      completed_tasks: completedTasks,
      picked_units: pickedUnits,
    },
    { transaction }
  );

  // Check if wave is complete
  if (completedTasks === wave.total_tasks) {
    await wave.update(
      {
        status: "COMPLETED",
        picking_completed_at: new Date(),
      },
      { transaction }
    );

    // Update all orders in wave to PICKED
    const waveOrders = await PickWaveOrder.findAll({
      where: { wave_id: waveId },
      transaction,
    });

    await SalesOrder.update(
      {
        status: "PICKED",
        picking_completed_at: new Date(),
      },
      {
        where: { id: waveOrders.map((wo) => wo.order_id) },
        transaction,
      }
    );
  }
}

/**
 * Update order pick totals
 */
async function updateOrderPickTotals(orderId, transaction) {
  const lines = await SalesOrderLine.findAll({
    where: { order_id: orderId },
    transaction,
  });

  const totalPicked = lines.reduce(
    (sum, line) => sum + parseFloat(line.picked_qty || 0),
    0
  );

  await SalesOrder.update(
    { total_picked_units: totalPicked },
    { where: { id: orderId }, transaction }
  );
}

/**
 * Get tasks for a wave
 * GET /api/pick-tasks/wave/:waveId
 */
export async function getWaveTasks(req, res) {
  try {
    const { waveId } = req.params;

    const tasks = await PickTask.findAll({
      where: { wave_id: waveId },
      include: [
        {
          model: SalesOrder,
          attributes: ["order_no", "customer_name"],
        },
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        {
          model: Location,
          as: "SourceLocation",
        },
        {
          model: User,
          as: "AssignedUser",
          attributes: ["id", "username", "first_name", "last_name"],
          required: false,
        },
      ],
      order: [["pick_sequence", "ASC"]],
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching wave tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

// Import PickWaveOrder at the top
import PickWaveOrder from "../models/PickWaveOrder.js";
