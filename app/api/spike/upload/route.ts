// SPIKE S4 (GIPITI-231), not for main. Measures how large a request body
// reaches a function: reads the body, counts the bytes, stores nothing.
import { auth } from "@/app/(auth)/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ spike: "sign in first" }, { status: 401 });
  }

  const declaredLength = request.headers.get("content-length");
  const contentType = request.headers.get("content-type") ?? "";
  const mode = new URL(request.url).searchParams.get("mode") ?? "raw";

  if (mode === "form") {
    const formData = await request.formData();
    const file = formData.get("file");
    return Response.json({
      mode,
      declaredLength,
      fileBytes: file instanceof Blob ? file.size : null,
    });
  }

  const body = await request.arrayBuffer();
  return Response.json({
    mode,
    declaredLength,
    contentType,
    receivedBytes: body.byteLength,
  });
}
