import { DmvRegistrationType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { normalizeOptionalText, parseOptionalInt } from "@/services/dmv/shared";

type RequirementTemplateBody = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  appliesToType?: unknown;
  appliesToRenewal?: unknown;
  appliesToInitial?: unknown;
  isRequired?: unknown;
  sortOrder?: unknown;
  active?: unknown;
};

export async function GET() {
  const guard = await requireApiPermission("dmv:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const templates = await prisma.dmvRequirementTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return Response.json({ templates });
  } catch (error) {
    console.error("Failed to fetch DMV requirement templates", error);
    return Response.json(
      { error: "Failed to fetch DMV requirement templates" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("dmv:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as RequirementTemplateBody;
    const code = normalizeOptionalText(body.code);
    const name = normalizeOptionalText(body.name);
    const sortOrder = parseOptionalInt(body.sortOrder);
    const appliesToType =
      typeof body.appliesToType === "string" &&
      Object.values(DmvRegistrationType).includes(body.appliesToType as DmvRegistrationType)
        ? (body.appliesToType as DmvRegistrationType)
        : null;

    if (sortOrder === "INVALID") {
      return Response.json({ error: "Invalid sortOrder" }, { status: 400 });
    }
    if (!code || !name) {
      return Response.json({ error: "code and name are required" }, { status: 400 });
    }

    const template = typeof body.id === "string" && body.id.trim()
      ? await prisma.dmvRequirementTemplate.update({
          where: { id: body.id },
          data: {
            code,
            name,
            appliesToType,
            appliesToRenewal: body.appliesToRenewal !== false,
            appliesToInitial: body.appliesToInitial !== false,
            isRequired: body.isRequired !== false,
            sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
            active: body.active !== false,
          },
        })
      : await prisma.dmvRequirementTemplate.upsert({
          where: { code },
          update: {
            name,
            appliesToType,
            appliesToRenewal: body.appliesToRenewal !== false,
            appliesToInitial: body.appliesToInitial !== false,
            isRequired: body.isRequired !== false,
            sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
            active: body.active !== false,
          },
          create: {
            code,
            name,
            appliesToType,
            appliesToRenewal: body.appliesToRenewal !== false,
            appliesToInitial: body.appliesToInitial !== false,
            isRequired: body.isRequired !== false,
            sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
            active: body.active !== false,
          },
        });

    return Response.json({ template });
  } catch (error) {
    console.error("Failed to save DMV requirement template", error);
    return Response.json(
      { error: "Failed to save DMV requirement template" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiPermission("dmv:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (!id) {
      return Response.json({ error: "Template id is required" }, { status: 400 });
    }

    await prisma.dmvRequirementTemplate.delete({
      where: { id },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete DMV requirement template", error);
    return Response.json(
      { error: "Failed to delete DMV requirement template" },
      { status: 500 },
    );
  }
}
