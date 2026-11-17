"use client";

import { useState } from "react";

export function BaselinePanel() {
  const [output, setOutput] = useState("");

  const run = async () => {
    const response = await fetch("/api/spike/config");
    setOutput(JSON.stringify(await response.json()));
  };

  return (
    <div>
      <button onClick={run} type="button">
        config
      </button>
      <pre>{output}</pre>
    </div>
  );
}
