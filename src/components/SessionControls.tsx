"use client";

import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SessionControlsProps = {
  github: string | null | undefined;
  activeShiftId: string | null | undefined;
};

export default function SessionControls({
  github,
  activeShiftId,
}: SessionControlsProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function startShift() {
    setStarting(true);
    setError("");

    try {
      const response = await fetch("/api/shifts/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await response.json();

      if (response.status === 409 && data.activeShiftId) {
        router.push(`/shift/${data.activeShiftId}`);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Shift launch failed");
      }

      router.push(`/shift/${data.shift.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Shift launch failed");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="session-controls">
      {github ? (
        <>
          <div className="session-controls__identity">
            Signed in as <strong>{github}</strong>
          </div>
          <div className="session-controls__actions">
            {activeShiftId ? (
              <button
                type="button"
                className="madison-button"
                onClick={() => router.push(`/shift/${activeShiftId}`)}
              >
                Resume Shift
              </button>
            ) : (
              <button
                type="button"
                className="madison-button"
                disabled={starting}
                onClick={startShift}
              >
                {starting ? "Opening Exchange..." : "Start Shift"}
              </button>
            )}
            <button
              type="button"
              className="madison-button madison-button--secondary"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </button>
          </div>
        </>
      ) : (
        <div className="session-controls__actions">
          <button
            type="button"
            className="madison-button"
            onClick={() => signIn("github")}
          >
            Sign In With GitHub
          </button>
        </div>
      )}
      {error ? <p className="session-controls__error">{error}</p> : null}
    </div>
  );
}
