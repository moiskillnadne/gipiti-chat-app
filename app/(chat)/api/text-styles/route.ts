import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createTextStyle,
  deleteTextStyle,
  getTextStylesByUserId,
  updateTextStyle,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const createSchema = z.object({
  name: z.string().min(1).max(128),
  examples: z.array(z.string().min(1).max(2000)).min(1).max(20),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128).optional(),
  examples: z.array(z.string().min(1).max(2000)).min(1).max(20).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const styles = await getTextStylesByUserId({ userId: session.user.id });
  return Response.json(styles);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const json = await request.json();
    const { name, examples, isDefault } = createSchema.parse(json);

    const style = await createTextStyle({
      userId: session.user.id,
      name,
      examples,
      isDefault,
    });

    return Response.json(style, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid text style data"
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
    const { id, name, examples, isDefault } = updateSchema.parse(json);

    const updated = await updateTextStyle({
      id,
      userId: session.user.id,
      name,
      examples,
      isDefault,
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid text style data"
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

  await deleteTextStyle({ id, userId: session.user.id });
  return Response.json({ success: true });
}
