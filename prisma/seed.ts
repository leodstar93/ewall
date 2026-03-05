import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";


// Cambia estos valores si quieres
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@ewall.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

const ROLES = [
  { name: "ADMIN", description: "Full access" },
  { name: "DOCTOR", description: "Doctor access" },
  { name: "STAFF", description: "Staff access" },
] as const;

const PERMISSIONS = [
  // Users / RBAC
  { key: "users:read", description: "Read users" },
  { key: "users:write", description: "Create/update users" },
  { key: "roles:read", description: "Read roles" },
  { key: "roles:write", description: "Create/update roles" },
  { key: "permissions:read", description: "Read permissions" },
  { key: "permissions:write", description: "Create/update permissions" },

  // Ejemplos de módulos (ajusta a tu app)
  { key: "cases:read", description: "Read cases" },
  { key: "cases:write", description: "Create/update cases" },
  { key: "labslips:read", description: "Read labslips" },
  { key: "labslips:write", description: "Create/update labslips" },
] as const;

// Mapa de permisos por rol (ajusta como quieras)
const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]["name"], string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key), // todo
  DOCTOR: ["cases:read", "cases:write", "labslips:read", "labslips:write"],
  STAFF: ["cases:read", "labslips:read"],
};

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

async function main() {
  console.log("🌱 Seeding RBAC...");

  await upsertRoles();
  await upsertPermissions();
  await syncRolePermissions();

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