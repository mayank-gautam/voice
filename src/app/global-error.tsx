"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40 }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666", fontSize: 14 }}>{error.message || "Unexpected error"}</p>
        <button type="button" onClick={() => reset()} style={{ marginTop: 16, padding: "8px 16px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
