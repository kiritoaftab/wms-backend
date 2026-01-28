import { Module } from "../models/index.js";

// Get all modules
const getAllModules = async (req, res, next) => {
  try {
    const modules = await Module.findAll({
      order: [["display_order", "ASC"]],
    });

    res.json({
      success: true,
      data: modules,
    });
  } catch (error) {
    next(error);
  }
};

// Get module by ID
const getModuleById = async (req, res, next) => {
  try {
    const module = await Module.findByPk(req.params.id);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    res.json({
      success: true,
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

// Create module
const createModule = async (req, res, next) => {
  try {
    const { name, code, description, display_order, icon } = req.body;

    const module = await Module.create({
      name,
      code,
      description,
      display_order,
      icon,
    });

    res.status(201).json({
      success: true,
      message: "Module created successfully",
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

// Update module
const updateModule = async (req, res, next) => {
  try {
    const module = await Module.findByPk(req.params.id);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    const { name, code, description, display_order, icon, is_active } =
      req.body;

    await module.update({
      name,
      code,
      description,
      display_order,
      icon,
      is_active,
    });

    res.json({
      success: true,
      message: "Module updated successfully",
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

// Delete module
const deleteModule = async (req, res, next) => {
  try {
    const module = await Module.findByPk(req.params.id);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    await module.update({ is_active: false });

    res.json({
      success: true,
      message: "Module deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
};
