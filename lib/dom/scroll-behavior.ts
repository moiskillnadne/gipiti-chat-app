/**
 * The scroll behaviour to use given the OS "reduce motion" setting: a smooth
 * scroll becomes an instant jump when the user asked for less motion.
 * `shouldReduceMotion` is framer-motion's `useReducedMotion()` value, which is
 * `null` until the preference is known.
 */
export const resolveScrollBehavior = (
  preferredBehavior: ScrollBehavior,
  shouldReduceMotion: boolean | null
): ScrollBehavior =>
  shouldReduceMotion && preferredBehavior === "smooth"
    ? "instant"
    : preferredBehavior;
