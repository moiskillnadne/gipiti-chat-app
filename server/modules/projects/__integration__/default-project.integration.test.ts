import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteUsers,
  readDefaultProjectIds,
  readProjectIds,
  refuseInsertsOfProjectNamed,
  seedProject,
  seedUser,
} from "@/server/modules/projects/__integration__/seed-project-data";
import { createProjectForUser } from "@/server/modules/projects/create-project-for-user";
import { updateProjectForUser } from "@/server/modules/projects/update-project-for-user";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const ROUNDS = 20;
const CONCURRENT_CALLS = 6;

const createdUserIds: string[] = [];

const newUser = async (): Promise<string> => {
  const userId = await seedUser();
  createdUserIds.push(userId);

  return userId;
};

const rejectionsOf = (results: PromiseSettledResult<unknown>[]): unknown[] =>
  results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );

beforeEach(() => {
  createdUserIds.length = 0;
});

afterEach(async () => {
  await deleteUsers(createdUserIds);
});

afterAll(async () => {
  await closeDatabaseConnection();
});

describe("creating a default project", () => {
  it("clears the previous default", async () => {
    // Arrange
    const userId = await newUser();
    const previousId = await seedProject({ userId, isDefault: true });

    // Act
    const result = await createProjectForUser({
      userId,
      name: "New",
      isDefault: true,
    });

    // Assert
    expect(result.status).toBe("created");
    const createdId = result.status === "created" ? result.project.id : "";
    expect(await readDefaultProjectIds(userId)).toEqual([createdId]);
    expect(await readProjectIds(userId)).toContain(previousId);
  });

  it("leaves the default alone when the new project is not one", async () => {
    // Arrange
    const userId = await newUser();
    const previousId = await seedProject({ userId, isDefault: true });

    // Act
    await createProjectForUser({ userId, name: "Plain" });

    // Assert
    expect(await readDefaultProjectIds(userId)).toEqual([previousId]);
  });

  it("leaves another user's default alone", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const otherDefaultId = await seedProject({
      userId: otherUserId,
      isDefault: true,
    });

    // Act
    await createProjectForUser({ userId, name: "Mine", isDefault: true });

    // Assert
    expect(await readDefaultProjectIds(otherUserId)).toEqual([otherDefaultId]);
  });

  it("rolls back the clearing when the insert fails", async () => {
    // Arrange
    const userId = await newUser();
    const previousId = await seedProject({ userId, isDefault: true });
    const restore = await refuseInsertsOfProjectNamed("refused-project");

    try {
      // Act
      const attempt = createProjectForUser({
        userId,
        name: "refused-project",
        isDefault: true,
      });

      // Assert
      await expect(attempt).rejects.toThrow();
      expect(await readDefaultProjectIds(userId)).toEqual([previousId]);
      expect(await readProjectIds(userId)).toEqual([previousId]);
    } finally {
      await restore();
    }
  });
});

describe("making an existing project the default", () => {
  it("moves the default and leaves another user's default alone", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    await seedProject({ userId, isDefault: true });
    const targetId = await seedProject({ userId });
    const otherDefaultId = await seedProject({
      userId: otherUserId,
      isDefault: true,
    });

    // Act
    const result = await updateProjectForUser({
      userId,
      projectId: targetId,
      changes: { isDefault: true },
    });

    // Assert
    expect(result.status).toBe("ok");
    expect(await readDefaultProjectIds(userId)).toEqual([targetId]);
    expect(await readDefaultProjectIds(otherUserId)).toEqual([otherDefaultId]);
  });

  it("is not found for another user's project and clears nobody's default", async () => {
    // Arrange
    const userId = await newUser();
    const otherUserId = await newUser();
    const ownDefaultId = await seedProject({ userId, isDefault: true });
    const foreignId = await seedProject({ userId: otherUserId });

    // Act
    const result = await updateProjectForUser({
      userId,
      projectId: foreignId,
      changes: { isDefault: true },
    });

    // Assert
    expect(result).toEqual({ status: "project_not_found" });
    expect(await readDefaultProjectIds(userId)).toEqual([ownDefaultId]);
    expect(await readDefaultProjectIds(otherUserId)).toEqual([]);
  });

  it("is not found for a project that does not exist and clears nothing", async () => {
    // Arrange
    const userId = await newUser();
    const ownDefaultId = await seedProject({ userId, isDefault: true });

    // Act
    const result = await updateProjectForUser({
      userId,
      projectId: "00000000-0000-4000-8000-000000000000",
      changes: { isDefault: true },
    });

    // Assert
    expect(result).toEqual({ status: "project_not_found" });
    expect(await readDefaultProjectIds(userId)).toEqual([ownDefaultId]);
  });

  it("clears the flag of the current default when isDefault is false", async () => {
    // Arrange
    const userId = await newUser();
    const defaultId = await seedProject({ userId, isDefault: true });

    // Act
    await updateProjectForUser({
      userId,
      projectId: defaultId,
      changes: { isDefault: false },
    });

    // Assert
    expect(await readDefaultProjectIds(userId)).toEqual([]);
  });

  it("rolls back the clearing when the write fails", async () => {
    // Arrange: the write of the switch is an UPDATE, so make the clearing
    // succeed and the target's UPDATE fail with a value the column refuses.
    const userId = await newUser();
    const ownDefaultId = await seedProject({ userId, isDefault: true });
    const targetId = await seedProject({ userId });

    // Act
    const attempt = updateProjectForUser({
      userId,
      projectId: targetId,
      changes: { isDefault: true, swatch: "s".repeat(17) },
    });

    // Assert
    await expect(attempt).rejects.toThrow();
    expect(await readDefaultProjectIds(userId)).toEqual([ownDefaultId]);
  });

  it(`leaves exactly one default when several calls make a default at once (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const userId = await newUser();
      const projectIds = await Promise.all(
        Array.from({ length: CONCURRENT_CALLS }, () => seedProject({ userId }))
      );

      // Act
      const results = await Promise.allSettled(
        projectIds.map((projectId) =>
          updateProjectForUser({
            userId,
            projectId,
            changes: { isDefault: true },
          })
        )
      );

      // Assert
      expect(rejectionsOf(results)).toEqual([]);
      expect(await readDefaultProjectIds(userId)).toHaveLength(1);
    }
  });

  it(`leaves exactly one default when a user with no project makes several at once (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const userId = await newUser();

      // Act
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_CALLS }, (_, index) =>
          createProjectForUser({
            userId,
            name: `First ${index}`,
            isDefault: true,
          })
        )
      );

      // Assert
      expect(rejectionsOf(results)).toEqual([]);
      expect(await readProjectIds(userId)).toHaveLength(CONCURRENT_CALLS);
      expect(await readDefaultProjectIds(userId)).toHaveLength(1);
    }
  });

  it(`leaves exactly one default when creates and updates overlap on a user with one project (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const userId = await newUser();
      const existingId = await seedProject({ userId });

      // Act
      const results = await Promise.allSettled([
        ...Array.from({ length: CONCURRENT_CALLS }, (_, index) =>
          createProjectForUser({
            userId,
            name: `Created ${index}`,
            isDefault: true,
          })
        ),
        updateProjectForUser({
          userId,
          projectId: existingId,
          changes: { isDefault: true },
        }),
      ]);

      // Assert
      expect(rejectionsOf(results)).toEqual([]);
      expect(await readDefaultProjectIds(userId)).toHaveLength(1);
    }
  });
});
