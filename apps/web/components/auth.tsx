"use client";
import { useI18n } from "../lib/i18n";
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
  const { t, locale, setLocale } = useI18n();

  const [mode, setMode] = useState("signin"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <div className="brand">
          <Layers3 />
          <span>
            {" "}
            {t("MetalFlow")} <b>{t("OS")}</b>
          </span>
        </div>
        <div>
          <span className="eyebrow">
            {t("BUILT FOR THE WORK BEHIND THE WORK")}
          </span>
          <h1>
            {" "}
            {t("From first inquiry.")} <br /> {t("To final delivery.")}{" "}
          </h1>
          <p>
            {" "}
            {t(
              "One connected workspace for metal supply, fabrication and interior projects.",
            )}{" "}
          </p>
          <div className="auth-features">
            <span>
              <FileCheck2 /> {t("Clear quotations")}{" "}
            </span>
            <span>
              <Package /> {t("Confident inventory")}{" "}
            </span>
            <span>
              <ShieldCheck /> {t("Your company. Your data.")}{" "}
            </span>
          </div>
        </div>
        <small>
          {t("The intelligent operating system for your business.")}
        </small>
      </section>
      <section className="auth-form">
        <button
          className="auth-language btn"
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          aria-label={t("Change language")}
        >
          {locale === "en" ? "简体中文" : "English"}
        </button>
        <div className="auth-inner">
          <span className="eyebrow">{t("YOUR WORKSPACE STARTS HERE")}</span>
          <h2>
            {mode === "signup"
              ? t("Create your account")
              : mode === "reset"
                ? t("Reset your password")
                : t("Welcome back")}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? t("Set up your organization in a few simple steps.")
              : t("Sign in to keep your operations moving.")}
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
                {" "}
                {t("Full name")}{" "}
                <input name="name" required autoComplete="name" />
              </label>
            )}
            <label>
              {" "}
              {t("Email address")}{" "}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("you@company.com")}
              />
            </label>
            {mode !== "reset" && (
              <label>
                {" "}
                {t("Password")}{" "}
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder={t("At least 12 characters")}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            <Button className="primary full mt" disabled={busy}>
              {busy
                ? t("Please wait…")
                : mode === "signup"
                  ? t("Create account")
                  : mode === "reset"
                    ? t("Send reset link")
                    : t("Sign in")}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="auth-switch">
            {mode === "signup"
              ? t("Already have an account?")
              : t("New to MetalFlow?")}{" "}
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
              }}
            >
              {mode === "signup" ? t("Sign in") : t("Create an account")}
            </button>
          </p>
          {mode === "signin" && (
            <button className="text-button" onClick={() => setMode("reset")}>
              {" "}
              {t("Forgot password?")}{" "}
            </button>
          )}
        </div>
        <small className="auth-footer">
          {" "}
          {t("MetalFlow OS · Secure company workspaces")}{" "}
        </small>
      </section>
    </div>
  );
}
export function Onboarding({ api, done }: { api: API; done: () => void }) {
  const { t, locale, setLocale } = useI18n();

  const [error, setError] = useState("");
  return (
    <div className="onboarding">
      <div className="panel">
        <div className="brand">
          <Layers3 /> {t("MetalFlow OS")}{" "}
        </div>
        <h1>{t("Make it your workspace.")}</h1>
        <p className="muted">
          {" "}
          {t(
            "Your company data stays separate from every other organization.",
          )}{" "}
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
              setLocale(org.locale === "zh" ? "zh" : "en");
              done();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            {" "}
            {t("Company name")} <input name="name" required minLength={2} />
          </label>
          <label>
            {" "}
            {t("Business type")}{" "}
            <select name="businessType">
              <option value="DISTRIBUTOR">
                {" "}
                {t("Metal wholesaler / distributor")}{" "}
              </option>
              <option value="FABRICATOR">{t("Fabrication workshop")}</option>
              <option value="CONTRACTOR">{t("Renovation contractor")}</option>
              <option value="MIXED">{t("Multiple business lines")}</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              {" "}
              {t("Currency")}{" "}
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
              {" "}
              {t("Country / region code")}{" "}
              <input
                name="country"
                minLength={2}
                maxLength={2}
                defaultValue="US"
                required
              />
            </label>
            <label>
              {" "}
              {t("Language")}{" "}
              <select name="locale" defaultValue={locale}>
                <option value="en">{t("English")}</option>
                <option value="zh">简体中文</option>
              </select>
            </label>
          </div>
          {error && <p className="error">{t(error)}</p>}
          <Button className="primary full mt">
            {" "}
            {t("Create workspace")} <ArrowRight size={16} />
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
  const { t } = useI18n();

  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <section className="panel">
        <h1>{t("Join your team.")}</h1>
        <p className="muted mt">
          {" "}
          {t(
            "Accept this invitation with the email address it was sent to.",
          )}{" "}
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
          {" "}
          {t("Accept invitation")}{" "}
        </Button>
        {error && <p className="error">{t(error)}</p>}
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
  const { t } = useI18n();

  const [error, setError] = useState("");
  return (
    <div className="onboarding">
      <section className="panel">
        <h1>{t("Choose a new password.")}</h1>
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
            {" "}
            {t("New password")}{" "}
            <input
              type="password"
              name="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <Button className="primary mt">{t("Reset password")}</Button>
          {error && <p className="error">{t(error)}</p>}
        </form>
      </section>
    </div>
  );
}
