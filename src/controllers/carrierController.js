import { Carrier } from "../models/index.js";

// Get all carriers
const getAllCarriers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Carrier.findAndCountAll({
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        carriers: rows,
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

// Get carrier by ID
const getCarrierById = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);

    if (!carrier) {
      return res.status(404).json({
        success: false,
        message: "Carrier not found",
      });
    }

    res.json({
      success: true,
      data: carrier,
    });
  } catch (error) {
    next(error);
  }
};

// Create carrier
const createCarrier = async (req, res, next) => {
  try {
    const {
      carrier_name,
      carrier_code,
      carrier_type,
      contact_person,
      email,
      phone,
      website,
      tracking_url_template,
      account_no,
    } = req.body;

    const carrier = await Carrier.create({
      carrier_name,
      carrier_code,
      carrier_type,
      contact_person,
      email,
      phone,
      website,
      tracking_url_template,
      account_no,
    });

    res.status(201).json({
      success: true,
      message: "Carrier created successfully",
      data: carrier,
    });
  } catch (error) {
    next(error);
  }
};

// Update carrier
const updateCarrier = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);

    if (!carrier) {
      return res.status(404).json({
        success: false,
        message: "Carrier not found",
      });
    }

    const {
      carrier_name,
      carrier_code,
      carrier_type,
      contact_person,
      email,
      phone,
      website,
      tracking_url_template,
      account_no,
      is_active,
    } = req.body;

    await carrier.update({
      carrier_name,
      carrier_code,
      carrier_type,
      contact_person,
      email,
      phone,
      website,
      tracking_url_template,
      account_no,
      is_active,
    });

    res.json({
      success: true,
      message: "Carrier updated successfully",
      data: carrier,
    });
  } catch (error) {
    next(error);
  }
};

// Delete carrier (soft delete)
const deleteCarrier = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);

    if (!carrier) {
      return res.status(404).json({
        success: false,
        message: "Carrier not found",
      });
    }

    await carrier.update({ is_active: false });

    res.json({
      success: true,
      message: "Carrier deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  deleteCarrier,
};
