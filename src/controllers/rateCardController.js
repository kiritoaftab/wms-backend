import { RateCard, Client, Warehouse, User } from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";

// Get all rate cards with filters and pagination
const getAllRateCards = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { client_id, charge_type, is_active } = req.query;

    const whereClause = {};
    if (client_id) whereClause.client_id = client_id;
    if (charge_type) whereClause.charge_type = charge_type;
    if (is_active !== undefined) whereClause.is_active = is_active === "true";

    const { count, rows } = await RateCard.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          attributes: ["id", "client_name", "client_code"],
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        rate_cards: rows,
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

// Get rate card by ID
const getRateCardById = async (req, res, next) => {
  try {
    const rateCard = await RateCard.findByPk(req.params.id, {
      include: [
        { model: Client },
        { model: Warehouse },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!rateCard) {
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    res.json({
      success: true,
      data: rateCard,
    });
  } catch (error) {
    next(error);
  }
};

// Create rate card — auto-deactivates any existing active card for the same
// client + charge_type + warehouse_id before creating the new one.
const createRateCard = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const {
      rate_card_name,
      client_id,
      warehouse_id,
      charge_type,
      billing_basis,
      rate,
      currency,
      min_charge,
      effective_from,
      effective_to,
      description,
    } = req.body;

    const today = new Date().toISOString().split("T")[0];

    // Find any currently active card for the same client + charge_type + warehouse
    const existing = await RateCard.findOne({
      where: {
        client_id,
        charge_type,
        warehouse_id: warehouse_id ?? null,
        is_active: true,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existing) {
      await existing.update(
        {
          is_active: false,
          effective_to: today,
          updated_by: req.user.id,
        },
        { transaction: t },
      );
    }

    const rateCard = await RateCard.create(
      {
        rate_card_name,
        client_id,
        warehouse_id,
        charge_type,
        billing_basis,
        rate,
        currency,
        min_charge,
        effective_from,
        effective_to,
        description,
        is_active: true,
        created_by: req.user.id,
      },
      { transaction: t },
    );

    await t.commit();

    const createdRateCard = await RateCard.findByPk(rateCard.id, {
      include: [
        {
          model: Client,
          attributes: ["id", "client_name", "client_code"],
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: existing
        ? `Rate card created. Previous card (ID ${existing.id}) was automatically deactivated.`
        : "Rate card created successfully",
      data: createdRateCard,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Update rate card — auto-deactivates any conflicting active card when
// charge_type/warehouse_id changes or an inactive card is re-activated.
const updateRateCard = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const rateCard = await RateCard.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!rateCard) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    const {
      rate_card_name,
      warehouse_id,
      charge_type,
      billing_basis,
      rate,
      currency,
      min_charge,
      effective_from,
      effective_to,
      description,
      is_active,
    } = req.body;

    // Resolve effective values after the update (fall back to current if not sent)
    const effectiveChargeType =
      charge_type !== undefined ? charge_type : rateCard.charge_type;
    const effectiveWarehouseId =
      warehouse_id !== undefined ? warehouse_id : rateCard.warehouse_id;
    const effectiveIsActive =
      is_active !== undefined ? is_active : rateCard.is_active;

    let superseded = null;

    // Only check for conflicts when the card will be active after the update
    if (effectiveIsActive) {
      const today = new Date().toISOString().split("T")[0];

      const conflicting = await RateCard.findOne({
        where: {
          id: { [Op.ne]: rateCard.id },
          client_id: rateCard.client_id,
          charge_type: effectiveChargeType,
          warehouse_id: effectiveWarehouseId ?? null,
          is_active: true,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (conflicting) {
        await conflicting.update(
          {
            is_active: false,
            effective_to: today,
            updated_by: req.user.id,
          },
          { transaction: t },
        );
        superseded = conflicting.id;
      }
    }

    await rateCard.update(
      {
        rate_card_name,
        warehouse_id,
        charge_type,
        billing_basis,
        rate,
        currency,
        min_charge,
        effective_from,
        effective_to,
        description,
        is_active,
        updated_by: req.user.id,
      },
      { transaction: t },
    );

    await t.commit();

    res.json({
      success: true,
      message: superseded
        ? `Rate card updated. Conflicting card (ID ${superseded}) was automatically deactivated.`
        : "Rate card updated successfully",
      data: rateCard,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Soft delete — sets is_active=false and effective_to=today
const deleteRateCard = async (req, res, next) => {
  try {
    const rateCard = await RateCard.findByPk(req.params.id);

    if (!rateCard) {
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    if (!rateCard.is_active) {
      return res.status(400).json({
        success: false,
        message: "Rate card is already inactive",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    await rateCard.update({
      is_active: false,
      effective_to: today,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Rate card deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllRateCards,
  getRateCardById,
  createRateCard,
  updateRateCard,
  deleteRateCard,
};
