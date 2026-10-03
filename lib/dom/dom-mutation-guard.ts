export type DomMutationOperation = "removeChild" | "insertBefore";

/** Called when React tries to touch a node that is no longer where it left it. */
export type DomMismatchHandler = (operation: DomMutationOperation) => void;

/** Minimal node shape the guards rely on; real DOM nodes satisfy it. */
type GuardedNode = { parentNode: unknown };

type RemoveChild = (this: GuardedNode, child: GuardedNode) => GuardedNode;

type InsertBefore = (
  this: GuardedNode,
  node: GuardedNode,
  referenceNode: GuardedNode | null
) => GuardedNode;

type AppendChild = (this: GuardedNode, node: GuardedNode) => GuardedNode;

let isInstalled = false;

/**
 * Wrap `Node.prototype.removeChild` so removing a node that is no longer a
 * child of `this` is skipped (and reported) instead of throwing.
 */
export const createSafeRemoveChild = (
  originalRemoveChild: RemoveChild,
  onMismatch: DomMismatchHandler
): RemoveChild =>
  function safeRemoveChild(this: GuardedNode, child: GuardedNode) {
    if (child.parentNode !== this) {
      onMismatch("removeChild");
      return child;
    }
    return originalRemoveChild.call(this, child);
  };

/**
 * Wrap `Node.prototype.insertBefore` so a reference node that was moved away
 * falls back to appending instead of throwing.
 */
export const createSafeInsertBefore = (
  originalInsertBefore: InsertBefore,
  originalAppendChild: AppendChild,
  onMismatch: DomMismatchHandler
): InsertBefore =>
  function safeInsertBefore(
    this: GuardedNode,
    node: GuardedNode,
    referenceNode: GuardedNode | null
  ) {
    if (referenceNode && referenceNode.parentNode !== this) {
      onMismatch("insertBefore");
      return originalAppendChild.call(this, node);
    }
    return originalInsertBefore.call(this, node, referenceNode);
  };

/**
 * Make React's DOM commits survive page translators.
 *
 * Chrome/Yandex Translate and similar extensions replace React-owned text
 * nodes with `<font>` wrappers. When React later removes or inserts relative
 * to such a node, the browser throws "Failed to execute 'removeChild' on
 * 'Node'" and the whole route falls into its error boundary (GIPITI-101,
 * facebook/react#11538). These calls would have thrown anyway, so skipping
 * them only trades a crashed page for possibly stale translated text.
 *
 * Patches `Node.prototype` once per page; a no-op outside the browser.
 */
export const installDomMutationGuard = (
  onMismatch: DomMismatchHandler
): void => {
  if (isInstalled || typeof Node === "undefined") {
    return;
  }
  isInstalled = true;

  const prototype = Node.prototype as unknown as {
    removeChild: RemoveChild;
    insertBefore: InsertBefore;
    appendChild: AppendChild;
  };
  const originalAppendChild = prototype.appendChild;

  prototype.removeChild = createSafeRemoveChild(
    prototype.removeChild,
    onMismatch
  );
  prototype.insertBefore = createSafeInsertBefore(
    prototype.insertBefore,
    originalAppendChild,
    onMismatch
  );
};
