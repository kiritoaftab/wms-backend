import {
  User,
  Module,
  Permission,
  Role,
  RoleModule,
  UserRole,
} from "../models/index.js";

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...");

    // 1. Create Permissions
    console.log("Creating permissions...");
    const permissions = await Permission.bulkCreate([
      { name: "Create", code: "CREATE", description: "Create new records" },
      { name: "Read", code: "READ", description: "View records" },
      { name: "Update", code: "UPDATE", description: "Edit existing records" },
      { name: "Delete", code: "DELETE", description: "Delete records" },
      { name: "Export", code: "EXPORT", description: "Export data" },
    ]);
    console.log(`✅ Created ${permissions.length} permissions`);

    // 2. Create Modules
    console.log("Creating modules...");
    const modules = await Module.bulkCreate([
      {
        name: "Dashboard",
        code: "DASHBOARD",
        description: "Main dashboard and analytics",
        display_order: 1,
        icon: "dashboard",
      },
      {
        name: "User Management",
        code: "USER_MANAGEMENT",
        description: "Manage users, roles and permissions",
        display_order: 2,
        icon: "people",
      },
      {
        name: "Inventory",
        code: "INVENTORY",
        description: "Manage warehouse inventory",
        display_order: 3,
        icon: "inventory",
      },
      {
        name: "Orders",
        code: "ORDERS",
        description: "Manage customer orders",
        display_order: 4,
        icon: "shopping_cart",
      },
      {
        name: "Warehouse",
        code: "WAREHOUSE",
        description: "Warehouse configuration and management",
        display_order: 5,
        icon: "warehouse",
      },
      {
        name: "Reports",
        code: "REPORTS",
        description: "Generate and view reports",
        display_order: 6,
        icon: "bar_chart",
      },
      {
        name: "Settings",
        code: "SETTINGS",
        description: "System settings and configuration",
        display_order: 7,
        icon: "settings",
      },
      {
        name: "Suppliers",
        code: "SUPPLIERS",
        description: "Manage supplier information",
        display_order: 8,
        icon: "local_shipping",
      },
      {
        name: "Inbounds",
        code: "INBOUND",
        description: "All activities concerning Inbounds",
        display_order: 10,
        icon: "putaway",
      },
      {
        name: "Pallets",
        code: "PALLET",
        description: "All activities concerning Pallets",
        display_order: 10,
      },
      {
        name: "GRN",
        code: "GRN",
        description: "All activities concerning GRNs",
        display_order: 10,
        icon: "pallet",
      },
      {
        name: "Putaway",
        code: "PUTAWAY",
        description: "All activities concerning Putaway",
        display_order: 11,
        icon: "putaway",
      },
    ]);
    console.log(`✅ Created ${modules.length} modules`);

    // 3. Create Roles
    console.log("Creating roles...");
    const adminRole = await Role.create({
      role_name: "Administrator",
      role_code: "ADMIN",
      description: "Full system access",
    });

    const managerRole = await Role.create({
      role_name: "Warehouse Manager",
      role_code: "MANAGER",
      description: "Manage warehouse operations",
    });

    const userRole = await Role.create({
      role_name: "User",
      role_code: "USER",
      description: "Basic user access",
    });
    console.log("✅ Created 3 roles");

    // 4. Assign All Permissions to Admin Role
    console.log("Assigning permissions to Admin role...");
    let adminPermissions = 0;
    for (const module of modules) {
      for (const permission of permissions) {
        await RoleModule.create({
          role_id: adminRole.id,
          module_id: module.id,
          permission_id: permission.id,
          is_granted: true,
        });
        adminPermissions++;
      }
    }
    console.log(`✅ Assigned ${adminPermissions} permissions to Admin`);

    // 5. Assign Limited Permissions to Manager Role
    console.log("Assigning permissions to Manager role...");
    const managerModules = [
      "DASHBOARD",
      "INVENTORY",
      "ORDERS",
      "WAREHOUSE",
      "REPORTS",
      "SUPPLIERS",
    ];
    const managerPerms = ["CREATE", "READ", "UPDATE", "EXPORT"];
    let managerPermissions = 0;

    for (const module of modules) {
      if (managerModules.includes(module.code)) {
        for (const permission of permissions) {
          if (managerPerms.includes(permission.code)) {
            await RoleModule.create({
              role_id: managerRole.id,
              module_id: module.id,
              permission_id: permission.id,
              is_granted: true,
            });
            managerPermissions++;
          }
        }
      }
    }
    console.log(`✅ Assigned ${managerPermissions} permissions to Manager`);

    // 6. Assign Basic Permissions to User Role
    console.log("Assigning permissions to User role...");
    const userModules = ["DASHBOARD", "INVENTORY", "ORDERS"];
    const userPerms = ["READ"];
    let userPermissions = 0;

    for (const module of modules) {
      if (userModules.includes(module.code)) {
        for (const permission of permissions) {
          if (userPerms.includes(permission.code)) {
            await RoleModule.create({
              role_id: userRole.id,
              module_id: module.id,
              permission_id: permission.id,
              is_granted: true,
            });
            userPermissions++;
          }
        }
      }
    }
    console.log(`✅ Assigned ${userPermissions} permissions to User`);

    // 7. Create Admin User
    console.log("Creating admin user...");
    const adminUser = await User.create({
      username: "admin",
      email: "admin@wms.com",
      pass_hash: "Admin@123",
      first_name: "System",
      last_name: "Administrator",
      phone: "1234567890",
      is_active: true,
    });

    await UserRole.create({
      user_id: adminUser.id,
      role_id: adminRole.id,
    });
    console.log("✅ Created admin user");
    console.log("   Email: admin@wms.com");
    console.log("   Password: Admin@123");

    // 8. Create a test manager user
    console.log("Creating manager user...");
    const managerUser = await User.create({
      username: "manager",
      email: "manager@wms.com",
      pass_hash: "Manager@123",
      first_name: "Test",
      last_name: "Manager",
      phone: "9876543210",
      is_active: true,
    });

    await UserRole.create({
      user_id: managerUser.id,
      role_id: managerRole.id,
    });
    console.log("✅ Created manager user");
    console.log("   Email: manager@wms.com");
    console.log("   Password: Manager@123");

    // 9. Create a test regular user
    console.log("Creating regular user...");
    const regularUser = await User.create({
      username: "user",
      email: "user@wms.com",
      pass_hash: "User@123",
      first_name: "Test",
      last_name: "User",
      phone: "5555555555",
      is_active: true,
    });

    await UserRole.create({
      user_id: regularUser.id,
      role_id: userRole.id,
    });
    console.log("✅ Created regular user");
    console.log("   Email: user@wms.com");
    console.log("   Password: User@123");

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📝 Summary:");
    console.log(`   - ${permissions.length} Permissions`);
    console.log(`   - ${modules.length} Modules`);
    console.log(`   - 3 Roles (Admin, Manager, User)`);
    console.log(`   - 3 Test Users`);
    console.log("\n🔐 Test Accounts:");
    console.log("   Admin: admin@wms.com / Admin@123");
    console.log("   Manager: manager@wms.com / Manager@123");
    console.log("   User: user@wms.com / User@123");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
};

export default seedDatabase;
