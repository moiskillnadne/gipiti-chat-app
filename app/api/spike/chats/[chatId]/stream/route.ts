// SPIKE S3 (GIPITI-231), not for main. A raw route next to the oRPC
// catch-all. It exports GET only.
export const maxDuration = 800;

type RouteContext = { params: Promise<{ chatId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { chatId } = await params;
  return new Response(`data: raw stream GET for ${chatId}\n\n`, {
    headers: {
      "content-type": "text/event-stream",
      "x-spike-route": "raw-stream",
    },
  });
}
