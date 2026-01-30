import { Client, SKU } from "../models/index.js";

// Get all clients
const getAllClients = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Client.findAndCountAll({
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        clients: rows,
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

// Get client by ID
const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: SKU,
          as: "skus",
          attributes: ["id", "sku_code", "sku_name", "uom", "is_active"],
        },
      ],
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    res.json({
      success: true,
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// Create client
const createClient = async (req, res, next) => {
  try {
    const {
      client_name,
      client_code,
      contact_person,
      email,
      phone,
      billing_address,
      billing_type,
      payment_terms,
      tax_id,
    } = req.body;

    const client = await Client.create({
      client_name,
      client_code,
      contact_person,
      email,
      phone,
      billing_address,
      billing_type,
      payment_terms,
      tax_id,
    });

    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// Update client
const updateClient = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const {
      client_name,
      client_code,
      contact_person,
      email,
      phone,
      billing_address,
      billing_type,
      payment_terms,
      tax_id,
      is_active,
    } = req.body;

    await client.update({
      client_name,
      client_code,
      contact_person,
      email,
      phone,
      billing_address,
      billing_type,
      payment_terms,
      tax_id,
      is_active,
    });

    res.json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// Delete client (soft delete)
const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    await client.update({ is_active: false });

    res.json({
      success: true,
      message: "Client deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
