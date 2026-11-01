"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;

        if (data.session) {
          // Email confirmation is turned off in Supabase: user is signed in.
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap");

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #0b1020;
          color: #f4f5ff;
          font-family: "DM Sans", sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        .login-shell {
          display: grid;
          place-items: center;
          min-height: 100vh;
          padding: 20px;
          background:
            radial-gradient(
              ellipse at 10% 0%,
              rgba(99, 102, 241, 0.18),
              transparent 38%
            ),
            radial-gradient(
              ellipse at 95% 20%,
              rgba(168, 85, 247, 0.12),
              transparent 30%
            ),
            #0b1020;
        }

        .login-card {
          width: min(420px, 100%);
          padding: 32px 28px;
          border: 1px solid #ffffff20;
          border-radius: 22px;
          background: #171e32;
          box-shadow: 0 25px 100px #0008;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 26px;
        }

        .login-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          font-size: 25px;
        }

        .login-brand h1 {
          margin: 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 23px;
          letter-spacing: -1px;
        }

        .login-brand p {
          margin: 3px 0 0;
          color: #939bb8;
          font-size: 12px;
        }

        .login-tabs {
          display: flex;
          gap: 6px;
          padding: 5px;
          margin-bottom: 22px;
          border-radius: 13px;
          background: #11172a;
        }

        .login-tab {
          flex: 1;
          padding: 10px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #9ca5c2;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-tab.active {
          background: #272346;
          color: #c4b5fd;
        }

        .login-field {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
        }

        .login-field label {
          color: #d8def3;
          font-size: 12px;
          font-weight: 800;
        }

        .login-input {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #ffffff1a;
          border-radius: 11px;
          background: #0e1425;
          color: #f4f5ff;
          font-size: 14px;
        }

        .login-input:focus-visible,
        .login-tab:focus-visible,
        .login-submit:focus-visible {
          outline: 2px solid #a78bfa;
          outline-offset: 3px;
        }

        .login-submit {
          width: 100%;
          min-height: 45px;
          margin-top: 6px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .login-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-error,
        .login-message {
          padding: 11px 13px;
          margin-bottom: 16px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
        }

        .login-error {
          border: 1px solid #ef444444;
          background: #ef444414;
          color: #fca5a5;
        }

        .login-message {
          border: 1px solid #34d39944;
          background: #34d39914;
          color: #6ee7b7;
        }
      `}</style>

      <section className="login-card">
        <div className="login-brand">
          <div className="login-icon">⚔️</div>
          <div>
            <h1>Study Quest</h1>
            <p>Sign in to continue your adventure</p>
          </div>
        </div>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`login-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`login-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {message && <div className="login-message">{message}</div>}
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="login-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="login-input"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              placeholder="At least 6 characters"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}