import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { US_JURISDICTIONS } from "../features/ifta/constants/us-jurisdictions";

// Cambia estos valores si quieres
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@ewall.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

const ROLES = [
  { name: "ADMIN", description: "Full access" },
  { name: "TRUCKER", description: "Trucker access" },
  { name: "STAFF", description: "Staff access" },
  { name: "USER", description: "Regular user access" },
] as const;

const PERMISSIONS = [
  // Users / RBAC
  { key: "users:read", description: "Read users" },
  { key: "users:write", description: "Create/update users" },
  { key: "roles:read", description: "Read roles" },
  { key: "roles:write", description: "Create/update roles" },
  { key: "permissions:read", description: "Read permissions" },
  { key: "permissions:write", description: "Create/update permissions" },
  { key: "dashboard:access", description: "Access dashboard" },

  // Ejemplos de módulos (ajusta a tu app)
  { key: "profile:access", description: "Access profile" },
  { key: "profile:write", description: "Update profile" },
  { key: "documents:read", description: "Read documents" },
  { key: "documents:write", description: "Upload/manage documents" },

  // IFTA
  { key: "ifta:read", description: "Read IFTA reports" },
  { key: "ifta:write", description: "Create/update/delete IFTA reports" },
  { key: "truck:read", description: "Read trucks" },
  { key: "truck:write", description: "Create/update trucks" },
  { key: "reports:read", description: "Read generated reports" },
  { key: "reports:write", description: "Create/update generated reports" },
  { key: "reports:generate", description: "Generate reports" },
  { key: "reports:download", description: "Download reports" },
  { key: "settings:read", description: "Read admin settings" },
  { key: "settings:update", description: "Update admin settings" },
  { key: "iftaTaxRates:read", description: "Read IFTA tax rates" },
  { key: "iftaTaxRates:write", description: "Create and edit IFTA tax rates" },
  { key: "iftaTaxRates:import", description: "Import IFTA tax rates" },
  { key: "ucr:read", description: "Read UCR filings" },
  { key: "ucr:create", description: "Create UCR filings" },
  { key: "ucr:update", description: "Update editable UCR filings" },
  { key: "ucr:submit", description: "Submit UCR filings for review" },
  { key: "ucr:review", description: "Review UCR filings" },
  { key: "ucr:request_correction", description: "Request UCR filing corrections" },
  { key: "ucr:approve", description: "Approve and mark UCR filings compliant" },
  { key: "ucr:manage_rates", description: "Manage UCR annual rate brackets" },
  { key: "ucr:upload_documents", description: "Upload UCR filing documents" },

  // Staff

  //admin
  { key: "admin:access", description: "Access admin" },
] as const;

// Mapa de permisos por rol (ajusta como quieras)
const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]["name"], string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key), // todo
  TRUCKER: [
    "ifta:read",
    "ifta:write",
    "truck:read",
    "truck:write",
    "reports:read",
    "reports:write",
    "reports:generate",
    "reports:download",
    "ucr:read",
    "ucr:create",
    "ucr:update",
    "ucr:submit",
    "ucr:upload_documents",
  ],
  STAFF: [
    "reports:read",
    "reports:write",
    "reports:generate",
    "reports:download",
    "ucr:read",
    "ucr:review",
    "ucr:request_correction",
    "ucr:approve",
    "ucr:upload_documents",
  ],
  USER: [
    "profile:access",
    "profile:write",
    "dashboard:access",
    "ucr:read",
    "ucr:create",
    "ucr:update",
    "ucr:submit",
    "ucr:upload_documents",
  ],
};

const SAMPLE_UCR_BRACKETS = [
  { minVehicles: 0, maxVehicles: 2, feeAmount: "46.00" },
  { minVehicles: 3, maxVehicles: 5, feeAmount: "138.00" },
  { minVehicles: 6, maxVehicles: 20, feeAmount: "276.00" },
  { minVehicles: 21, maxVehicles: 100, feeAmount: "963.00" },
  { minVehicles: 101, maxVehicles: 1000, feeAmount: "4592.00" },
  { minVehicles: 1001, maxVehicles: 1000000, feeAmount: "44710.00" },
] as const;

async function upsertRoles() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }
}

async function upsertPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }
}

async function syncRolePermissions() {
  const roles = await prisma.role.findMany({ where: { name: { in: ROLES.map((r) => r.name) } } });
  const perms = await prisma.permission.findMany({ where: { key: { in: PERMISSIONS.map((p) => p.key) } } });

  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const permByKey = new Map(perms.map((p) => [p.key, p]));

  // Creamos relaciones (idempotente con upsert o createMany+skipDuplicates)
  // Recomendado: createMany con skipDuplicates (más rápido)
  const rows: { roleId: string; permissionId: string }[] = [];

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) continue;

    for (const key of keys) {
      const perm = permByKey.get(key);
      if (!perm) continue;

      rows.push({ roleId: role.id, permissionId: perm.id });
    }
  }

  // Si tu modelo RolePermission tiene unique compuesto (roleId, permissionId),
  // esto es 100% idempotente:
  await prisma.rolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

async function upsertJurisdictions() {
  for (const jurisdiction of US_JURISDICTIONS) {
    await prisma.jurisdiction.upsert({
      where: { code: jurisdiction.code },
      update: {
        name: jurisdiction.name,
        countryCode: jurisdiction.countryCode,
        isIftaMember: jurisdiction.isIftaMember,
        isActive: jurisdiction.isActive,
        sortOrder: jurisdiction.sortOrder,
      },
      create: {
        code: jurisdiction.code,
        name: jurisdiction.name,
        countryCode: jurisdiction.countryCode,
        isIftaMember: jurisdiction.isIftaMember,
        isActive: jurisdiction.isActive,
        sortOrder: jurisdiction.sortOrder,
      },
    });
  }
}

async function upsertAdminUser() {
  // Crear o actualizar el usuario admin
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Admin",
      // Si quieres NO cambiar la password si ya existe, comenta la línea siguiente:
      passwordHash,
    },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      passwordHash,
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (!adminRole) throw new Error("ADMIN role not found after upsert");

  await prisma.userRole.createMany({
    data: [{ userId: admin.id, roleId: adminRole.id }],
    skipDuplicates: true,
  });

  return admin;
}

async function upsertSampleUcrBrackets() {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

  for (const year of years) {
    for (const bracket of SAMPLE_UCR_BRACKETS) {
      await prisma.uCRRateBracket.upsert({
        where: {
          year_minVehicles_maxVehicles: {
            year,
            minVehicles: bracket.minVehicles,
            maxVehicles: bracket.maxVehicles,
          },
        },
        update: {
          feeAmount: new Prisma.Decimal(bracket.feeAmount),
          active: true,
        },
        create: {
          year,
          minVehicles: bracket.minVehicles,
          maxVehicles: bracket.maxVehicles,
          feeAmount: new Prisma.Decimal(bracket.feeAmount),
          active: true,
        },
      });
    }
  }
}

async function main() {
  console.log("🌱 Seeding RBAC...");

  await upsertRoles();
  await upsertPermissions();
  await syncRolePermissions();
  await upsertJurisdictions();
  await upsertSampleUcrBrackets();

  const admin = await upsertAdminUser();

  console.log("✅ Seed completed.");
  console.log(`👤 Admin: ${admin.email}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD} (set via SEED_ADMIN_PASSWORD env var)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
