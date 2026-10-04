import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSafeInsertBefore,
  createSafeRemoveChild,
  installDomMutationGuard,
} from "../dom-mutation-guard";

type FakeNode = { parentNode: unknown };

const createParentWithChild = (): { parent: FakeNode; child: FakeNode } => {
  const parent: FakeNode = { parentNode: null };
  const child: FakeNode = { parentNode: parent };
  return { parent, child };
};

describe("createSafeRemoveChild", () => {
  it("delegates to the original when the node is a child of the parent", () => {
    // Arrange
    const { parent, child } = createParentWithChild();
    const originalRemoveChild = vi.fn((node: FakeNode) => node);
    const onMismatch = vi.fn();
    const safeRemoveChild = createSafeRemoveChild(
      originalRemoveChild,
      onMismatch
    );

    // Act
    const removed = safeRemoveChild.call(parent, child);

    // Assert
    expect(removed).toBe(child);
    expect(originalRemoveChild).toHaveBeenCalledOnce();
    expect(onMismatch).not.toHaveBeenCalled();
  });

  it("skips and reports when a translator moved the node away", () => {
    // Arrange
    const { parent } = createParentWithChild();
    const translatorWrapper: FakeNode = { parentNode: parent };
    const movedChild: FakeNode = { parentNode: translatorWrapper };
    const originalRemoveChild = vi.fn((node: FakeNode) => node);
    const onMismatch = vi.fn();
    const safeRemoveChild = createSafeRemoveChild(
      originalRemoveChild,
      onMismatch
    );

    // Act
    const removed = safeRemoveChild.call(parent, movedChild);

    // Assert
    expect(removed).toBe(movedChild);
    expect(originalRemoveChild).not.toHaveBeenCalled();
    expect(onMismatch).toHaveBeenCalledExactlyOnceWith("removeChild");
  });
});

describe("createSafeInsertBefore", () => {
  it("delegates to the original when the reference node is a child", () => {
    // Arrange
    const { parent, child: referenceNode } = createParentWithChild();
    const newNode: FakeNode = { parentNode: null };
    const originalInsertBefore = vi.fn((node: FakeNode) => node);
    const originalAppendChild = vi.fn((node: FakeNode) => node);
    const onMismatch = vi.fn();
    const safeInsertBefore = createSafeInsertBefore(
      originalInsertBefore,
      originalAppendChild,
      onMismatch
    );

    // Act
    safeInsertBefore.call(parent, newNode, referenceNode);

    // Assert
    expect(originalInsertBefore).toHaveBeenCalledWith(newNode, referenceNode);
    expect(originalAppendChild).not.toHaveBeenCalled();
    expect(onMismatch).not.toHaveBeenCalled();
  });

  it("delegates a null reference node to the original (append semantics)", () => {
    // Arrange
    const parent: FakeNode = { parentNode: null };
    const newNode: FakeNode = { parentNode: null };
    const originalInsertBefore = vi.fn((node: FakeNode) => node);
    const originalAppendChild = vi.fn((node: FakeNode) => node);
    const onMismatch = vi.fn();
    const safeInsertBefore = createSafeInsertBefore(
      originalInsertBefore,
      originalAppendChild,
      onMismatch
    );

    // Act
    safeInsertBefore.call(parent, newNode, null);

    // Assert
    expect(originalInsertBefore).toHaveBeenCalledWith(newNode, null);
    expect(onMismatch).not.toHaveBeenCalled();
  });

  it("appends and reports when the reference node was moved away", () => {
    // Arrange
    const parent: FakeNode = { parentNode: null };
    const movedReference: FakeNode = { parentNode: { parentNode: parent } };
    const newNode: FakeNode = { parentNode: null };
    const originalInsertBefore = vi.fn((node: FakeNode) => node);
    const originalAppendChild = vi.fn((node: FakeNode) => node);
    const onMismatch = vi.fn();
    const safeInsertBefore = createSafeInsertBefore(
      originalInsertBefore,
      originalAppendChild,
      onMismatch
    );

    // Act
    const inserted = safeInsertBefore.call(parent, newNode, movedReference);

    // Assert
    expect(inserted).toBe(newNode);
    expect(originalInsertBefore).not.toHaveBeenCalled();
    expect(originalAppendChild).toHaveBeenCalledWith(newNode);
    expect(onMismatch).toHaveBeenCalledExactlyOnceWith("insertBefore");
  });
});

describe("installDomMutationGuard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches Node.prototype only once", () => {
    // Arrange
    class FakeDomNode {
      removeChild(node: FakeNode): FakeNode {
        return node;
      }
      insertBefore(node: FakeNode): FakeNode {
        return node;
      }
      appendChild(node: FakeNode): FakeNode {
        return node;
      }
    }
    const originalRemoveChild = FakeDomNode.prototype.removeChild;
    vi.stubGlobal("Node", FakeDomNode);

    // Act
    installDomMutationGuard(vi.fn());
    const patchedRemoveChild = FakeDomNode.prototype.removeChild;
    installDomMutationGuard(vi.fn());

    // Assert
    expect(patchedRemoveChild).not.toBe(originalRemoveChild);
    expect(FakeDomNode.prototype.removeChild).toBe(patchedRemoveChild);
  });
});
