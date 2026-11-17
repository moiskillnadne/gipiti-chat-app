// SPIKE (GIPITI-231), not for main.
import { OpenAPIHandler } from "@orpc/openapi/fetch";

import { auth } from "@/app/(auth)/auth";
import { generateSpikeSpec } from "@/server/api/_spike/openapi";
import { spikeRouter } from "@/server/api/_spike/router";

export const maxDuration = 60;

const PREFIX = "/api/spike";
const handler = new OpenAPIHandler(spikeRouter);

const handle = async (request: Request): Promise<Response> => {
  // On a deployment everything under /api/spike needs a session (plan P4).
  // Locally it is open, so the procedures' own 401 can be captured.
  if (process.env.VERCEL_ENV) {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ spike: "sign in first" }, { status: 401 });
    }
  }

  if (new URL(request.url).pathname === `${PREFIX}/openapi.json`) {
    return Response.json(await generateSpikeSpec());
  }

  const { matched, response } = await handler.handle(request, {
    prefix: PREFIX,
    context: { request, transport: "http" },
  });

  if (matched) {
    return response;
  }

  return Response.json(
    { spike: "no procedure matched", path: new URL(request.url).pathname },
    { status: 404 }
  );
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
