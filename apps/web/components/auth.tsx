"use client";
import { useState } from "react";
import {
  Layers3,
  ArrowRight,
  ShieldCheck,
  Package,
  FileCheck2,
} from "lucide-react";
import { Button } from "./ui";
import type { API } from "./forms";
export function AuthScreen({ api, done }: { api: API; done: () => void }) {
  const [mode, setMode] = useState("signin"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <div className="brand">
          <Layers3 />
          <span>
            MetalFlow <b>OS</b>
          </span>
        </div>
        <div>
          <span className="eyebrow">BUILT FOR THE WORK BEHIND THE WORK</span>
          <h1>
            From first inquiry.
            <br />
            To final delivery.
          </h1>
          <p>
            One connected workspace for metal supply, fabrication and interior
            projects.
          </p>
          <div className="auth-features">
            <span>
              <FileCheck2 />
              Clear quotations
            </span>
            <span>
              <Package />
              Confident inventory
            </span>
            <span>
              <ShieldCheck />
              Your company. Your data.
            </span>
          </div>
        </div>
        <small>The intelligent operating system for your business.</small>
      </section>
      <section className="auth-form">
        <div className="auth-inner">
          <span className="eyebrow">YOUR WORKSPACE STARTS HERE</span>
          <h2>
            {mode === "signup"
              ? "Create your account"
              : mode === "reset"
                ? "Reset your password"
                : "Welcome back"}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? "Set up your organization in a few simple steps."
              : "Sign in to keep your operations moving."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const form = new FormData(e.currentTarget),
                  email = String(form.get("email")),
                  password = String(form.get("password"));
                await api(
                  `auth/${mode === "signup" ? "sign-up/email" : mode === "reset" ? "request-password-reset" : "sign-in/email"}`,
                  "POST",
                  mode === "signup"
                    ? { name: String(form.get("name")), email, password }
                    : mode === "reset"
                      ? {
                          email,
                          redirectTo:
                            window.location.origin + "/metalflow?reset=1",
                        }
                      : { email, password },
                );
                if (mode === "reset")
                  setError(
                    "If email delivery is configured and the account exists, a reset link will be sent.",
                  );
                else done();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "signup" && (
              <label>
                Full name
                <input name="name" required autoComplete="name" />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder="At least 12 characters"
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button className="primary full mt" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="auth-switch">
            {mode === "signup"
              ? "Already have an account?"
              : "New to MetalFlow?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
              }}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
          {mode === "signin" && (
            <button className="text-button" onClick={() => setMode("reset")}>
              Forgot password?
            </button>
          )}
        </div>
        <small className="auth-footer">
          MetalFlow OS · Secure company workspaces
        </small>
      </section>
    </div>
  );
}
export function Onboarding({ api, done }: { api: API; done: () => void }) {
  const [error, setError] = useState("");
  return (
    <div className="onboarding">
      <div className="panel">
        <div className="brand">
          <Layers3 />
          MetalFlow OS
        </div>
        <h1>Make it your workspace.</h1>
        <p className="muted">
          Your company data stays separate from every other organization.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const f = new FormData(e.currentTarget);
              const org = await api(
                "organizations",
                "POST",
                Object.fromEntries(f),
              );
              localStorage.setItem("metalflow.org", org.id);
              done();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Company name
            <input name="name" required minLength={2} />
          </label>
          <label>
            Business type
            <select name="businessType">
              <option value="DISTRIBUTOR">
                Metal wholesaler / distributor
              </option>
              <option value="FABRICATOR">Fabrication workshop</option>
              <option value="CONTRACTOR">Renovation contractor</option>
              <option value="MIXED">Multiple business lines</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Currency
              <select name="currency">
                {[
                  "USD",
                  "CNY",
                  "EUR",
                  "GBP",
                  "SGD",
                  "MYR",
                  "AUD",
                  "CAD",
                  "HKD",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Country / region code
              <input
                name="country"
                minLength={2}
                maxLength={2}
                defaultValue="US"
                required
              />
            </label>
            <label>
              Language
              <select name="locale">
                <option value="en">English</option>
                <option value="zh">简体中文</option>
              </select>
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <Button className="primary full mt">
            Create workspace
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function InvitationScreen({
  api,
  token,
  done,
}: {
  api: API;
  token: string;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <section className="panel">
        <h1>Join your team.</h1>
        <p className="muted mt">
          Accept this invitation with the email address it was sent to.
        </p>
        <Button
          className="primary mt"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const member = await api("invitations/accept", "POST", { token });
              localStorage.setItem("metalflow.org", member.organizationId);
              history.replaceState(null, "", "/metalflow");
              done();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Accept invitation
        </Button>
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
export function ResetPasswordScreen({
  api,
  token,
  done,
}: {
  api: API;
  token: string;
  done: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="onboarding">
      <section className="panel">
        <h1>Choose a new password.</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const f = new FormData(e.currentTarget);
              await api("auth/reset-password", "POST", {
                token,
                newPassword: f.get("password"),
              });
              history.replaceState(null, "", "/metalflow");
              done();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              name="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <Button className="primary mt">Reset password</Button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </div>
  );
}
