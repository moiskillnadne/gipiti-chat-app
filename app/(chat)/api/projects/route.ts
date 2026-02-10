import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createProject,
  deleteProject,
  getProjectsByUserId,
  updateProject,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const createSchema = z.object({
  name: z.string().min(1).max(128),
  contextEntries: z.array(z.string().min(1).max(2000)).max(20).optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128).optional(),
  contextEntries: z.array(z.string().min(1).max(2000)).max(20).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const projects = await getProjectsByUserId({ userId: session.user.id });
  return Response.json(projects);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const json = await request.json();
    const { name, contextEntries, isDefault } = createSchema.parse(json);

    const created = await createProject({
      userId: session.user.id,
      name,
      contextEntries: contextEntries ?? [],
      isDefault,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid project data"
      ).toResponse();
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const json = await request.json();
    const { id, name, contextEntries, isDefault } = updateSchema.parse(json);

    const updated = await updateProject({
      id,
      userId: session.user.id,
      name,
      contextEntries,
      isDefault,
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid project data"
      ).toResponse();
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is required"
    ).toResponse();
  }

  await deleteProject({ id, userId: session.user.id });
  return Response.json({ success: true });
}
