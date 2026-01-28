import jwt from "jsonwebtoken";
import { User, Role, UserRole } from "../models/index.js";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
};

// Register new user
const register = async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name, phone } =
      req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      pass_hash: password, // Will be hashed by beforeCreate hook
      first_name,
      last_name,
      phone,
    });

    const defaultRole = await Role.findOne({ where: { role_code: "USER" } });
    if (defaultRole) {
      await UserRole.create({
        user_id: user.id,
        role_id: defaultRole.id,
      });
    }

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user with roles
    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
        },
      ],
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export { register, login, getProfile };
