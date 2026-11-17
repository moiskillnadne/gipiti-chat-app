// SPIKE S2 (GIPITI-231), not for main. The same page shape without oRPC, to
// measure what the contract and the link add to the browser bundle.
import { BaselinePanel } from "./baseline-client";

export const dynamic = "force-dynamic";

export default function SpikeBaselinePage() {
  return (
    <main>
      <h1>baseline</h1>
      <BaselinePanel />
    </main>
  );
}
