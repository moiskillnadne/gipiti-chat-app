import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteUsers,
  readProjectFileIds,
  readProjectIds,
  readProjectUpdatedAt,
  seedProject,
  seedProjectFile,
  seedUser,
} from "@/server/modules/projects/__integration__/seed-project-data";
import { deleteProjectForUser } from "@/server/modules/projects/delete-project-for-user";
import { getProject } from "@/server/modules/projects/get-project";
import { listProjects } from "@/server/modules/projects/list-projects";
import { updateProjectForUser } from "@/server/modules/projects/update-project-for-user";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const createdUserIds: string[] = [];

const newUser = async (): Promise<string> => {
  const userId = await seedUser();
  createdUserIds.push(userId);

  return userId;
};

beforeEach(() => {
  createdUserIds.length = 0;
});

afterEach(async () => {
  await deleteUsers(createdUserIds);
});

afterAll(async () => {
  await closeDatabaseConnection();
});

describe("deleting a project", () => {
  it("removes the project and its file rows and nothing of another user", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const doomedId = await seedProject({ userId });
    const keptId = await seedProject({ userId });
    const foreignId = await seedProject({ userId: otherUserId });
    await seedProjectFile({ projectId: doomedId, userId });
    await seedProjectFile({ projectId: doomedId, userId });
    const keptFileId = await seedProjectFile({ projectId: keptId, userId });
    const foreignFileId = await seedProjectFile({
      projectId: foreignId,
      userId: otherUserId,
    });

    // Act
    const result = await deleteProjectForUser({ userId, projectId: doomedId });

    // Assert
    expect(result).toEqual({ status: "deleted" });
    expect(await readProjectIds(userId)).toEqual([keptId]);
    expect(await readProjectFileIds([doomedId])).toEqual([]);
    expect(await readProjectFileIds([keptId])).toEqual([keptFileId]);
    expect(await readProjectIds(otherUserId)).toEqual([foreignId]);
    expect(await readProjectFileIds([foreignId])).toEqual([foreignFileId]);
  });

  it("is not found for another user's project and deletes nothing", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const foreignId = await seedProject({ userId: otherUserId });
    const foreignFileId = await seedProjectFile({
      projectId: foreignId,
      userId: otherUserId,
    });

    // Act
    const result = await deleteProjectForUser({
      userId,
      projectId: foreignId,
    });

    // Assert
    expect(result).toEqual({ status: "project_not_found" });
    expect(await readProjectIds(otherUserId)).toEqual([foreignId]);
    expect(await readProjectFileIds([foreignId])).toEqual([foreignFileId]);
  });

  it("is not found a second time", async () => {
    // Arrange
    const userId = await newUser();
    const projectId = await seedProject({ userId });
    await deleteProjectForUser({ userId, projectId });

    // Act
    const result = await deleteProjectForUser({ userId, projectId });

    // Assert
    expect(result).toEqual({ status: "project_not_found" });
  });
});

describe("listing projects", () => {
  it("lists only the user's projects, most recently changed first", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const oldestId = await seedProject({
      userId,
      updatedAt: "2026-01-01 10:00:00",
    });
    const newestId = await seedProject({
      userId,
      updatedAt: "2026-03-01 10:00:00",
    });
    const middleId = await seedProject({
      userId,
      updatedAt: "2026-02-01 10:00:00",
    });
    await seedProject({
      userId: otherUserId,
      updatedAt: "2026-04-01 10:00:00",
    });

    // Act
    const projects = await listProjects({ userId });

    // Assert
    expect(projects.map(({ id }) => id)).toEqual([
      newestId,
      middleId,
      oldestId,
    ]);
  });
});

describe("changing a project", () => {
  it("does not touch updatedAt for an empty patch", async () => {
    // Arrange
    const userId = await newUser();
    const projectId = await seedProject({
      userId,
      updatedAt: "2026-01-01 10:00:00",
    });

    // Act
    const result = await updateProjectForUser({
      userId,
      projectId,
      changes: {},
    });

    // Assert
    expect(result.status).toBe("ok");
    expect(await readProjectUpdatedAt(projectId)).toBe("2026-01-01 10:00:00");
  });

  it("writes the given fields, clears with null and sets updatedAt", async () => {
    // Arrange
    const userId = await newUser();
    const projectId = await seedProject({
      userId,
      updatedAt: "2026-01-01 10:00:00",
    });
    await updateProjectForUser({
      userId,
      projectId,
      changes: { description: "Text", swatch: "sw3" },
    });

    // Act
    await updateProjectForUser({
      userId,
      projectId,
      changes: { description: null, pinned: true },
    });
    const result = await getProject({ userId, projectId });

    // Assert
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.project).toMatchObject({
        description: null,
        swatch: "sw3",
        pinned: true,
      });
    }
    expect(await readProjectUpdatedAt(projectId)).not.toBe(
      "2026-01-01 10:00:00"
    );
  });

  it("is not found for another user's project, with or without changes", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const foreignId = await seedProject({
      userId: otherUserId,
      name: "Theirs",
    });

    // Act
    const withChanges = await updateProjectForUser({
      userId,
      projectId: foreignId,
      changes: { name: "Taken" },
    });
    const withoutChanges = await updateProjectForUser({
      userId,
      projectId: foreignId,
      changes: {},
    });
    const read = await getProject({ userId, projectId: foreignId });

    // Assert
    expect(withChanges).toEqual({ status: "project_not_found" });
    expect(withoutChanges).toEqual({ status: "project_not_found" });
    expect(read).toEqual({ status: "project_not_found" });
    expect(
      await getProject({ userId: otherUserId, projectId: foreignId })
    ).toMatchObject({ project: { name: "Theirs" } });
  });
});
