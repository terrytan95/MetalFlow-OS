"use client";
import { AIProviderSettings } from "./ai-settings";
import { Importer } from "./importer";
import { palettes, type PaletteId } from "./themes";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Layers3,
  LayoutDashboard,
  Inbox,
  FileText,
  Users,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  Scissors,
  Hammer,
  Palette,
  Ruler,
  Briefcase,
  Receipt,
  CreditCard,
  ChartNoAxesCombined,
  Settings,
  Shield,
  Search,
  Plus,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  LogOut,
  CheckCircle2,
  Bell,
  Languages,
  Sparkles,
  Download,
} from "lucide-react";
import { config, groups, kinds, can, titleCase, type RecordData } from "./data";
import { Button, Modal, Badge, Empty } from "./ui";
import {
  AuthScreen,
  Onboarding,
  InvitationScreen,
  ResetPasswordScreen,
} from "./auth";
import { ResourceForm, DocumentForm, type API } from "./forms";
import { RecordsTable } from "./table";
import { Cutting, AIWorkspace, Takeoff } from "./operations";
const icons: Record<string, typeof Package> = {
  dashboard: LayoutDashboard,
  inquiries: Inbox,
  tasks: CheckCircle2,
  quotations: FileText,
  customers: Users,
  orders: ShoppingCart,
  products: Package,
  inventory: Package,
  warehouses: Warehouse,
  purchases: Truck,
  suppliers: Users,
  movements: ArrowUpRight,
  cutting: Scissors,
  fabrication: Hammer,
  design: Palette,
  takeoffs: Ruler,
  projects: Briefcase,
  invoices: Receipt,
  payments: CreditCard,
  expenses: Receipt,
  analytics: ChartNoAxesCombined,
  assistant: Sparkles,
  team: Shield,
  settings: Settings,
  audit: FileText,
};
export function Workspace() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 10000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Application />
    </QueryClientProvider>
  );
}
function Application() {
  const [view, setView] = useState("dashboard"),
    [organization, setOrganization] = useState(""),
    [locale, setLocale] = useState("en"),
    [theme, setTheme] = useState("light"),
    [colorPalette, setColorPalette] = useState<PaletteId>("foundry"),
    [preferencesLoaded, setPreferencesLoaded] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState<RecordData | undefined>(),
    [message, setMessage] = useState(""),
    [formError, setFormError] = useState(""),
    [palette, setPalette] = useState(""),
    [refreshKey, refresh] = useState(0),
    [range, setRange] = useState("30");
  const pendingMutations = useRef(new Map<string, string>());
  const [invitation, setInvitation] = useState(""),
    [resetToken, setResetToken] = useState("");
  const api: API = useCallback(
    async (route, method = "GET", body) => {
      const org = organization || localStorage.getItem("metalflow.org") || "";
      if (
        method === "POST" &&
        body &&
        !(body instanceof FormData) &&
        (route === "payments" ||
          route.endsWith("/receive") ||
          route.endsWith("/fulfill"))
      ) {
        const data = { ...(body as RecordData) };
        delete data.idempotencyKey;
        const key = org + route + JSON.stringify(data);
        if (!pendingMutations.current.has(key))
          pendingMutations.current.set(key, crypto.randomUUID());
        body = { ...data, idempotencyKey: pendingMutations.current.get(key) };
      }
      const headers: Record<string, string> = { "x-organization-id": org };
      if (body && !(body instanceof FormData))
        headers["Content-Type"] = "application/json";
      const res = await fetch(`/metalflow/api/v1/${route}`, {
        method,
        headers,
        credentials: "same-origin",
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Error(
          data.error?.message ||
            data.message ||
            `Request failed (${res.status})`,
        );
      }
      if (
        res.headers.get("content-type")?.includes("application/pdf") ||
        res.headers.get("content-type")?.startsWith("image/")
      )
        return res.blob();
      return res.json();
    },
    [organization],
  );
  const me = useQuery({
    queryKey: ["me", organization, refreshKey],
    queryFn: () => api("me"),
  });
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setInvitation(params.get("invitation") || "");
    setResetToken(params.get("reset") ? params.get("token") || "" : "");
    setOrganization(localStorage.getItem("metalflow.org") || "");
    setTheme(
      localStorage.getItem("metalflow.theme") === "dark" ? "dark" : "light",
    );
    const savedPalette = localStorage.getItem("metalflow.palette");
    if (palettes.some((p) => p.id === savedPalette))
      setColorPalette(savedPalette as PaletteId);
    setPreferencesLoaded(true);
    setLocale(localStorage.getItem("metalflow.locale") || "en");
    setCollapsed(localStorage.getItem("metalflow.collapsed") === "true");
    const route = location.hash.slice(1);
    if (groups.flatMap((g) => g.items).some((i) => i[0] === route))
      setView(route);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = colorPalette;
    localStorage.setItem("metalflow.palette", colorPalette);
    document.documentElement.lang = locale;
    localStorage.setItem("metalflow.theme", theme);
    localStorage.setItem("metalflow.locale", locale);
  }, [theme, locale, colorPalette, preferencesLoaded]);
  const membership =
    me.data?.memberships?.find((m: any) => m.organizationId === organization) ||
    me.data?.memberships?.[0];
  const org = membership?.organization,
    role = membership?.role || "VIEWER";
  useEffect(() => {
    if (membership && organization !== membership.organizationId) {
      setOrganization(membership.organizationId);
      localStorage.setItem("metalflow.org", membership.organizationId);
    }
  }, [membership, organization]);
  const navigate = useCallback((v: string) => {
    setView(v);
    location.hash = v;
    setSearch("");
    setPage(1);
    setMobile(false);
    setModal("");
    setSelected(undefined);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal("command");
      }
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    const hash = () => {
      const v = location.hash.slice(1);
      if (v) setView(v);
    };
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  const [board, setBoard] = useState(false);
  const done = () => {
    pendingMutations.current.clear();
    setModal("");
    setSelected(undefined);
    setMessage("Saved successfully");
    setFormError("");
    refresh((v) => v + 1);
  };
  const lookupsQuery = useQuery({
    queryKey: ["lookups", organization, refreshKey],
    enabled: !!org,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          ["customers", "products", "suppliers", "warehouses", "projects"].map(
            async (r) => [r, (await api(`${r}?limit=100`)).items],
          ),
        ),
      ),
  });
  const lookups: Record<string, RecordData[]> = lookupsQuery.data || {};
  const endpoint = kinds[view] ? `documents?kind=${kinds[view]}` : `${view}?`;
  const list = useQuery({
    queryKey: ["list", view, organization, page, search, refreshKey],
    enabled:
      !!org &&
      ![
        "dashboard",
        "analytics",
        "settings",
        "cutting",
        "team",
        "design",
        "assistant",
      ].includes(view),
    queryFn: () =>
      api(
        `${endpoint}${endpoint.endsWith("?") ? "" : "&"}page=${page}&search=${encodeURIComponent(search)}`,
      ),
  });
  const analytics = useQuery({
    queryKey: ["analytics", organization, range, refreshKey],
    enabled: !!org && (view === "dashboard" || view === "analytics"),
    queryFn: () =>
      api(
        `analytics?from=${new Date(Date.now() - Number(range) * 86400000).toISOString()}`,
      ),
  });
  const team = useQuery({
    queryKey: ["team", organization, refreshKey],
    enabled: !!org && view === "team",
    queryFn: () => api("team"),
  });
  const notifications = useQuery({
    queryKey: ["activity", organization, refreshKey],
    enabled: !!org && modal === "notifications",
    queryFn: () => api("activity"),
  });
  const jobs = useQuery({
    queryKey: ["jobs", organization, refreshKey],
    enabled: !!org && ["design", "assistant"].includes(view),
    queryFn: () => api("ai/jobs"),
    refetchInterval: 15000,
  });
  const globalSearch = useQuery({
    queryKey: ["global-search", organization, palette],
    enabled: !!org && modal === "command" && palette.length > 1,
    queryFn: async () => {
      const out = await Promise.all(
        ["customers", "products", "inquiries", "projects"].map(
          async (resource) => ({
            resource,
            items: (
              await api(
                `${resource}?search=${encodeURIComponent(palette)}&limit=5`,
              )
            ).items,
          }),
        ),
      );
      return out;
    },
  });
  if (resetToken)
    return (
      <ResetPasswordScreen
        api={api}
        token={resetToken}
        done={() => {
          setResetToken("");
          refresh((v) => v + 1);
        }}
      />
    );
  if (me.isPending)
    return (
      <div className="loading-screen">
        <Layers3 />
        <span>Opening MetalFlow OS…</span>
      </div>
    );
  if (!me.data)
    return <AuthScreen api={api} done={() => refresh((v) => v + 1)} />;
  if (invitation)
    return (
      <InvitationScreen
        api={api}
        token={invitation}
        done={() => {
          setInvitation("");
          refresh((v) => v + 1);
        }}
      />
    );
  if (!membership || modal === "organization")
    return <Onboarding api={api} done={() => refresh((v) => v + 1)} />;
  const allowed = (id: string) => {
    if (
      ["team", "settings", "audit"].includes(id) &&
      !can(role, "organization:manage")
    )
      return false;
    if (
      ["expenses", "payments", "analytics"].includes(id) &&
      !can(role, "finance:read")
    )
      return false;
    if (["purchases"].includes(id) && !can(role, "cost:read")) return false;
    const module =
      id === "design" || id === "assistant"
        ? "ai"
        : ["projects", "tasks", "change-orders"].includes(id)
          ? "projects"
          : ["purchases", "suppliers"].includes(id)
            ? "procurement"
            : ["cutting", "fabrication"].includes(id)
              ? "fabrication"
              : id === "takeoffs"
                ? "takeoff"
                : ["inventory", "products", "warehouses", "movements"].includes(
                      id,
                    )
                  ? "inventory"
                  : ["invoices", "payments", "expenses", "analytics"].includes(
                        id,
                      )
                    ? "finance"
                    : [
                          "customers",
                          "orders",
                          "quotations",
                          "inquiries",
                        ].includes(id)
                      ? "sales"
                      : null;
    return !module || org.modules.includes(module);
  };
  const title =
    groups.flatMap((g) => g.items).find((i) => i[0] === view)?.[
      locale === "zh" ? 2 : 1
    ] || view;
  const money = (value: any) =>
    new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: org.currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  const writePermission =
    config[view]?.permission ||
    (view === "purchases"
      ? "purchase:write"
      : view === "invoices" || view === "payments"
        ? "finance:write"
        : kinds[view]
          ? "sales:write"
          : view === "inventory"
            ? "inventory:write"
            : "organization:manage");
  const act = async (route: string, body: unknown) => {
    try {
      await api(route, "POST", body);
      done();
    } catch (e) {
      setFormError((e as Error).message);
    }
  };
  const exportCSV = () => {
    const items = list.data?.items || [];
    if (!items.length) return;
    const cols = Object.keys(items[0]).filter(
      (k) => !["organizationId", "createdBy", "path"].includes(k),
    );
    const safe = (v: any) => {
      let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv = [
      cols.join(","),
      ...items.map((r: any) => cols.map((k) => safe(r[k])).join(",")),
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    a.download = `metalflow-${view}-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div
      className={`app ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
    >
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("dashboard")}
          aria-label="MetalFlow home"
        >
          <Layers3 />
          <span>
            MetalFlow <b>OS</b>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">{org.name.slice(0, 1)}</span>
          <select
            aria-label="Select workspace"
            value={organization}
            onChange={(e) => {
              if (e.target.value === "new") setModal("organization");
              else {
                setOrganization(e.target.value);
                localStorage.setItem("metalflow.org", e.target.value);
              }
            }}
          >
            {me.data.memberships.map((m: any) => (
              <option value={m.organizationId} key={m.id}>
                {m.organization.name}
              </option>
            ))}
            <option value="new">+ Create workspace</option>
          </select>
        </div>
        <nav aria-label="Main navigation">
          {groups.map((g) => (
            <details key={g.label} open>
              <summary>
                {g.label}
                <ChevronDown size={11} />
              </summary>
              {g.items
                .filter(([id]) => allowed(id))
                .map(([id, en, zh]) => {
                  const Icon = icons[id] || Package;
                  return (
                    <button
                      key={id}
                      className={view === id ? "active" : ""}
                      onClick={() => {
                        setMobile(false);
                        navigate(id);
                      }}
                      title={locale === "zh" ? zh : en}
                      aria-current={view === id ? "page" : undefined}
                    >
                      <Icon size={17} />
                      <span>{locale === "zh" ? zh : en}</span>
                      {id === "inquiries" && !!analytics.data?.newInquiries && (
                        <b className="nav-count">
                          {analytics.data.newInquiries}
                        </b>
                      )}
                    </button>
                  );
                })}
            </details>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="user-avatar">{me.data.user.name.slice(0, 1)}</span>
          <div>
            <strong>{me.data.user.name}</strong>
            <small>{role.toLowerCase().replaceAll("_", " ")}</small>
          </div>
          <Button
            aria-label="Sign out"
            onClick={async () => {
              await api("auth/sign-out", "POST", {});
              localStorage.removeItem("metalflow.org");
              refresh((v) => v + 1);
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </aside>
      <div className="main-column">
        <header className="global-header">
          <div className="actions">
            <Button
              className="mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <Button
              className="desktop-only icon"
              aria-label="Collapse sidebar"
              onClick={() => {
                setCollapsed(!collapsed);
                localStorage.setItem("metalflow.collapsed", String(!collapsed));
              }}
            >
              <Menu size={18} />
            </Button>
            <span className="header-breadcrumb">
              Workspace <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="header-tools">
            <button
              className="global-search"
              id="global-search"
              onClick={() => setModal("command")}
            >
              <Search size={15} />
              <span>{locale === "zh" ? "搜索工作区" : "Search workspace"}</span>
              <kbd>⌘ K</kbd>
            </button>
            <Button
              className="icon"
              aria-label="Change language"
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            >
              <Languages size={17} />
            </Button>
            <Button
              className="icon"
              aria-label="Color themes"
              title={locale === "zh" ? "配色主题" : "Color themes"}
              onClick={() => setModal("appearance")}
            >
              <Palette size={17} />
            </Button>
            <Button
              className="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </Button>
            <Button
              className="icon"
              aria-label="Activity notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={17} />
            </Button>
            {can(role, "sales:write") && (
              <Button
                className="primary quick-create"
                onClick={() => {
                  navigate("inquiries");
                  setModal("create");
                }}
              >
                <Plus size={16} />
                <span>Quick create</span>
              </Button>
            )}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? "YOUR BUSINESS, IN FOCUS"
                  : "METALFLOW WORKSPACE"}
              </div>
              <h1>
                {view === "dashboard"
                  ? locale === "zh"
                    ? "经营概览"
                    : "Operations overview"
                  : title}
              </h1>
              <p>
                {view === "dashboard"
                  ? locale === "zh"
                    ? "每一个询价、订单和项目，尽在掌握。"
                    : "Every inquiry, order and project. Moving together."
                  : config[view]?.description ||
                    "Connected records. Clear decisions. Full traceability."}
              </p>
            </div>
            <div className="actions">
              {["dashboard", "analytics"].includes(view) ? (
                <select
                  aria-label="Date range"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="1">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              ) : ![
                  "settings",
                  "cutting",
                  "design",
                  "assistant",
                  "takeoffs",
                  "audit",
                  "movements",
                ].includes(view) && can(role, writePermission) ? (
                <Button
                  className="primary"
                  onClick={() => {
                    setSelected(undefined);
                    setFormError("");
                    setModal("create");
                  }}
                >
                  <Plus size={16} />
                  {view === "team"
                    ? "Invite member"
                    : view === "inventory"
                      ? "Adjust stock"
                      : view === "payments"
                        ? "Record payment"
                        : "Create new"}
                </Button>
              ) : null}
            </div>
          </div>
          {message && (
            <div role="status" className="toast">
              <CheckCircle2 size={16} />
              {message}
              <button aria-label="Dismiss" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {!allowed(view) ? (
            <div className="notice">
              This module is disabled or your role does not have permission to
              view it.
            </div>
          ) : ["dashboard", "analytics"].includes(view) ? (
            <>
              {analytics.isError ? (
                <p className="error">{analytics.error.message}</p>
              ) : analytics.isPending ? (
                <div className="skeleton-grid">
                  {[1, 2, 3, 4].map((n) => (
                    <div className="skeleton" key={n} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="metrics">
                    {[
                      [
                        locale === "zh" ? "销售收入" : "Revenue",
                        analytics.data.revenue === undefined
                          ? "Restricted"
                          : money(analytics.data.revenue),
                        "Issued invoices, excluding tax",
                        Receipt,
                      ],
                      [
                        locale === "zh" ? "待收款" : "Receivables",
                        analytics.data.receivables === undefined
                          ? "Restricted"
                          : money(analytics.data.receivables),
                        "All outstanding issued invoices",
                        CreditCard,
                      ],
                      [
                        locale === "zh" ? "有效报价" : "Open quotations",
                        analytics.data.openQuotations,
                        "Drafts through accepted quotes",
                        FileText,
                      ],
                      [
                        locale === "zh" ? "待交付订单" : "Pending orders",
                        analytics.data.pendingOrders,
                        "Orders not fulfilled or cancelled",
                        Package,
                      ],
                    ].map(([label, value, note, Icon]: any) => (
                      <article className="metric" key={label}>
                        <div>
                          <span>{label}</span>
                          <Icon size={17} />
                        </div>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </article>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel revenue-panel">
                      <div className="panel-title">
                        <div>
                          <h2>Revenue overview</h2>
                          <p>
                            Issued invoice value · {org.currency} · excluding
                            tax
                          </p>
                        </div>
                        <Badge value="DATABASE" />
                      </div>
                      {analytics.data.trend?.length ? (
                        <div className="chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.data.trend}>
                              <CartesianGrid
                                vertical={false}
                                stroke="var(--border)"
                              />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(v) => v.slice(5)}
                                tick={{ fontSize: 11 }}
                                axisLine={false}
                              />
                              <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                              <Tooltip />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="var(--accent)"
                                fill="var(--soft)"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <Empty
                          title="Your revenue story starts here"
                          description="Issue an invoice to see real revenue in this chart."
                        />
                      )}
                    </section>
                    <section className="panel attention">
                      <div className="panel-title">
                        <h2>Needs attention</h2>
                        <span className="live-dot" />
                      </div>
                      {[
                        [
                          `${analytics.data.newInquiries} inquiries to review`,
                          "Turn requirements into a quotation",
                          "inquiries",
                          Inbox,
                        ],
                        [
                          `${analytics.data.pendingOrders} orders in progress`,
                          "Check stock and fulfillment",
                          "orders",
                          Package,
                        ],
                        [
                          `${analytics.data.activeProjects} active projects`,
                          "Keep milestones moving",
                          "projects",
                          Briefcase,
                        ],
                      ].map(([a, b, v, Icon]: any) => (
                        <button
                          className="attention-row"
                          key={v}
                          onClick={() => navigate(v)}
                        >
                          <span className="attention-icon">
                            <Icon size={18} />
                          </span>
                          <div>
                            <strong>{a}</strong>
                            <small>{b}</small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                      <div className="workflow-note">
                        <span className="eyebrow">ONE CONNECTED WORKFLOW</span>
                        <p>Inquiry → Quote → Order → Invoice</p>
                        <small>
                          Commercial history stays linked at every step.
                        </small>
                      </div>
                    </section>
                    {view === "analytics" && analytics.data.salesByCustomer && (
                      <section className="panel span-2">
                        <div className="panel-title">
                          <h2>Commercial performance</h2>
                          <Badge
                            value={
                              analytics.data.costComplete
                                ? "COST_SNAPSHOTS"
                                : "INCOMPLETE_COSTS"
                            }
                          />
                        </div>
                        <div className="mini-metrics">
                          <div>
                            <small>Gross profit · quoted catalog cost</small>
                            <strong>
                              {analytics.data.grossProfit === null
                                ? "Unavailable"
                                : money(analytics.data.grossProfit)}
                            </strong>
                          </div>
                          <div>
                            <small>Inventory value · current unit cost</small>
                            <strong>
                              {money(analytics.data.inventoryValuation)}
                            </strong>
                          </div>
                          <div>
                            <small>Low-stock products</small>
                            <strong>
                              {analytics.data.lowStock?.length || 0}
                            </strong>
                          </div>
                        </div>
                        <div className="form-grid">
                          <section>
                            <h3>Sales by customer</h3>
                            {analytics.data.salesByCustomer.map(
                              (r: RecordData) => (
                                <div key={r.id} className="snapshot-row">
                                  <span>{r.name}</span>
                                  <strong>{money(r.revenue)}</strong>
                                </div>
                              ),
                            )}
                          </section>
                          <section>
                            <h3>Sales by product · before document discount</h3>
                            {analytics.data.salesByProduct.map(
                              (r: RecordData) => (
                                <div key={r.id} className="snapshot-row">
                                  <span>{r.name}</span>
                                  <strong>{money(r.revenue)}</strong>
                                </div>
                              ),
                            )}
                          </section>
                        </div>
                        <h3 className="section-title">
                          Project budget tracking
                        </h3>
                        {analytics.data.projectBudgets.map((r: RecordData) => (
                          <div key={r.id} className="snapshot-row">
                            <span>{r.name}</span>
                            <strong>
                              {money(r.expenses)} spent / {money(r.budget)}{" "}
                              budget
                            </strong>
                          </div>
                        ))}
                        <p className="notice">
                          Gross profit uses catalog cost snapshots at quotation
                          creation. Custom lines without costs make gross profit
                          unavailable. Inventory valuation uses current catalog
                          cost; it is not an audited accounting valuation.
                        </p>
                      </section>
                    )}
                    <section className="panel activity">
                      <div className="panel-title">
                        <h2>Recent activity</h2>
                        <Button
                          onClick={() =>
                            navigate(
                              can(role, "organization:manage")
                                ? "audit"
                                : "inquiries",
                            )
                          }
                        >
                          View records
                          <ArrowUpRight size={14} />
                        </Button>
                      </div>
                      {analytics.data.activity.length ? (
                        analytics.data.activity.map((a: any) => (
                          <div className="activity-row" key={a.id}>
                            <span className="timeline-dot" />
                            <div>
                              <strong>
                                {titleCase(a.action.replaceAll(".", " "))}
                              </strong>
                              <small>Record {a.entityId.slice(0, 8)}</small>
                            </div>
                            <time>
                              {new Date(a.createdAt).toLocaleString(locale)}
                            </time>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title="A fresh workspace"
                          description="Your team's activity will appear here as you work."
                        />
                      )}
                    </section>
                    <section className="panel">
                      <h2>Workspace snapshot</h2>
                      <div className="snapshot-row">
                        <span>Stock positions</span>
                        <strong>{analytics.data.stockLines}</strong>
                      </div>
                      <div className="snapshot-row">
                        <span>Quote conversion</span>
                        <strong>
                          {analytics.data.conversionRate.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="snapshot-row">
                        <span>Active projects</span>
                        <strong>{analytics.data.activeProjects}</strong>
                      </div>
                      <div className="snapshot-row">
                        <span>Base currency</span>
                        <strong>{org.currency}</strong>
                      </div>
                      {analytics.data.aging?.map((a: any) => (
                        <div className="snapshot-row" key={a.label}>
                          <span>Receivables · {a.label} days</span>
                          <strong>{money(a.amount)}</strong>
                        </div>
                      ))}
                    </section>
                  </div>
                </>
              )}
            </>
          ) : view === "cutting" ? (
            <Cutting api={api} />
          ) : ["design", "assistant"].includes(view) ? (
            <AIWorkspace
              api={api}
              mode={view}
              enabled={
                view === "design"
                  ? me.data.capabilities.image
                  : me.data.capabilities.ai
              }
              jobs={jobs.data?.items || []}
              refresh={() => refresh((v) => v + 1)}
            />
          ) : view === "takeoffs" ? (
            <Takeoff
              api={api}
              items={list.data?.items || []}
              refresh={() => refresh((v) => v + 1)}
            />
          ) : view === "settings" ? (
            <section className="panel settings-panel">
              <h2>Organization settings</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const f = new FormData(e.currentTarget);
                    await api("settings", "PATCH", {
                      name: f.get("name"),
                      locale: f.get("locale"),
                      modules: f.getAll("modules"),
                    });
                    done();
                  } catch (e) {
                    setFormError((e as Error).message);
                  }
                }}
              >
                <div className="form-grid">
                  <label>
                    Company name
                    <input name="name" defaultValue={org.name} required />
                  </label>
                  <label>
                    Default language
                    <select name="locale" defaultValue={org.locale}>
                      <option value="en">English</option>
                      <option value="zh">简体中文</option>
                    </select>
                  </label>
                </div>
                <h3>Enabled modules</h3>
                <div className="module-checkboxes">
                  {[
                    "sales",
                    "inventory",
                    "procurement",
                    "projects",
                    "finance",
                    "fabrication",
                    "ai",
                    "takeoff",
                  ].map((m) => (
                    <label key={m}>
                      <input
                        type="checkbox"
                        name="modules"
                        value={m}
                        defaultChecked={org.modules.includes(m)}
                      />
                      {titleCase(m)}
                    </label>
                  ))}
                </div>
                <Button className="primary mt">Save settings</Button>
              </form>
              <AIProviderSettings
                api={api}
                organizationId={organization}
                onChanged={() => refresh((v) => v + 1)}
              />
              <div className="record-row">
                <span>Email delivery</span>
                <Badge
                  value={
                    me.data.capabilities.email
                      ? "CONFIGURED"
                      : "CONFIGURATION_REQUIRED"
                  }
                />
              </div>
              <p className="notice">
                Email verification and password reset delivery require SMTP
                configured by the server operator.
              </p>
              {formError && <p className="error">{formError}</p>}
            </section>
          ) : view === "team" ? (
            <section className="panel">
              <h2>Workspace members</h2>
              {team.isError ? (
                <p className="error">{team.error.message}</p>
              ) : (
                (team.data || []).map((m: any) => (
                  <div className="record-row" key={m.id}>
                    <div>
                      <strong>{m.user.name}</strong>
                      <small>{m.user.email}</small>
                    </div>
                    <select
                      aria-label={`Role for ${m.user.name}`}
                      value={m.role}
                      disabled={
                        m.role === "OWNER" || m.user.id === me.data.user.id
                      }
                      onChange={async (e) => {
                        try {
                          await api(`team/${m.id}`, "PATCH", {
                            role: e.target.value,
                          });
                          done();
                        } catch (e) {
                          setFormError((e as Error).message);
                        }
                      }}
                    >
                      {Object.keys({ OWNER: 1, ...config }).length > 0 &&
                        [
                          "OWNER",
                          "ADMIN",
                          "SALES_MANAGER",
                          "SALES_REP",
                          "WAREHOUSE_MANAGER",
                          "PROCUREMENT_MANAGER",
                          "FABRICATION_OPERATOR",
                          "PROJECT_MANAGER",
                          "ACCOUNTANT",
                          "VIEWER",
                        ].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                ))
              )}
              <p className="notice">
                Roles are enforced by the API. Owners retain organization
                control. Custom role definitions are not yet available.
              </p>
              {formError && <p className="error">{formError}</p>}
            </section>
          ) : (
            <section className="panel data-panel">
              <div className="filter-bar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search records"
                    placeholder={
                      locale === "zh" ? "搜索记录…" : "Search records…"
                    }
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="actions">
                  {["customers", "products", "inventory"].includes(view) &&
                    can(role, writePermission) && (
                      <Button onClick={() => setModal("import")}>
                        Import CSV
                      </Button>
                    )}
                  {["projects", "tasks"].includes(view) && (
                    <Button onClick={() => setBoard(!board)}>
                      {board ? "Table view" : "Board view"}
                    </Button>
                  )}
                  {view === "inventory" && can(role, "inventory:write") && (
                    <Button
                      onClick={() => {
                        setFormError("");
                        setModal("transfer");
                      }}
                    >
                      Transfer stock
                    </Button>
                  )}
                  <span className="result-count">
                    {list.data?.total || 0} records
                  </span>
                  <Button
                    onClick={exportCSV}
                    disabled={!list.data?.items?.length}
                  >
                    <Download size={15} />
                    Export page
                  </Button>
                </div>
              </div>
              {list.isPending ? (
                <div className="skeleton table-skeleton" />
              ) : list.isError ? (
                <div className="error" role="alert">
                  {list.error.message}
                  <Button onClick={() => list.refetch()}>Retry</Button>
                </div>
              ) : board && ["projects", "tasks"].includes(view) ? (
                <div className="kanban">
                  {(view === "projects"
                    ? ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]
                    : ["TODO", "IN_PROGRESS", "DONE"]
                  ).map((status) => (
                    <section key={status}>
                      <h3>{titleCase(status)}</h3>
                      {list.data?.items
                        ?.filter((r: RecordData) => r.status === status)
                        .map((r: RecordData) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelected(r);
                              setModal("detail");
                            }}
                          >
                            <strong>{r.name}</strong>
                            <small>
                              {r.dueDate
                                ? new Date(r.dueDate).toLocaleDateString()
                                : "No due date"}
                            </small>
                            {r.budget && <span>{money(r.budget)}</span>}
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <RecordsTable
                  items={list.data?.items || []}
                  columns={
                    config[view]?.columns ||
                    (kinds[view]
                      ? [
                          "number",
                          "customerId",
                          "status",
                          "currency",
                          "total",
                          "createdAt",
                        ]
                      : view === "inventory"
                        ? [
                            "product",
                            "warehouse",
                            "onHand",
                            "reserved",
                            "available",
                          ]
                        : view === "movements"
                          ? [
                              "kind",
                              "productId",
                              "quantity",
                              "reference",
                              "createdAt",
                            ]
                          : view === "payments"
                            ? ["reference", "amount", "method", "createdAt"]
                            : ["action", "entityId", "createdAt"])
                  }
                  lookups={lookups}
                  onSelect={
                    config[view] || kinds[view]
                      ? (r) => {
                          setSelected(r);
                          setFormError("");
                          setModal("detail");
                        }
                      : undefined
                  }
                />
              )}
              <div className="pagination">
                <span>Page {page} · Up to 25 records per page</span>
                <div className="actions">
                  <Button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <Button
                    disabled={page * 25 >= (list.data?.total || 0)}
                    onClick={() => setPage(page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            </section>
          )}
          <footer className="app-footer">
            <span>MetalFlow OS</span>
            <span>
              {org.name} · {org.currency} · Tenant workspace
            </span>
          </footer>
        </main>
      </div>
      <Modal
        open={modal === "import"}
        onClose={() => setModal("")}
        title={`Import ${title.toLowerCase()}`}
      >
        <Importer
          resource={view}
          warehouses={lookups.warehouses || []}
          api={api}
          done={done}
        />
      </Modal>
      <Modal
        open={modal === "appearance"}
        onClose={() => setModal("")}
        title={
          locale === "zh" ? "外观与莫兰迪配色" : "Appearance & Morandi palettes"
        }
        wide
      >
        <p className="muted">
          {locale === "zh"
            ? "低饱和色彩，清晰的数据层次。配色与明暗模式可独立选择。"
            : "Muted colors, clear information. Choose a palette and light or dark mode independently."}
        </p>
        <div className="appearance-mode mt">
          <Button
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
          >
            <Sun size={16} />
            {locale === "zh" ? "浅色" : "Light"}
          </Button>
          <Button
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
          >
            <Moon size={16} />
            {locale === "zh" ? "深色" : "Dark"}
          </Button>
        </div>
        <fieldset className="theme-options" aria-label="Color palette">
          {palettes.map((p) => (
            <label className="theme-option" key={p.id}>
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={colorPalette === p.id}
                onChange={() => setColorPalette(p.id)}
                aria-label={p.en}
              />
              <span className="palette-swatches" aria-hidden="true">
                {p.colors.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span>
                <strong>{locale === "zh" ? p.zh : p.en}</strong>
                <small>{locale === "zh" ? p.en : p.zh}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="theme-example">
          <strong>
            {locale === "zh" ? "工作区预览" : "Workspace preview"}
          </strong>
          <p>
            {locale === "zh"
              ? "主题将应用于所有模块，并在此浏览器自动保存。"
              : "Applies across every module and saves automatically in this browser."}
          </p>
          <div className="actions">
            <Button className="primary" onClick={() => setModal("")}>
              {locale === "zh" ? "完成" : "Done"}
            </Button>
            <Badge value="APPROVED" />
            <span className="muted">INV-2026 · {money("1240")}</span>
          </div>
        </div>
      </Modal>
      <Modal
        open={modal === "command"}
        onClose={() => setModal("")}
        title="Find anything in your workspace"
      >
        <div className="command-input">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Search pages, customers, products, inquiries…"
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results">
          {groups
            .flatMap((g) => g.items)
            .filter(
              ([id, en, zh]) =>
                allowed(id) &&
                (en + zh).toLowerCase().includes(palette.toLowerCase()),
            )
            .map(([id, en, zh]) => (
              <button key={id} onClick={() => navigate(id)}>
                {locale === "zh" ? zh : en}
                <ArrowUpRight size={15} />
              </button>
            ))}
          {globalSearch.data?.flatMap((group) =>
            group.items.map((r: any) => (
              <button
                key={r.id}
                onClick={() => {
                  navigate(group.resource);
                  setSelected(r);
                  setModal("detail");
                }}
              >
                {r.name || r.subject}
                <small>{group.resource}</small>
              </button>
            )),
          )}
        </div>
      </Modal>
      <Modal
        open={modal === "notifications"}
        onClose={() => setModal("")}
        title="Activity notifications"
      >
        {notifications.isPending ? (
          <p className="muted">Loading activity…</p>
        ) : notifications.isError ? (
          <p className="error">{notifications.error.message}</p>
        ) : notifications.data?.length ? (
          notifications.data.map((item: RecordData) => (
            <div key={item.id} className="activity-row">
              <span className="timeline-dot" />
              <div>
                <strong>{titleCase(item.action.replaceAll(".", " "))}</strong>
                <small>{item.entityId.slice(0, 8)}</small>
              </div>
              <time>{new Date(item.createdAt).toLocaleString(locale)}</time>
            </div>
          ))
        ) : (
          <Empty
            title="No activity yet"
            description="Workspace actions will appear here."
          />
        )}
      </Modal>
      <Modal
        open={modal === "create"}
        onClose={() => setModal("")}
        title={
          view === "team" ? "Invite a teammate" : `New ${title.toLowerCase()}`
        }
        wide={!!kinds[view]}
      >
        {config[view] ? (
          <ResourceForm
            showCost={can(role, "cost:read")}
            resource={view}
            lookups={lookups}
            api={api}
            done={done}
          />
        ) : kinds[view] ? (
          <DocumentForm
            view={view}
            source={selected?.subject ? selected : undefined}
            lookups={lookups}
            api={api}
            done={done}
          />
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                if (view === "team") {
                  const result = await api(
                    "invitations",
                    "POST",
                    Object.fromEntries(f),
                  );
                  setMessage(`Invitation link: ${result.url}`);
                  setModal("");
                } else if (view === "inventory")
                  await act("inventory/adjust", Object.fromEntries(f));
                else if (view === "payments")
                  await act("payments", {
                    ...Object.fromEntries(f),
                    idempotencyKey: crypto.randomUUID(),
                  });
              } catch (e) {
                setFormError((e as Error).message);
              }
            }}
          >
            {view === "team" ? (
              <>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Role
                  <select name="role">
                    {[
                      "ADMIN",
                      "SALES_MANAGER",
                      "SALES_REP",
                      "WAREHOUSE_MANAGER",
                      "PROCUREMENT_MANAGER",
                      "FABRICATION_OPERATOR",
                      "PROJECT_MANAGER",
                      "ACCOUNTANT",
                      "VIEWER",
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : view === "inventory" ? (
              <>
                <label>
                  Product
                  <select name="productId" required>
                    {lookups.products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Warehouse
                  <select name="warehouseId" required>
                    {lookups.warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity change
                  <input name="quantity" type="number" step="0.0001" required />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={5} required />
                </label>
              </>
            ) : (
              <>
                <label>
                  Issued invoice ID
                  <input name="invoiceId" required />
                </label>
                <label>
                  Amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Reference
                  <input name="reference" required />
                </label>
                <label>
                  Method
                  <select name="method">
                    {["BANK", "CASH", "CARD", "OTHER"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError && <p className="error">{formError}</p>}
            <Button className="primary mt">
              {view === "team" ? "Create invitation link" : "Save"}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={modal === "edit-document"}
        onClose={() => setModal("")}
        title="Revise draft"
        wide
      >
        {selected && (
          <DocumentForm
            view={view}
            record={selected}
            lookups={lookups}
            api={api}
            done={done}
          />
        )}
      </Modal>
      <Modal
        open={modal === "transfer"}
        onClose={() => setModal("")}
        title="Transfer stock"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act("inventory/transfer", {
              ...Object.fromEntries(f),
              idempotencyKey: crypto.randomUUID(),
            });
          }}
        >
          <label>
            Product
            <select name="productId" required>
              {lookups.products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </label>
          {["fromWarehouseId", "toWarehouseId"].map((key, i) => (
            <label key={key}>
              {i ? "Destination warehouse" : "Source warehouse"}
              <select name={key} required>
                {lookups.warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              required
            />
          </label>
          <label>
            Reason
            <input name="reason" minLength={5} required />
          </label>
          {formError && <p className="error">{formError}</p>}
          <Button className="primary mt">Confirm transfer</Button>
        </form>
      </Modal>
      <Modal
        open={modal === "detail"}
        onClose={() => setModal("")}
        title={
          selected?.number ||
          selected?.name ||
          selected?.subject ||
          "Record details"
        }
        wide
      >
        {modal === "detail" &&
          selected &&
          (kinds[view] ? (
            <>
              <div className="detail-heading">
                <Badge value={selected.status} />
                <strong>{money(selected.total)}</strong>
                <small>
                  Version {selected.version} · {selected.currency}
                </small>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l: any, i: number) => (
                      <tr key={i}>
                        <td>{l.description}</td>
                        <td>
                          {l.quantity} {l.unit}
                        </td>
                        <td>{l.unitPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">{selected.notes}</p>
              <div className="actions wrap">
                {selected.status === "DRAFT" &&
                  !selected.sourceId &&
                  can(role, writePermission) && (
                    <Button onClick={() => setModal("edit-document")}>
                      Edit draft
                    </Button>
                  )}

                {can(role, writePermission) &&
                  (
                    {
                      DRAFT: ["PENDING_APPROVAL"],
                      PENDING_APPROVAL: ["APPROVED", "REJECTED"],
                      APPROVED: ["SENT"],
                      SENT: ["ACCEPTED", "REJECTED"],
                    } as Record<string, string[]>
                  )[selected.status]
                    ?.filter(
                      (s) =>
                        selected.kind === "QUOTATION" ||
                        (selected.kind === "PURCHASE" && s !== "ACCEPTED"),
                    )
                    .filter(
                      (s) =>
                        s !== "APPROVED" ||
                        can(
                          role,
                          selected.kind === "PURCHASE"
                            ? "purchase:approve"
                            : "sales:approve",
                        ),
                    )
                    .map((s) => (
                      <Button
                        key={s}
                        onClick={() =>
                          act(`documents/${selected.id}/status`, { status: s })
                        }
                      >
                        {titleCase(s)}
                      </Button>
                    ))}
                {selected.kind === "ORDER" &&
                  selected.status === "DRAFT" &&
                  can(role, "sales:write") && (
                    <Button
                      className="primary"
                      onClick={() =>
                        act(`documents/${selected.id}/status`, {
                          status: "CONFIRMED",
                        })
                      }
                    >
                      Confirm order
                    </Button>
                  )}
                {selected.kind === "INVOICE" &&
                  selected.status === "DRAFT" &&
                  can(role, "finance:write") && (
                    <Button
                      className="primary"
                      onClick={() =>
                        act(`documents/${selected.id}/status`, {
                          status: "ISSUED",
                        })
                      }
                    >
                      Issue invoice
                    </Button>
                  )}
                {selected.kind === "QUOTATION" &&
                  selected.status === "ACCEPTED" &&
                  can(role, "sales:write") && (
                    <Button
                      className="primary"
                      onClick={() =>
                        act(`documents/${selected.id}/convert`, {
                          kind: "ORDER",
                        })
                      }
                    >
                      Convert to sales order
                    </Button>
                  )}
                {selected.kind === "ORDER" &&
                  [
                    "CONFIRMED",
                    "RESERVED",
                    "PROCESSING",
                    "FULFILLED",
                    "PARTIALLY_FULFILLED",
                  ].includes(selected.status) &&
                  can(role, "finance:write") && (
                    <Button
                      onClick={() =>
                        act(`documents/${selected.id}/convert`, {
                          kind: "INVOICE",
                        })
                      }
                    >
                      Create invoice
                    </Button>
                  )}
                {selected.kind === "QUOTATION" && can(role, "sales:write") && (
                  <Button
                    onClick={() =>
                      act(`documents/${selected.id}/duplicate`, {})
                    }
                  >
                    Duplicate
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    try {
                      const blob = await api(`documents/${selected.id}/pdf`);
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${selected.number}.pdf`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    } catch (e) {
                      setFormError((e as Error).message);
                    }
                  }}
                >
                  <Download size={15} />
                  Download PDF
                </Button>
              </div>
              {((selected.kind === "ORDER" &&
                [
                  "CONFIRMED",
                  "RESERVED",
                  "PROCESSING",
                  "PARTIALLY_FULFILLED",
                ].includes(selected.status) &&
                can(role, "inventory:write")) ||
                (selected.kind === "PURCHASE" &&
                  ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(
                    selected.status,
                  ) &&
                  can(role, "purchase:write"))) && (
                <form
                  className="inline-operation"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget),
                      warehouseId = String(f.get("warehouseId"));
                    if (
                      selected.kind === "ORDER" &&
                      selected.status === "CONFIRMED"
                    )
                      await act(`orders/${selected.id}/reserve`, {
                        warehouseId,
                      });
                    else {
                      const lines = selected.lines
                        .filter((l: any) => l.productId)
                        .map((l: any, i: number) => ({
                          productId: l.productId,
                          quantity: String(f.get(`qty${i}`)),
                        }))
                        .filter((l: any) => Number(l.quantity) > 0);
                      await act(
                        `${selected.kind === "ORDER" ? "orders" : "purchases"}/${selected.id}/${selected.kind === "ORDER" ? "fulfill" : "receive"}`,
                        {
                          warehouseId,
                          lines,
                          idempotencyKey: crypto.randomUUID(),
                        },
                      );
                    }
                  }}
                >
                  <h3>
                    {selected.kind === "PURCHASE"
                      ? "Receive materials"
                      : selected.status === "CONFIRMED"
                        ? "Reserve stock"
                        : "Fulfill order"}
                  </h3>
                  <label>
                    Warehouse
                    <select name="warehouseId">
                      {lookups.warehouses?.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected.status !== "CONFIRMED" &&
                    selected.lines
                      .filter((l: any) => l.productId)
                      .map((l: any, i: number) => (
                        <label key={i}>
                          {l.description} · quantity
                          <input
                            type="number"
                            name={`qty${i}`}
                            defaultValue={l.quantity}
                            min="0"
                            step="0.0001"
                          />
                        </label>
                      ))}
                  <Button className="primary mt">
                    Confirm stock operation
                  </Button>
                </form>
              )}
              {selected.kind === "INVOICE" &&
                ["ISSUED", "PARTIALLY_PAID"].includes(selected.status) &&
                can(role, "finance:write") && (
                  <form
                    className="inline-operation"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      act("payments", {
                        invoiceId: selected.id,
                        amount: f.get("amount"),
                        reference: f.get("reference"),
                        method: "BANK",
                        idempotencyKey: crypto.randomUUID(),
                      });
                    }}
                  >
                    <h3>Record payment</h3>
                    <p>Paid: {money(selected.paid)}</p>
                    <label>
                      Amount
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                      />
                    </label>
                    <label>
                      Bank reference
                      <input name="reference" required />
                    </label>
                    <Button className="primary mt">Confirm payment</Button>
                  </form>
                )}
              {formError && <p className="error">{formError}</p>}
            </>
          ) : (
            <>
              {view === "change-orders" &&
                selected.status === "DRAFT" &&
                can(role, "projects:write") && (
                  <Button
                    className="primary"
                    onClick={() =>
                      act(`change-orders/${selected.id}/approve`, {})
                    }
                  >
                    Approve budget change
                  </Button>
                )}
              {view === "inquiries" && (
                <>
                  <div className="source-text">{selected.text}</div>
                  {selected.extraction && (
                    <div className="notice">
                      <strong>Human review required</strong>
                      <pre>{JSON.stringify(selected.extraction, null, 2)}</pre>
                      <Button
                        onClick={async () => {
                          await api(`inquiries/${selected.id}`, "PATCH", {
                            reviewed: true,
                            status: "READY_TO_QUOTE",
                          });
                          done();
                        }}
                      >
                        Confirm reviewed extraction
                      </Button>
                    </div>
                  )}
                  <div className="actions mb">
                    <Button
                      disabled={!me.data.capabilities.ai}
                      onClick={() =>
                        act("ai/jobs", {
                          kind: "INQUIRY",
                          text: selected.text,
                          inquiryId: selected.id,
                        })
                      }
                    >
                      <Sparkles size={15} />
                      Extract with AI
                      {!me.data.capabilities.ai ? " · not configured" : ""}
                    </Button>
                    <Button
                      className="primary"
                      disabled={!!selected.extraction && !selected.reviewed}
                      onClick={() => {
                        setView("quotations");
                        setModal("create");
                      }}
                    >
                      Create quotation
                    </Button>
                  </div>
                </>
              )}
              {can(role, config[view]?.permission || "read") &&
              !(view === "change-orders" && selected.status === "APPROVED") ? (
                <ResourceForm
                  showCost={can(role, "cost:read")}
                  resource={view}
                  record={selected}
                  lookups={lookups}
                  api={api}
                  done={done}
                />
              ) : (
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              )}
            </>
          ))}
      </Modal>
    </div>
  );
}
