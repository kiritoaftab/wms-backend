import {
  Location,
  Warehouse,
  Inventory,
  Pallet,
  SKU,
} from "../models/index.js";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";

// Get all locations with filters
const getAllLocations = async (req, res, next) => {
  try {
    const { warehouse_id, location_type, zone, is_active, search } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (location_type) whereClause.location_type = location_type;
    if (zone) whereClause.zone = zone;
    if (is_active !== undefined) whereClause.is_active = is_active === "true";
    if (search) {
      whereClause[Op.or] = [
        { location_code: { [Op.like]: `%${search}%` } },
        { zone: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Location.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Warehouse,
          as: "warehouse",
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
      limit,
      offset,
      order: [
        ["zone", "ASC"],
        ["aisle", "ASC"],
        ["rack", "ASC"],
        ["level", "ASC"],
      ],
    });

    // Calculate capacity utilization for each location
    const locationsWithStats = rows.map((location) => {
      const utilizationPercent =
        location.capacity > 0
          ? Math.round((location.current_usage / location.capacity) * 100)
          : 0;

      return {
        ...location.toJSON(),
        utilization_percent: utilizationPercent,
        available_capacity: location.capacity - location.current_usage,
      };
    });

    res.json({
      success: true,
      data: {
        locations: locationsWithStats,
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

// Get location by ID with inventory details
const getLocationById = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id, {
      include: [
        {
          model: Warehouse,
          as: "warehouse",
        },
        {
          model: Pallet,
          as: "pallets",
          where: { status: { [Op.ne]: "EMPTY" } },
          required: false,
        },
      ],
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    // Get inventory in this location
    const inventory = await Inventory.findAll({
      where: { location_id: location.id },
      include: [
        {
          model: SKU,
          as: "sku",
          attributes: ["id", "sku_code", "sku_name", "uom"],
        },
      ],
    });

    const utilizationPercent =
      location.capacity > 0
        ? Math.round((location.current_usage / location.capacity) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        location: {
          ...location.toJSON(),
          utilization_percent: utilizationPercent,
          available_capacity: location.capacity - location.current_usage,
        },
        inventory,
        pallet_count: location.pallets.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create location
const createLocation = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      location_code,
      zone,
      aisle,
      rack,
      level,
      location_type,
      capacity,
      is_pickable,
      is_putawayable,
    } = req.body;

    // Verify warehouse exists
    const warehouse = await Warehouse.findByPk(warehouse_id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    // Check if location code already exists
    const existingLocation = await Location.findOne({
      where: {
        warehouse_id,
        location_code,
      },
    });

    if (existingLocation) {
      return res.status(409).json({
        success: false,
        message: `Location code ${location_code} already exists in this warehouse`,
      });
    }

    const location = await Location.create({
      warehouse_id,
      location_code,
      zone,
      aisle,
      rack,
      level,
      location_type,
      capacity: capacity || 1000,
      current_usage: 0,
      is_active: true,
      is_pickable: is_pickable !== undefined ? is_pickable : true,
      is_putawayable: is_putawayable !== undefined ? is_putawayable : true,
    });

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

// Update location
const updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    const {
      location_code,
      zone,
      aisle,
      rack,
      level,
      location_type,
      capacity,
      is_active,
      is_pickable,
      is_putawayable,
    } = req.body;

    // If updating capacity, validate it's not less than current usage
    if (capacity !== undefined && capacity < location.current_usage) {
      return res.status(400).json({
        success: false,
        message: `Cannot set capacity (${capacity}) less than current usage (${location.current_usage})`,
      });
    }

    await location.update({
      location_code: location_code || location.location_code,
      zone: zone !== undefined ? zone : location.zone,
      aisle: aisle !== undefined ? aisle : location.aisle,
      rack: rack !== undefined ? rack : location.rack,
      level: level !== undefined ? level : location.level,
      location_type: location_type || location.location_type,
      capacity: capacity !== undefined ? capacity : location.capacity,
      is_active: is_active !== undefined ? is_active : location.is_active,
      is_pickable:
        is_pickable !== undefined ? is_pickable : location.is_pickable,
      is_putawayable:
        is_putawayable !== undefined ? is_putawayable : location.is_putawayable,
    });

    res.json({
      success: true,
      message: "Location updated successfully",
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

// Delete location (soft delete)
const deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    // Check if location has inventory
    if (location.current_usage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete location with inventory. Current usage: ${location.current_usage} units`,
      });
    }

    // Check if location has pallets
    const palletCount = await Pallet.count({
      where: {
        current_location_id: location.id,
        status: { [Op.ne]: "EMPTY" },
      },
    });

    if (palletCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete location with ${palletCount} active pallets`,
      });
    }

    await location.update({ is_active: false });

    res.json({
      success: true,
      message: "Location deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get location capacity stats by warehouse
const getLocationStats = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;

    if (!warehouse_id) {
      return res.status(400).json({
        success: false,
        message: "warehouse_id is required",
      });
    }

    const locations = await Location.findAll({
      where: {
        warehouse_id,
        is_active: true,
      },
      attributes: [
        "location_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("capacity")), "total_capacity"],
        [sequelize.fn("SUM", sequelize.col("current_usage")), "total_usage"],
      ],
      group: ["location_type"],
    });

    const stats = locations.map((loc) => {
      const totalCapacity = parseInt(loc.get("total_capacity")) || 0;
      const totalUsage = parseInt(loc.get("total_usage")) || 0;
      const utilizationPercent =
        totalCapacity > 0 ? Math.round((totalUsage / totalCapacity) * 100) : 0;

      return {
        location_type: loc.location_type,
        count: parseInt(loc.get("count")),
        total_capacity: totalCapacity,
        total_usage: totalUsage,
        available_capacity: totalCapacity - totalUsage,
        utilization_percent: utilizationPercent,
      };
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Get locations by zone (grouped view)
const getLocationsByZone = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;

    if (!warehouse_id) {
      return res.status(400).json({
        success: false,
        message: "warehouse_id is required",
      });
    }

    const locations = await Location.findAll({
      where: {
        warehouse_id,
        is_active: true,
        location_type: "STORAGE",
      },
      order: [
        ["zone", "ASC"],
        ["aisle", "ASC"],
        ["rack", "ASC"],
        ["level", "ASC"],
      ],
    });

    // Group by zone
    const groupedByZone = locations.reduce((acc, location) => {
      const zone = location.zone || "UNASSIGNED";
      if (!acc[zone]) {
        acc[zone] = {
          zone,
          locations: [],
          total_capacity: 0,
          total_usage: 0,
          location_count: 0,
        };
      }

      acc[zone].locations.push({
        ...location.toJSON(),
        utilization_percent:
          location.capacity > 0
            ? Math.round((location.current_usage / location.capacity) * 100)
            : 0,
        available_capacity: location.capacity - location.current_usage,
      });
      acc[zone].total_capacity += location.capacity;
      acc[zone].total_usage += location.current_usage;
      acc[zone].location_count += 1;

      return acc;
    }, {});

    // Calculate zone-level utilization
    const zones = Object.values(groupedByZone).map((zone) => ({
      ...zone,
      available_capacity: zone.total_capacity - zone.total_usage,
      utilization_percent:
        zone.total_capacity > 0
          ? Math.round((zone.total_usage / zone.total_capacity) * 100)
          : 0,
    }));

    res.json({
      success: true,
      data: zones,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk create locations (for initial setup)
const bulkCreateLocations = async (req, res, next) => {
  try {
    const { warehouse_id, locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "locations array is required",
      });
    }

    // Verify warehouse exists
    const warehouse = await Warehouse.findByPk(warehouse_id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    // Add warehouse_id to each location
    const locationsToCreate = locations.map((loc) => ({
      warehouse_id,
      location_code: loc.location_code,
      zone: loc.zone,
      aisle: loc.aisle,
      rack: loc.rack,
      level: loc.level,
      location_type: loc.location_type || "STORAGE",
      capacity: loc.capacity || 1000,
      current_usage: 0,
      is_active: true,
      is_pickable: loc.is_pickable !== undefined ? loc.is_pickable : true,
      is_putawayable:
        loc.is_putawayable !== undefined ? loc.is_putawayable : true,
    }));

    const createdLocations = await Location.bulkCreate(locationsToCreate, {
      validate: true,
      ignoreDuplicates: false,
    });

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdLocations.length} locations`,
      data: createdLocations,
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationStats,
  getLocationsByZone,
  bulkCreateLocations,
};
