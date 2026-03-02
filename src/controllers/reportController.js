import { sequelize } from "../config/database.js";

// Builds a WHERE clause from an array of condition strings.
// Returns "" when there are no conditions (no WHERE keyword emitted).
const buildWhere = (conds) =>
  conds.length === 0 ? "" : `WHERE ${conds.join(" AND ")}`;

// ─── 1. Inbound TAT ───────────────────────────────────────────────────────────
// GET /api/reports/inbound-tat
// Query params: warehouse_id, client_id, supplier_id, date_from, date_to
const getInboundTAT = async (req, res, next) => {
  try {
    const { warehouse_id, date_from, date_to, client_id, supplier_id } =
      req.query;

    const conds = ["a.status IN ('GRN_POSTED', 'CLOSED')"];
    const r = {};

    if (warehouse_id) {
      conds.push("a.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (client_id) {
      conds.push("a.client_id = :client_id");
      r.client_id = client_id;
    }
    if (supplier_id) {
      conds.push("a.supplier_id = :supplier_id");
      r.supplier_id = supplier_id;
    }
    if (date_from) {
      conds.push("a.created_at >= :date_from");
      r.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conds.push("a.created_at <= :date_to");
      r.date_to = `${date_to} 23:59:59`;
    }

    const where = buildWhere(conds);

    const [summary] = await sequelize.query(
      `SELECT
         COUNT(*) AS total_asns_received,
         ROUND(AVG(
           CASE WHEN a.receiving_started_at IS NOT NULL AND a.grn_posted_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, a.receiving_started_at, a.grn_posted_at) / 60.0
             ELSE NULL END
         ), 2) AS avg_inbound_tat_hours,
         ROUND(AVG(
           CASE WHEN a.grn_posted_at IS NOT NULL AND a.putaway_completed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, a.grn_posted_at, a.putaway_completed_at) / 60.0
             ELSE NULL END
         ), 2) AS avg_putaway_time_hours,
         ROUND(
           SUM(CASE WHEN a.receiving_started_at IS NOT NULL
               AND a.putaway_completed_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, a.receiving_started_at, a.putaway_completed_at) <= 8
               THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN a.receiving_started_at IS NOT NULL
               AND a.putaway_completed_at IS NOT NULL THEN 1 ELSE 0 END), 0),
         2) AS sla_compliance_pct
       FROM asns a
       ${where}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const rows = await sequelize.query(
      `SELECT
         a.asn_no,
         g.grn_no,
         s.supplier_name,
         a.receiving_started_at,
         a.grn_posted_at,
         a.putaway_completed_at,
         a.status,
         CASE WHEN a.receiving_started_at IS NOT NULL AND a.putaway_completed_at IS NOT NULL
           THEN ROUND(TIMESTAMPDIFF(MINUTE, a.receiving_started_at, a.putaway_completed_at) / 60.0, 2)
           ELSE NULL END AS total_tat_hours
       FROM asns a
       LEFT JOIN grns g       ON g.asn_id      = a.id
       LEFT JOIN suppliers s  ON a.supplier_id  = s.id
       ${where}
       ORDER BY a.created_at DESC`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    res.json({ success: true, data: { summary, rows } });
  } catch (error) {
    next(error);
  }
};

// ─── 2. Putaway Aging ─────────────────────────────────────────────────────────
// GET /api/reports/putaway-aging
// Query params: warehouse_id, zone, assigned_to, date_from, date_to
const getPutawayAging = async (req, res, next) => {
  try {
    const { warehouse_id, zone, assigned_to, date_from, date_to } = req.query;

    const conds = [];
    const r = {};

    if (warehouse_id) {
      conds.push("g.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (zone) {
      conds.push("dest.zone = :zone");
      r.zone = zone;
    }
    if (assigned_to) {
      conds.push("gl.assigned_to = :assigned_to");
      r.assigned_to = assigned_to;
    }
    if (date_from) {
      conds.push("gl.created_at >= :date_from");
      r.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conds.push("gl.created_at <= :date_to");
      r.date_to = `${date_to} 23:59:59`;
    }

    const baseWhere = buildWhere(conds);

    // Summary counts all grn_lines in the filtered set (any status)
    const [summary] = await sequelize.query(
      `SELECT
         COUNT(*) AS total_tasks_created,
         SUM(CASE WHEN gl.putaway_status != 'COMPLETED' THEN 1 ELSE 0 END) AS pending_tasks,
         SUM(CASE WHEN gl.putaway_status != 'COMPLETED'
           AND TIMESTAMPDIFF(HOUR, gl.created_at, NOW()) > 4
           THEN 1 ELSE 0 END) AS aging_over_4h,
         SUM(CASE WHEN gl.putaway_status != 'COMPLETED'
           AND TIMESTAMPDIFF(HOUR, gl.created_at, NOW()) > 24
           THEN 1 ELSE 0 END) AS aging_over_24h
       FROM grn_lines gl
       JOIN  grns g        ON gl.grn_id                  = g.id
       LEFT JOIN locations dest ON gl.destination_location_id = dest.id
       ${baseWhere}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    // Drill-down: only non-completed tasks, ordered by age desc
    const drilldownConds = [
      ...conds,
      "gl.putaway_status IN ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED')",
    ];
    const drilldownWhere = buildWhere(drilldownConds);

    const rows = await sequelize.query(
      `SELECT
         gl.pt_task_id,
         g.grn_no,
         sk.sku_code,
         sk.sku_name,
         gl.qty,
         src.location_code  AS source_location,
         dest.location_code AS suggested_bin,
         gl.assigned_to,
         CASE WHEN u.first_name IS NOT NULL
           THEN CONCAT(u.first_name, ' ', u.last_name)
           ELSE NULL END AS assigned_to_name,
         gl.created_at,
         ROUND(TIMESTAMPDIFF(MINUTE, gl.created_at, NOW()) / 60.0, 2) AS aging_hours,
         gl.putaway_status
       FROM grn_lines gl
       JOIN  grns g          ON gl.grn_id                  = g.id
       JOIN  skus sk          ON gl.sku_id                  = sk.id
       LEFT JOIN locations src  ON gl.source_location_id      = src.id
       LEFT JOIN locations dest ON gl.destination_location_id = dest.id
       LEFT JOIN users u        ON gl.assigned_to             = u.id
       ${drilldownWhere}
       ORDER BY aging_hours DESC LIMIT 50`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    res.json({ success: true, data: { summary, rows } });
  } catch (error) {
    next(error);
  }
};

// ─── 3. Space Utilization ─────────────────────────────────────────────────────
// GET /api/reports/space-utilization
// Query params: warehouse_id, zone, location_type
const getSpaceUtilization = async (req, res, next) => {
  try {
    const { warehouse_id, zone, location_type } = req.query;

    const conds = ["l.is_active = 1"];
    const r = {};

    if (warehouse_id) {
      conds.push("l.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (zone) {
      conds.push("l.zone = :zone");
      r.zone = zone;
    }
    if (location_type) {
      conds.push("l.location_type = :location_type");
      r.location_type = location_type;
    }

    const where = buildWhere(conds);

    const [summary] = await sequelize.query(
      `SELECT
         COUNT(*) AS total_bins,
         ROUND(AVG(
           CASE WHEN l.capacity > 0
             THEN l.current_usage / l.capacity * 100
             ELSE 0 END
         ), 2) AS avg_utilization_pct,
         SUM(CASE WHEN l.current_usage > l.capacity THEN 1 ELSE 0 END) AS overfilled_bins,
         SUM(CASE WHEN l.current_usage = 0 THEN 1 ELSE 0 END) AS empty_bins
       FROM locations l
       ${where}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const rows = await sequelize.query(
      `SELECT
         l.id AS location_id,
         l.zone,
         l.location_code,
         l.location_type,
         l.capacity,
         l.current_usage,
         CASE WHEN l.capacity > 0
           THEN ROUND(l.current_usage / l.capacity * 100, 2)
           ELSE 0 END AS utilization_pct,
         COUNT(DISTINCT inv.sku_id) AS skus_count,
         CASE
           WHEN l.current_usage > l.capacity                             THEN 'Overfilled'
           WHEN l.capacity > 0 AND l.current_usage = l.capacity          THEN 'Full'
           WHEN l.capacity > 0 AND l.current_usage / l.capacity * 100 >= 80 THEN 'High'
           WHEN l.current_usage = 0                                      THEN 'Empty'
           ELSE 'Active'
         END AS status
       FROM locations l
       LEFT JOIN inventory inv ON inv.location_id = l.id
       ${where}
       GROUP BY l.id, l.zone, l.location_code, l.location_type, l.capacity, l.current_usage
       ORDER BY utilization_pct DESC`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    res.json({ success: true, data: { summary, rows } });
  } catch (error) {
    next(error);
  }
};

// ─── 4. Pick Productivity ─────────────────────────────────────────────────────
// GET /api/reports/pick-productivity
// Query params: warehouse_id, assigned_to, date_from, date_to
const getPickProductivity = async (req, res, next) => {
  try {
    const { warehouse_id, assigned_to, date_from, date_to } = req.query;

    const conds = [];
    const r = {};

    if (warehouse_id) {
      conds.push("so.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (assigned_to) {
      conds.push("pt.assigned_to = :assigned_to");
      r.assigned_to = assigned_to;
    }
    if (date_from) {
      conds.push("pt.created_at >= :date_from");
      r.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conds.push("pt.created_at <= :date_to");
      r.date_to = `${date_to} 23:59:59`;
    }

    const where = buildWhere(conds);

    const [raw] = await sequelize.query(
      `SELECT
         COALESCE(SUM(pt.qty_picked), 0) AS total_units_picked,
         COUNT(CASE WHEN pt.status IN ('SHORT_PICK','FAILED') THEN 1 END) AS exception_tasks,
         COUNT(*) AS total_tasks,
         ROUND(AVG(
           CASE WHEN pt.pick_started_at IS NOT NULL AND pt.pick_completed_at IS NOT NULL
             THEN TIMESTAMPDIFF(SECOND, pt.pick_started_at, pt.pick_completed_at)
             ELSE NULL END
         ), 0) AS avg_pick_time_seconds,
         COALESCE(SUM(
           CASE WHEN pt.pick_started_at IS NOT NULL AND pt.pick_completed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, pt.pick_started_at, pt.pick_completed_at) / 60.0
             ELSE 0 END
         ), 0) AS total_hours_worked
       FROM pick_tasks pt
       JOIN sales_orders so ON pt.order_id = so.id
       ${where}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const totalUnits = parseFloat(raw.total_units_picked) || 0;
    const totalHours = parseFloat(raw.total_hours_worked) || 0;
    const totalTasks = parseInt(raw.total_tasks) || 0;
    const exceptionTasks = parseInt(raw.exception_tasks) || 0;

    const summary = {
      picks_per_hour:
        totalHours > 0 ? parseFloat((totalUnits / totalHours).toFixed(2)) : 0,
      avg_pick_time_seconds: parseFloat(raw.avg_pick_time_seconds) || 0,
      exception_rate_pct:
        totalTasks > 0
          ? parseFloat(((exceptionTasks / totalTasks) * 100).toFixed(2))
          : 0,
      total_units_picked: totalUnits,
    };

    const pickerRows = await sequelize.query(
      `SELECT
         pt.assigned_to,
         CASE WHEN u.first_name IS NOT NULL
           THEN CONCAT(u.first_name, ' ', u.last_name)
           ELSE 'Unassigned' END AS picker_name,
         COALESCE(SUM(pt.qty_picked), 0) AS total_units_picked,
         COUNT(CASE WHEN pt.status = 'COMPLETED'               THEN 1 END) AS completed_tasks,
         COUNT(CASE WHEN pt.status IN ('SHORT_PICK','FAILED')   THEN 1 END) AS exception_tasks,
         COUNT(*) AS total_tasks,
         ROUND(AVG(
           CASE WHEN pt.pick_started_at IS NOT NULL AND pt.pick_completed_at IS NOT NULL
             THEN TIMESTAMPDIFF(SECOND, pt.pick_started_at, pt.pick_completed_at)
             ELSE NULL END
         ), 0) AS avg_pick_time_seconds,
         COALESCE(SUM(
           CASE WHEN pt.pick_started_at IS NOT NULL AND pt.pick_completed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, pt.pick_started_at, pt.pick_completed_at) / 60.0
             ELSE 0 END
         ), 0) AS total_hours_worked
       FROM pick_tasks pt
       JOIN  sales_orders so ON pt.order_id    = so.id
       LEFT JOIN users u       ON pt.assigned_to = u.id
       ${where}
       GROUP BY pt.assigned_to, u.first_name, u.last_name
       ORDER BY total_units_picked DESC`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const pickers = pickerRows.map((p) => {
      const hrs = parseFloat(p.total_hours_worked) || 0;
      const units = parseFloat(p.total_units_picked) || 0;
      return {
        ...p,
        picks_per_hour: hrs > 0 ? parseFloat((units / hrs).toFixed(2)) : 0,
        exception_rate_pct:
          p.total_tasks > 0
            ? parseFloat(((p.exception_tasks / p.total_tasks) * 100).toFixed(2))
            : 0,
      };
    });

    res.json({ success: true, data: { summary, pickers } });
  } catch (error) {
    next(error);
  }
};

// ─── 5. Pack Productivity ─────────────────────────────────────────────────────
// GET /api/reports/pack-productivity
// Query params: warehouse_id, packed_by, date_from, date_to
const getPackProductivity = async (req, res, next) => {
  try {
    const { warehouse_id, packed_by, date_from, date_to } = req.query;

    const conds = [];
    const r = {};

    if (warehouse_id) {
      conds.push("c.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (packed_by) {
      conds.push("c.packed_by = :packed_by");
      r.packed_by = packed_by;
    }
    if (date_from) {
      conds.push("c.created_at >= :date_from");
      r.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conds.push("c.created_at <= :date_to");
      r.date_to = `${date_to} 23:59:59`;
    }

    const where = buildWhere(conds);

    const [raw] = await sequelize.query(
      `SELECT
         COUNT(CASE WHEN c.status IN ('CLOSED','SHIPPED') THEN 1 END) AS closed_cartons,
         COUNT(DISTINCT CASE WHEN c.status IN ('CLOSED','SHIPPED') THEN c.sales_order_id END) AS total_orders_packed,
         ROUND(AVG(
           CASE WHEN c.closed_at IS NOT NULL
             THEN TIMESTAMPDIFF(SECOND, c.created_at, c.closed_at)
             ELSE NULL END
         ), 0) AS avg_pack_time_seconds,
         COALESCE(SUM(
           CASE WHEN c.closed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, c.created_at, c.closed_at) / 60.0
             ELSE 0 END
         ), 0) AS total_hours_worked
       FROM cartons c
       ${where}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const closedCartons = parseInt(raw.closed_cartons) || 0;
    const totalHours = parseFloat(raw.total_hours_worked) || 0;

    const summary = {
      cartons_per_hour:
        totalHours > 0
          ? parseFloat((closedCartons / totalHours).toFixed(2))
          : 0,
      avg_pack_time_seconds: parseFloat(raw.avg_pack_time_seconds) || 0,
      total_orders_packed: parseInt(raw.total_orders_packed) || 0,
      label_reprints: 0, // no label-reprint tracking yet
    };

    const packerRows = await sequelize.query(
      `SELECT
         c.packed_by,
         CASE WHEN u.first_name IS NOT NULL
           THEN CONCAT(u.first_name, ' ', u.last_name)
           ELSE 'Unassigned' END AS packer_name,
         COUNT(CASE WHEN c.status IN ('CLOSED','SHIPPED') THEN 1 END) AS cartons_packed,
         COUNT(DISTINCT CASE WHEN c.status IN ('CLOSED','SHIPPED') THEN c.sales_order_id END) AS orders_packed,
         ROUND(AVG(
           CASE WHEN c.closed_at IS NOT NULL
             THEN TIMESTAMPDIFF(SECOND, c.created_at, c.closed_at)
             ELSE NULL END
         ), 0) AS avg_pack_time_seconds,
         COALESCE(SUM(
           CASE WHEN c.closed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, c.created_at, c.closed_at) / 60.0
             ELSE 0 END
         ), 0) AS total_hours_worked
       FROM cartons c
       LEFT JOIN users u ON c.packed_by = u.id
       ${where}
       GROUP BY c.packed_by, u.first_name, u.last_name
       ORDER BY cartons_packed DESC`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const packers = packerRows.map((p) => {
      const hrs = parseFloat(p.total_hours_worked) || 0;
      const cartons = parseInt(p.cartons_packed) || 0;
      return {
        ...p,
        cartons_per_hour: hrs > 0 ? parseFloat((cartons / hrs).toFixed(2)) : 0,
      };
    });

    res.json({ success: true, data: { summary, packers } });
  } catch (error) {
    next(error);
  }
};

// ─── 6. Outbound SLA ─────────────────────────────────────────────────────────
// GET /api/reports/outbound-sla
// Query params: warehouse_id, client_id, priority, date_from, date_to
const getOutboundSLA = async (req, res, next) => {
  try {
    const { warehouse_id, client_id, priority, date_from, date_to } = req.query;

    const conds = [
      "so.status NOT IN ('DRAFT','CANCELLED')",
    ];
    const r = {};

    if (warehouse_id) {
      conds.push("so.warehouse_id = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (client_id) {
      conds.push("so.client_id = :client_id");
      r.client_id = client_id;
    }
    if (priority) {
      conds.push("so.priority = :priority");
      r.priority = priority;
    }
    if (date_from) {
      conds.push("so.order_date >= :date_from");
      r.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conds.push("so.order_date <= :date_to");
      r.date_to = `${date_to} 23:59:59`;
    }

    const where = buildWhere(conds);

    // ── Summary ──────────────────────────────────────────────────────────────
    const [summary] = await sequelize.query(
      `SELECT
         COUNT(CASE WHEN so.status IN ('SHIPPED','DELIVERED') THEN 1 END) AS orders_shipped,
         ROUND(
           COUNT(CASE WHEN so.shipped_at IS NOT NULL
               AND so.sla_due_date IS NOT NULL
               AND so.shipped_at <= so.sla_due_date THEN 1 END) * 100.0 /
           NULLIF(COUNT(CASE WHEN so.shipped_at IS NOT NULL
               AND so.sla_due_date IS NOT NULL THEN 1 END), 0),
         2) AS shipped_within_sla_pct,
         ROUND(AVG(
           CASE WHEN so.order_date IS NOT NULL AND so.shipped_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, so.order_date, so.shipped_at) / 60.0
             ELSE NULL END
         ), 2) AS avg_cycle_time_hours,
         COUNT(CASE
           WHEN so.sla_due_date IS NOT NULL
             AND (
               (so.shipped_at IS NOT NULL AND so.shipped_at > so.sla_due_date)
               OR
               (so.shipped_at IS NULL AND so.sla_due_date < NOW())
             )
           THEN 1 END) AS sla_breaches
       FROM sales_orders so
       ${where}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    // ── Drill-down rows (20 records, most urgent / recent first) ─────────────
    const rows = await sequelize.query(
      `SELECT
         so.order_no,
         so.priority,
         so.sla_due_date,
         so.picking_completed_at  AS picked_time,
         so.packing_completed_at  AS packed_time,
         so.shipped_at            AS shipped_time,
         CASE
           WHEN so.sla_due_date IS NULL
             THEN 'No SLA'
           WHEN so.shipped_at IS NOT NULL AND so.shipped_at <= so.sla_due_date
             THEN 'On Time'
           WHEN so.shipped_at IS NOT NULL AND so.shipped_at > so.sla_due_date
             THEN 'Breached'
           WHEN so.shipped_at IS NULL AND so.sla_due_date < NOW()
             THEN 'Breached'
           WHEN so.shipped_at IS NULL
             AND TIMESTAMPDIFF(HOUR, NOW(), so.sla_due_date) <= 2
             THEN 'At Risk'
           ELSE 'Pending'
         END AS sla_status,
         CASE WHEN so.order_date IS NOT NULL AND so.shipped_at IS NOT NULL
           THEN ROUND(TIMESTAMPDIFF(MINUTE, so.order_date, so.shipped_at) / 60.0, 2)
           ELSE NULL END AS cycle_time_hours
       FROM sales_orders so
       ${where}
       ORDER BY
         CASE WHEN so.sla_due_date IS NULL THEN 2 ELSE 1 END,
         so.sla_due_date ASC
       LIMIT 20`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    res.json({
      success: true,
      data: {
        summary: {
          orders_shipped:        parseInt(summary.orders_shipped)        || 0,
          shipped_within_sla_pct: parseFloat(summary.shipped_within_sla_pct) || 0,
          avg_cycle_time_hours:  parseFloat(summary.avg_cycle_time_hours)  || 0,
          sla_breaches:          parseInt(summary.sla_breaches)          || 0,
        },
        rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── 7. Billing Revenue ───────────────────────────────────────────────────────
// GET /api/reports/billing-revenue
// Query params: warehouse_id, client_id, date_from, date_to
const getBillingRevenue = async (req, res, next) => {
  try {
    const { warehouse_id, client_id, date_from, date_to } = req.query;

    const evConds = [];
    const invConds = [];
    const r = {};

    if (warehouse_id) {
      evConds.push("be.warehouse_id = :warehouse_id");
      invConds.push("i.warehouse_id  = :warehouse_id");
      r.warehouse_id = warehouse_id;
    }
    if (client_id) {
      evConds.push("be.client_id = :client_id");
      invConds.push("i.client_id  = :client_id");
      r.client_id = client_id;
    }
    if (date_from) {
      evConds.push("be.event_date   >= :date_from");
      invConds.push("i.invoice_date >= :date_from");
      r.date_from = date_from;
    }
    if (date_to) {
      evConds.push("be.event_date   <= :date_to");
      invConds.push("i.invoice_date <= :date_to");
      r.date_to = date_to;
    }

    const evWhere = buildWhere(evConds);
    const invWhere = buildWhere(invConds);

    const [evRaw] = await sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN be.status IN ('PENDING','READY') THEN be.amount ELSE 0 END), 0) AS est_revenue,
         COUNT(CASE WHEN be.status != 'VOID' THEN 1 END) AS billable_events,
         COUNT(CASE WHEN be.status = 'BLOCKED'  THEN 1 END) AS blocked_events
       FROM billable_events be
       ${evWhere}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    const [invRaw] = await sequelize.query(
      `SELECT
         COUNT(CASE WHEN i.status NOT IN ('VOID','CANCELLED') THEN 1 END) AS invoices_raised,
         ROUND(AVG(
           CASE WHEN i.period_end IS NOT NULL
             THEN DATEDIFF(i.invoice_date, i.period_end)
             ELSE NULL END
         ), 1) AS avg_billing_cycle
       FROM invoices i
       ${invWhere}`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    // Customer revenue table — uses correlated subqueries to avoid
    // Cartesian product from joining billable_events AND invoices together.
    const evSubWhere = [
      "status != 'VOID'",
      ...(warehouse_id ? ["warehouse_id = :warehouse_id"] : []),
      ...(date_from ? ["event_date >= :date_from"] : []),
      ...(date_to ? ["event_date <= :date_to"] : []),
    ].join(" AND ");

    const invSubWhere = [
      "1=1",
      ...(warehouse_id ? ["warehouse_id = :warehouse_id"] : []),
      ...(date_from ? ["invoice_date >= :date_from"] : []),
      ...(date_to ? ["invoice_date <= :date_to"] : []),
    ].join(" AND ");

    const clientFilter = client_id ? "AND c.id = :client_id" : "";

    const customers = await sequelize.query(
      `SELECT
         c.id           AS client_id,
         c.client_name,
         c.client_code,
         COALESCE(ev.events_count,   0) AS events_count,
         COALESCE(ev.blocked_events, 0) AS blocked_events,
         COALESCE(inv.invoices_count, 0) AS invoices_count,
         COALESCE(inv.total_billed,  0) AS total_billed,
         COALESCE(inv.outstanding,   0) AS outstanding,
         COALESCE(inv.overdue,       0) AS overdue
       FROM clients c
       LEFT JOIN (
         SELECT
           client_id,
           COUNT(*) AS events_count,
           SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_events
         FROM billable_events
         WHERE ${evSubWhere}
         GROUP BY client_id
       ) ev  ON ev.client_id  = c.id
       LEFT JOIN (
         SELECT
           client_id,
           COUNT(CASE WHEN status NOT IN ('VOID','CANCELLED') THEN 1 END) AS invoices_count,
           SUM(CASE WHEN status NOT IN ('VOID','CANCELLED') THEN total_amount ELSE 0 END) AS total_billed,
           SUM(CASE WHEN status IN ('SENT','PARTIAL','OVERDUE') THEN balance_due ELSE 0 END) AS outstanding,
           SUM(CASE WHEN status = 'OVERDUE' THEN balance_due ELSE 0 END) AS overdue
         FROM invoices
         WHERE ${invSubWhere}
         GROUP BY client_id
       ) inv ON inv.client_id = c.id
       WHERE (ev.client_id IS NOT NULL OR inv.client_id IS NOT NULL)
         ${clientFilter}
       ORDER BY total_billed DESC`,
      { replacements: r, type: sequelize.QueryTypes.SELECT },
    );

    res.json({
      success: true,
      data: {
        summary: {
          est_revenue: parseFloat(evRaw.est_revenue) || 0,
          billable_events: parseInt(evRaw.billable_events) || 0,
          blocked_events: parseInt(evRaw.blocked_events) || 0,
          invoices_raised: parseInt(invRaw.invoices_raised) || 0,
          avg_billing_cycle: parseFloat(invRaw.avg_billing_cycle) || 0,
        },
        customers,
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getInboundTAT,
  getPutawayAging,
  getSpaceUtilization,
  getPickProductivity,
  getPackProductivity,
  getOutboundSLA,
  getBillingRevenue,
};
