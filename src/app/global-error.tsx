"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7f8f6", color: "#0f172a", fontFamily: "Arial, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 520, margin: "15vh auto", padding: 32, textAlign: "center", background: "#fff", border: "1px solid #fecaca", borderRadius: 24 }}>
          <h1 style={{ fontSize: 24 }}>TripSplit is temporarily unavailable</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>We couldn&apos;t display this page. Please try again.</p>
          <button type="button" onClick={retry} style={{ marginTop: 16, padding: "12px 20px", border: 0, borderRadius: 12, background: "#065f46", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
