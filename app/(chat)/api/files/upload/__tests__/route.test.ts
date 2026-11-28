import { put } from "@vercel/blob";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/modules/auth/next-auth";

import { POST } from "../route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

// `auth` is overloaded (it is also a middleware); the route calls the session form.
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const uploadRequest = (file: File): Request => {
  const formData = new FormData();
  formData.append("file", file);
  return new Request("http://localhost/api/files/upload", {
    method: "POST",
    body: formData,
  });
};

describe("POST /api/files/upload", () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    } as Session);
    vi.mocked(put).mockReset();
  });

  it("refuses an empty file with the empty_file code and stores nothing", async () => {
    // Arrange: a 0-byte .docx, as a cloud-drive placeholder arrives.
    const emptyFile = new File([], "lecture.docx", { type: DOCX_MIME_TYPE });

    // Act
    const response = await POST(uploadRequest(emptyFile));

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "empty_file",
      error: "File is empty",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("stores a non-empty document", async () => {
    // Arrange
    const documentFile = new File(["PK\u0003\u0004"], "lecture.docx", {
      type: DOCX_MIME_TYPE,
    });
    vi.mocked(put).mockResolvedValue({
      url: "https://store.public.blob.vercel-storage.com/lecture.docx",
      pathname: "lecture.docx",
      contentType: DOCX_MIME_TYPE,
    } as Awaited<ReturnType<typeof put>>);

    // Act
    const response = await POST(uploadRequest(documentFile));

    // Assert
    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledWith(
      "lecture.docx",
      expect.anything(),
      expect.objectContaining({ contentType: DOCX_MIME_TYPE })
    );
  });
});
