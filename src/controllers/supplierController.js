import { Supplier } from "../models/index.js";

// Get all suppliers
const getAllSuppliers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Supplier.findAndCountAll({
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        suppliers: rows,
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

// Get supplier by ID
const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// Create supplier
const createSupplier = async (req, res, next) => {
  try {
    const {
      supplier_name,
      supplier_code,
      contact_person,
      email,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      tax_id,
      payment_terms,
    } = req.body;

    const supplier = await Supplier.create({
      supplier_name,
      supplier_code,
      contact_person,
      email,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      tax_id,
      payment_terms,
    });

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// Update supplier
const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const {
      supplier_name,
      supplier_code,
      contact_person,
      email,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      tax_id,
      payment_terms,
      is_active,
    } = req.body;

    await supplier.update({
      supplier_name,
      supplier_code,
      contact_person,
      email,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      tax_id,
      payment_terms,
      is_active,
    });

    res.json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// Delete supplier (soft delete)
const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    await supplier.update({ is_active: false });

    res.json({
      success: true,
      message: "Supplier deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
