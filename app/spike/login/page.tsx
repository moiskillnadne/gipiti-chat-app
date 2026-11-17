"use client";

// SPIKE S5 (GIPITI-231), not for main. What does `signIn` from
// `next-auth/react` resolve with for each outcome?
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SpikeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [results, setResults] = useState<string[]>([]);

  const submit = async () => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setResults((previous) => [...previous, JSON.stringify(result)]);
    } catch (error) {
      setResults((previous) => [...previous, `threw: ${String(error)}`]);
    }
  };

  return (
    <main>
      <input
        id="spike-email"
        onChange={(event) => setEmail(event.target.value)}
        value={email}
      />
      <input
        id="spike-password"
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <button id="spike-submit" onClick={submit} type="button">
        signIn
      </button>
      <pre id="spike-results">{results.join("\n")}</pre>
    </main>
  );
}
