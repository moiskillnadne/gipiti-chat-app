import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteUsers,
  readProjectIds,
  seedProjects,
  seedUser,
} from "@/server/modules/projects/__integration__/seed-project-data";
import { createProjectForUser } from "@/server/modules/projects/create-project-for-user";
import { MAX_PROJECTS_PER_USER } from "@/server/modules/projects/project-limits";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const CONCURRENT_CREATES = 8;
const ROUNDS = 10;

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

describe("the project limit", () => {
  it("lets the last allowed project in and refuses the next", async () => {
    // Arrange
    const userId = await newUser();
    await seedProjects({ userId, count: MAX_PROJECTS_PER_USER - 1 });

    // Act
    const last = await createProjectForUser({ userId, name: "Last" });
    const over = await createProjectForUser({ userId, name: "Over" });

    // Assert
    expect(last.status).toBe("created");
    expect(over).toEqual({
      status: "project_limit_reached",
      limit: MAX_PROJECTS_PER_USER,
    });
    expect(await readProjectIds(userId)).toHaveLength(MAX_PROJECTS_PER_USER);
  });

  it("refuses a new default too, and clears nothing", async () => {
    // Arrange
    const userId = await newUser();
    await seedProjects({ userId, count: MAX_PROJECTS_PER_USER });

    // Act
    const result = await createProjectForUser({
      userId,
      name: "Over",
      isDefault: true,
    });

    // Assert
    expect(result.status).toBe("project_limit_reached");
  });

  it(`leaves exactly the limit when several creates start at one below it (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const userId = await newUser();
      await seedProjects({ userId, count: MAX_PROJECTS_PER_USER - 1 });

      // Act
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_CREATES }, (_, index) =>
          createProjectForUser({ userId, name: `Race ${index}` })
        )
      );

      // Assert
      const settled = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value.status] : []
      );
      expect(settled).toHaveLength(CONCURRENT_CREATES);
      expect(settled.filter((status) => status === "created")).toHaveLength(1);
      expect(await readProjectIds(userId)).toHaveLength(MAX_PROJECTS_PER_USER);
    }
  });

  it("does not count another user's projects", async () => {
    // Arrange
    const userId = await newUser();
    const fullUserId = await newUser();
    await seedProjects({ userId: fullUserId, count: MAX_PROJECTS_PER_USER });

    // Act
    const result = await createProjectForUser({ userId, name: "Mine" });

    // Assert
    expect(result.status).toBe("created");
  });
});
