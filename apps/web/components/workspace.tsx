"use client";
import { useI18n, LocaleProvider } from "../lib/i18n";
import {
  apiError,
  actionLabel,
  fieldLabel,
  enumLabel,
  resourceLabel,
  formatDate,
} from "../lib/localization";
import { RecordDetails, displayValue } from "./record-details";
import { enterWorkspace } from "../lib/motion";
import { useDebounced } from "../lib/hooks";
import dynamic from "next/dynamic";
import { FileSettings } from "./file-settings";
import { Schedule } from "./schedule";
import { AIProviderSettings } from "./ai-settings";
import { Importer } from "./importer";
import { palettes, type PaletteId } from "./themes";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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
  Boxes,
  ArrowRightLeft,
  Building2,
  Wrench,
  CheckSquare,
  Trash2,
} from "lucide-react";
import { config, groups, kinds, can, titleCase, type RecordData } from "./data";
import { Button, Modal, Badge, Empty, confirmDialogDiscard, cn } from "./ui";
import { StockOperation } from "./stock-operation";
import {
  AuthScreen,
  Onboarding,
  InvitationScreen,
  ResetPasswordScreen,
} from "./auth";
import { ResourceForm, DocumentForm, type API } from "./forms";
import { RecordsTable } from "./table";
import { Cutting, AIWorkspace, Takeoff } from "./operations";
const RevenueChart = dynamic(() => import("./revenue-chart"), {
  loading: () => <div className="skeleton chart" />,
});
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
const quickCreateItems = [
  {
    group: "Sales & CRM",
    items: [
      { id: "customer", view: "customers", permission: "sales:write", label: "Customer", icon: Users },
      { id: "inquiry", view: "inquiries", permission: "sales:write", label: "Inquiry", icon: Inbox },
      { id: "quotation", view: "quotations", permission: "sales:write", label: "Quotation", icon: FileText },
      { id: "order", view: "orders", permission: "sales:write", label: "Sales order", icon: ShoppingCart },
    ],
  },
  {
    group: "Supply chain",
    items: [
      { id: "product", view: "products", permission: "catalog:write", label: "Product", icon: Package },
      { id: "inventory", view: "inventory", permission: "inventory:write", label: "Stock adjustment", icon: Boxes },
      { id: "transfer", view: "inventory", modal: "transfer", permission: "inventory:write", label: "Stock transfer", icon: ArrowRightLeft },
      { id: "purchase", view: "purchases", permission: "procurement:write", label: "Purchase order", icon: Truck },
      { id: "supplier", view: "suppliers", permission: "procurement:write", label: "Supplier", icon: Building2 },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "fabrication", view: "fabrication", permission: "fabrication:write", label: "Fabrication job", icon: Wrench },
      { id: "project", view: "projects", permission: "projects:write", label: "Project", icon: Briefcase },
      { id: "task", view: "tasks", permission: "projects:write", label: "Task", icon: CheckSquare },
    ],
  },
  {
    group: "Finance & intelligence",
    items: [
      { id: "invoice", view: "invoices", permission: "finance:write", label: "Invoice", icon: Receipt },
      { id: "credit", view: "credit-notes", permission: "finance:write", label: "Credit note", icon: CreditCard },
    ],
  },
];
export function Workspace() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 30000, gcTime: 120000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <Application />
      </LocaleProvider>
    </QueryClientProvider>
  );
}
function Application() {
  const { t, locale, setLocale } = useI18n();

  const [view, setView] = useState("dashboard"),
    [organization, setOrganization] = useState(""),
    [theme, setTheme] = useState("light"),
    [colorPalette, setColorPalette] = useState<PaletteId>("foundry"),
    [textSize, setTextSize] = useState("normal"),
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
    [range, setRange] = useState("30");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const [smallScreen, setSmallScreen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!quickCreateOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!quickCreateRef.current?.contains(e.target as Node)) {
        setQuickCreateOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickCreateOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [quickCreateOpen]);
  useEffect(() => {
    const media = matchMedia("(max-width:760px)");
    const update = () => setSmallScreen(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!smallScreen || !mobile) return;
    const first = sidebarRef.current?.querySelector<HTMLElement>("button");
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        document.querySelector<HTMLElement>(".mobile-only")?.focus();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          sidebarRef.current?.querySelectorAll<HTMLElement>(
            "button,select,summary,[href]",
          ) || [],
        ).filter(
          (el) => el.getClientRects().length && !el.hasAttribute("disabled"),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [smallScreen, mobile]);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    enterWorkspace(mainRef.current);
  }, [view]);
  const queryClient = useQueryClient();
  const searchValue = useDebounced(search),
    paletteValue = useDebounced(palette);
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
  const actionLock = useRef(false);
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
          route.endsWith("/fulfill") ||
          route === "credit-notes" ||
          route === "inventory/transfer" ||
          route === "inventory/adjust" ||
          route === "fabrication")
      ) {
        const data = { ...(body as RecordData) };
        delete data.idempotencyKey;
        const key = org + route + JSON.stringify(data);
        if (!pendingMutations.current.has(key))
          pendingMutations.current.set(key, crypto.randomUUID());
        body = { ...data, idempotencyKey: pendingMutations.current.get(key) };
      }
      const headers: Record<string, string> = {
        "x-organization-id": org,
        "accept-language": locale,
      };
      if (body && !(body instanceof FormData))
        headers["Content-Type"] = "application/json";
      let res: Response;
      try {
        res = await fetch(`/metalflow/api/v1/${route}`, {
          method,
          headers,
          credentials: "same-origin",
          ...(body
            ? { body: body instanceof FormData ? body : JSON.stringify(body) }
            : {}),
        });
      } catch {
        throw Error(
          locale === "zh"
            ? "网络连接失败，请检查网络或稍后重试"
            : "Network connection failed. Please check your network and retry.",
        );
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Error(apiError(data, locale, res.status));
      }
      if (
        res.headers.get("content-type")?.includes("application/pdf") ||
        res.headers.get("content-type")?.startsWith("image/")
      )
        return res.blob();
      return res.json();
    },
    [organization, locale],
  );
  const me = useQuery({
    queryKey: ["me", organization],
    queryFn: () => api("me"),
    staleTime: 60000,
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
    const savedTextSize = localStorage.getItem("metalflow.textSize");
    if (["small", "normal", "large", "xlarge"].includes(savedTextSize || ""))
      setTextSize(savedTextSize as string);
    setPreferencesLoaded(true);
    setLocale(localStorage.getItem("metalflow.locale") === "zh" ? "zh" : "en");
    setCollapsed(localStorage.getItem("metalflow.collapsed") === "true");
    const route = location.hash.slice(1);
    if (groups.flatMap((g) => g.items).some((i) => i[0] === route))
      setView(route);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = colorPalette;
    document.documentElement.dataset.textSize = textSize;
    localStorage.setItem("metalflow.palette", colorPalette);
    localStorage.setItem("metalflow.textSize", textSize);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localStorage.setItem("metalflow.theme", theme);
    localStorage.setItem("metalflow.locale", locale);
  }, [theme, locale, colorPalette, textSize, preferencesLoaded]);
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
  const navigate = useCallback(
    (
      v: string,
      intent?: { modal: string; record?: RecordData; saved?: boolean },
    ) => {
      if (!intent?.saved && !confirmDialogDiscard(t)) return;
      setView(v);
      if (location.hash !== `#${v}`) history.pushState(null, "", `#${v}`);
      setSearch("");
      setPage(1);
      setMobile(false);
      setModal(intent?.modal || "");
      setSelected(intent?.record);
    },
    [t],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (confirmDialogDiscard(t)) setModal("command");
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
      if (groups.flatMap((g) => g.items).some((i) => i[0] === v)) {
        if (!confirmDialogDiscard(t)) {
          history.pushState(null, "", `#${view}`);
          return;
        }
        setView(v);
        setSearch("");
        setPage(1);
        setModal("");
        setSelected(undefined);
        setMobile(false);
      }
    };
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("hashchange", hash);
    };
  }, [t, view]);
  const [board, setBoard] = useState(false),
    [schedule, setSchedule] = useState(false);
  const done = () => {
    pendingMutations.current.clear();
    setModal("");
    setSelected(undefined);
    setMessage("Saved successfully");
    setFormError("");
    void queryClient.invalidateQueries({
      queryKey: ["list", view, organization],
    });
    void queryClient.invalidateQueries({
      queryKey: ["analytics", organization],
    });
    void queryClient.invalidateQueries({ queryKey: ["lookups", organization] });
    if (["settings", "team"].includes(view)) refresh();
  };
  const lookupsQuery = useQuery({
    queryKey: ["lookups", organization],
    enabled:
      !!org &&
      ![
        "dashboard",
        "analytics",
        "settings",
        "team",
        "design",
        "assistant",
        "cutting",
        "audit",
      ].includes(view),
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          [
            "customers",
            "products",
            "suppliers",
            "warehouses",
            "projects",
            "tax-rates",
          ].map(async (r) => [r, (await api(`${r}?limit=100`)).items]),
        ),
      ),
  });
  const lookups: Record<string, RecordData[]> = lookupsQuery.data || {};
  const endpoint = kinds[view] ? `documents?kind=${kinds[view]}` : `${view}?`;
  const list = useQuery({
    queryKey: ["list", view, organization, page, searchValue],
    placeholderData: (previous, query) =>
      query?.queryKey[1] === view && query?.queryKey[2] === organization
        ? previous
        : undefined,
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
        `${endpoint}${endpoint.endsWith("?") ? "" : "&"}page=${page}&search=${encodeURIComponent(searchValue)}`,
      ),
  });
  const documentQuery = useQuery({
    queryKey: ["document", organization, selected?.id],
    refetchOnWindowFocus: false,
    enabled:
      !!org &&
      !!kinds[view] &&
      !!selected?.id &&
      ["detail", "terms"].includes(modal),
    queryFn: () => api(`documents/${selected?.id}`),
    staleTime: 0,
  });
  const analytics = useQuery({
    queryKey: ["analytics", organization, range],
    enabled: !!org && (view === "dashboard" || view === "analytics"),
    queryFn: () =>
      api(
        `analytics?from=${(range === "1" ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(Date.now() - Number(range) * 86400000)).toISOString()}`,
      ),
  });
  const team = useQuery({
    queryKey: ["team", organization],
    enabled: !!org && view === "team",
    queryFn: () => api("team"),
  });
  const notifications = useQuery({
    queryKey: ["activity", organization],
    enabled: !!org && modal === "notifications",
    queryFn: () => api("activity"),
  });
  const jobs = useQuery({
    queryKey: ["jobs", organization],
    enabled: !!org && ["design", "assistant"].includes(view),
    queryFn: () => api("ai/jobs"),
    refetchInterval: (query) =>
      query.state.data?.items?.some((j: RecordData) =>
        ["QUEUED", "RUNNING"].includes(j.status),
      )
        ? 5000
        : false,
  });
  const globalSearch = useQuery({
    queryKey: ["global-search", organization, paletteValue],
    enabled: !!org && modal === "command" && paletteValue.length > 1,
    queryFn: async () => {
      const out = await Promise.all(
        ["customers", "products", "inquiries", "projects"].map(
          async (resource) => ({
            resource,
            items: (
              await api(
                `${resource}?search=${encodeURIComponent(paletteValue)}&limit=5`,
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
          refresh();
        }}
      />
    );
  if (me.isPending)
    return (
      <div className="loading-screen">
        <Layers3 />
        <span>{t("Opening MetalFlow OS…")}</span>
      </div>
    );
  if (!me.data) return <AuthScreen api={api} done={() => refresh()} />;
  if (invitation)
    return (
      <InvitationScreen
        api={api}
        token={invitation}
        done={() => {
          setInvitation("");
          refresh();
        }}
      />
    );
  if (!membership || modal === "organization")
    return (
      <Onboarding
        api={api}
        done={() => {
          setModal("");
          setOrganization(localStorage.getItem("metalflow.org") || "");
          refresh();
        }}
      />
    );
  const allowed = (id: string) => {
    if (
      ["team", "settings", "audit"].includes(id) &&
      !can(role, "organization:manage")
    )
      return false;
    if (
      ["expenses", "payments", "analytics", "credit-notes"].includes(id) &&
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
      : view === "invoices" || view === "payments" || view === "credit-notes"
        ? "finance:write"
        : kinds[view]
          ? "sales:write"
          : view === "inventory"
            ? "inventory:write"
            : "organization:manage");
  const act = async (route: string, body: unknown) => {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      await api(route, "POST", body);
      done();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      actionLock.current = false;
    }
  };
  const exportCSV = () => {
    if (list.isFetching || list.isPlaceholderData || search !== searchValue)
      return;
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
      cols.map((k) => safe(fieldLabel(k, locale))).join(","),
      ...items.map((r: any) =>
        cols
          .map((k) =>
            safe(
              r[k] !== null && typeof r[k] === "object"
                ? JSON.stringify(r[k])
                : displayValue(k, r[k], locale),
            ),
          )
          .join(","),
      ),
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    a.download =
      locale === "zh"
        ? `MetalFlow-${resourceLabel(view, locale)}-第${page}页.csv`
        : `metalflow-${view}-page-${page}.csv`;
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
          aria-label={t("Close navigation")}
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className="sidebar"
        inert={smallScreen && !mobile}
      >
        <button
          className="brand"
          onClick={() => navigate("dashboard")}
          aria-label={t("MetalFlow home")}
        >
          <Layers3 />
          <span>
            {" "}
            {t("MetalFlow")} <b>{t("OS")}</b>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">{org.name.slice(0, 1)}</span>
          <select
            aria-label={t("Select workspace")}
            value={organization}
            onChange={(e) => {
              if (!confirmDialogDiscard(t)) return;
              if (e.target.value === "new") setModal("organization");
              else {
                setModal("");
                setSelected(undefined);
                setSearch("");
                setPage(1);
                pendingMutations.current.clear();
                setView("dashboard");
                location.hash = "dashboard";
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
            <option value="new">{t("+ Create workspace")}</option>
          </select>
        </div>
        <nav aria-label={t("Main navigation")}>
          {groups.map((g) => (
            <details key={g.label} open>
              <summary>
                {t(g.label)}
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
            <button
              className="profile-button"
              onClick={() => setModal("profile")}
            >
              <strong>{me.data.user.name}</strong>
            </button>
            <small>{t(role)}</small>
          </div>
          <Button
            aria-label={t("Sign out")}
            onClick={async () => {
              if (!confirmDialogDiscard(t)) return;
              await api("auth/sign-out", "POST", {});
              localStorage.removeItem("metalflow.org");
              pendingMutations.current.clear();
              setOrganization("");
              setSelected(undefined);
              setModal("");
              setView("dashboard");
              queryClient.clear();
              refresh();
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </aside>
      <div className="main-column" inert={smallScreen && mobile}>
        <header className="global-header">
          <div className="actions">
            <Button
              className="mobile-only"
              aria-label={t("Open navigation")}
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <Button
              className="desktop-only icon"
              aria-label={t("Collapse sidebar")}
              onClick={() => {
                setCollapsed(!collapsed);
                localStorage.setItem("metalflow.collapsed", String(!collapsed));
              }}
            >
              <Menu size={18} />
            </Button>
            <span className="header-breadcrumb">
              {" "}
              {t("Workspace")} <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="header-tools">
            <button
              className="global-search"
              id="global-search"
              onClick={() => setModal("command")}
            >
              <Search size={15} />
              <span>
                {locale === "zh" ? "搜索工作区" : t("Search workspace")}
              </span>
              <kbd>{t("⌘ K")}</kbd>
            </button>
            <Button
              className="icon"
              aria-label={t("Change language")}
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            >
              <Languages size={17} />
            </Button>
            <Button
              className="icon"
              aria-label={t("Color themes")}
              title={locale === "zh" ? "配色主题" : t("Color themes")}
              onClick={() => setModal("appearance")}
            >
              <Palette size={17} />
            </Button>
            <Button
              className="icon"
              aria-label={t("Toggle theme")}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </Button>
            <Button
              className="icon"
              aria-label={t("Activity notifications")}
              onClick={() => setModal("notifications")}
            >
              <Bell size={17} />
            </Button>
            {role !== "VIEWER" && (
              <div className="quick-create-container" ref={quickCreateRef}>
                <Button
                  className="primary quick-create"
                  aria-expanded={quickCreateOpen}
                  aria-haspopup="menu"
                  onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                >
                  <Plus size={16} />
                  <span>{t("Quick create")}</span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "quick-create-chevron",
                      quickCreateOpen && "rotate-180",
                    )}
                  />
                </Button>
                {quickCreateOpen && (
                  <div className="quick-create-dropdown" role="menu">
                    {quickCreateItems.map((group) => {
                      const visibleItems = group.items.filter((item) =>
                        can(role, item.permission),
                      );
                      if (!visibleItems.length) return null;
                      return (
                        <div key={group.group} className="quick-create-group">
                          <div className="quick-create-heading">
                            {t(group.group)}
                          </div>
                          {visibleItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                className="quick-create-item"
                                onClick={() => {
                                  setQuickCreateOpen(false);
                                  if (item.modal === "transfer") {
                                    setView("inventory");
                                    setFormError("");
                                    setModal("transfer");
                                  } else {
                                    navigate(item.view, { modal: "create" });
                                  }
                                }}
                              >
                                <IconComponent size={15} />
                                <span>{t(item.label)}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main ref={mainRef} data-view={view}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? t("YOUR BUSINESS, IN FOCUS")
                  : t("METALFLOW WORKSPACE")}
              </div>
              <h1>
                {view === "dashboard"
                  ? locale === "zh"
                    ? "经营概览"
                    : t("Operations overview")
                  : title}
              </h1>
              <p>
                {view === "dashboard"
                  ? locale === "zh"
                    ? "实时汇总询价、订单与项目执行进度。"
                    : t("Every inquiry, order and project. Moving together.")
                  : t(
                      config[view]?.description ||
                        "Connected records. Clear decisions. Full traceability.",
                    )}
              </p>
            </div>
            <div className="actions">
              {view === "tasks" && (
                <Button onClick={() => setSchedule(!schedule)}>
                  {t(schedule ? "Table view" : "Calendar view")}
                </Button>
              )}
              {["dashboard", "analytics"].includes(view) ? (
                <select
                  aria-label={t("Date range")}
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="1">{t("Today")}</option>
                  <option value="7">{t("Last 7 days")}</option>
                  <option value="30">{t("Last 30 days")}</option>
                  <option value="90">{t("Last 90 days")}</option>
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
                    setModal(view === "credit-notes" ? "credit" : "create");
                  }}
                >
                  <Plus size={16} />
                  {view === "team"
                    ? t("Invite member")
                    : view === "inventory"
                      ? t("Adjust stock")
                      : view === "payments"
                        ? t("Record payment")
                        : t("Create new")}
                </Button>
              ) : null}
            </div>
          </div>
          {message && (
            <div role="status" className="toast">
              <CheckCircle2 size={16} />
              {t(message)}
              <button aria-label={t("Dismiss")} onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {!allowed(view) ? (
            <div className="notice">
              {" "}
              {t(
                "This module is disabled or your role does not have permission to view it.",
              )}{" "}
            </div>
          ) : ["dashboard", "analytics"].includes(view) ? (
            <>
              {analytics.isError ? (
                <p className="error">{t(analytics.error.message)}</p>
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
                          <span>{t(label)}</span>
                          <Icon size={17} />
                        </div>
                        <strong>{value}</strong>
                        <small>{t(note)}</small>
                      </article>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel revenue-panel">
                      <div className="panel-title">
                        <div>
                          <h2>{t("Revenue overview")}</h2>
                          <p>
                            {" "}
                            {t("Issued invoice value ·")} {org.currency}{" "}
                            {t("· excluding tax")}{" "}
                          </p>
                        </div>
                        <Badge value="DATABASE" />
                      </div>
                      {analytics.data.trend?.length ? (
                        <RevenueChart data={analytics.data.trend} />
                      ) : (
                        <Empty
                          title={t("Your revenue story starts here")}
                          description={t(
                            "Issue an invoice to see real revenue in this chart.",
                          )}
                        />
                      )}
                    </section>
                    <section className="panel attention">
                      <div className="panel-title">
                        <h2>{t("Needs attention")}</h2>
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
                            <strong>{t(a)}</strong>
                            <small>{t(b)}</small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                      <div className="workflow-note">
                        <span className="eyebrow">
                          {t("ONE CONNECTED WORKFLOW")}
                        </span>
                        <p>{t("Inquiry → Quote → Order → Invoice")}</p>
                        <small>
                          {" "}
                          {t(
                            "Commercial history stays linked at every step.",
                          )}{" "}
                        </small>
                      </div>
                    </section>
                    {view === "analytics" && analytics.data.salesByCustomer && (
                      <section className="panel span-2">
                        <div className="panel-title">
                          <h2>{t("Commercial performance")}</h2>
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
                            <small>
                              {t("Gross profit · quoted catalog cost")}
                            </small>
                            <strong>
                              {analytics.data.grossProfit === null
                                ? t("Unavailable")
                                : money(analytics.data.grossProfit)}
                            </strong>
                          </div>
                          <div>
                            <small>
                              {t("Inventory value · current unit cost")}
                            </small>
                            <strong>
                              {money(analytics.data.inventoryValuation)}
                            </strong>
                          </div>
                          <div>
                            <small>{t("Low-stock products")}</small>
                            <strong>{analytics.data.lowStockCount || 0}</strong>
                          </div>
                        </div>
                        <div className="form-grid">
                          <section>
                            <h3>{t("Sales by customer")}</h3>
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
                            <h3>
                              {t("Sales by product · before document discount")}
                            </h3>
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
                          {" "}
                          {t("Project budget tracking")}{" "}
                        </h3>
                        {analytics.data.projectBudgets.map((r: RecordData) => (
                          <div key={r.id} className="snapshot-row">
                            <span>{r.name}</span>
                            <strong>
                              {money(r.expenses)} {t("spent /")}{" "}
                              {money(r.budget)} {t("budget")}{" "}
                            </strong>
                          </div>
                        ))}
                        <p className="notice">
                          {" "}
                          {t(
                            "Gross profit uses catalog cost snapshots at quotation creation. Custom lines without costs make gross profit unavailable. Inventory valuation uses current catalog cost; it is not an audited accounting valuation.",
                          )}{" "}
                        </p>
                      </section>
                    )}
                    <section className="panel activity">
                      <div className="panel-title">
                        <h2>{t("Recent activity")}</h2>
                        <Button
                          onClick={() =>
                            navigate(
                              can(role, "organization:manage")
                                ? "audit"
                                : "inquiries",
                            )
                          }
                        >
                          {" "}
                          {t("View records")} <ArrowUpRight size={14} />
                        </Button>
                      </div>
                      {analytics.data.activity.length ? (
                        analytics.data.activity.map((a: any) => (
                          <div className="activity-row" key={a.id}>
                            <span className="timeline-dot" />
                            <div>
                              <strong>{actionLabel(a.action, locale)}</strong>
                              <small>
                                {t("Record")} {a.entityId.slice(0, 8)}
                              </small>
                            </div>
                            <time>
                              {formatDate(a.createdAt, locale, "datetime")}
                            </time>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title={t("A fresh workspace")}
                          description={t(
                            "Your team's activity will appear here as you work.",
                          )}
                        />
                      )}
                    </section>
                    <section className="panel">
                      <h2>{t("Workspace snapshot")}</h2>
                      <div className="snapshot-row">
                        <span>{t("Stock positions")}</span>
                        <strong>{analytics.data.stockLines}</strong>
                      </div>
                      <div className="snapshot-row">
                        <span>{t("Quote conversion")}</span>
                        <strong>
                          {analytics.data.conversionRate.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="snapshot-row">
                        <span>{t("Active projects")}</span>
                        <strong>{analytics.data.activeProjects}</strong>
                      </div>
                      <div className="snapshot-row">
                        <span>{t("Base currency")}</span>
                        <strong>{org.currency}</strong>
                      </div>
                      {analytics.data.aging?.map((a: any) => (
                        <div className="snapshot-row" key={t(a.label)}>
                          <span>
                            {t("Receivables · {range} days", {
                              range: a.label === "90+" ? "90+" : t(a.label),
                            })}
                          </span>
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
              refresh={() => refresh()}
            />
          ) : view === "takeoffs" ? (
            <Takeoff
              onQuote={
                can(role, "sales:write")
                  ? (takeoff) => {
                      if (
                        takeoff.measurements.filter(
                          (m: RecordData) => m.verified,
                        ).length > 100
                      ) {
                        setMessage(
                          t(
                            "A quotation supports at most 100 lines. Split this takeoff before conversion.",
                          ),
                        );
                        return;
                      }
                      setSelected({
                        notes: `Verified takeoff: ${takeoff.name} (${takeoff.id})`,
                        bomLines: takeoff.measurements
                          .filter((m: RecordData) => m.verified)
                          .map((m: RecordData) => ({
                            description: `${m.label} (${m.unit})`,
                            quantity: m.quantity,
                            unit: [
                              "piece",
                              "m",
                              "ft",
                              "kg",
                              "lb",
                              "m2",
                              "ft2",
                              "sheet",
                            ].includes(m.unit)
                              ? m.unit
                              : "custom",
                            unitPrice: "0",
                          })),
                      });
                      setView("quotations");
                      setModal("create");
                    }
                  : undefined
              }
              api={api}
              items={list.data?.items || []}
              refresh={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["list", "takeoffs", organization],
                })
              }
            />
          ) : schedule && view === "tasks" ? (
            <Schedule
              api={api}
              organizationId={organization}
              onSelect={(row) => {
                setSelected(row);
                setModal("detail");
              }}
            />
          ) : view === "settings" ? (
            <section className="panel settings-panel">
              <h2>{t("Organization settings")}</h2>
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
                    {" "}
                    {t("Company name")}{" "}
                    <input
                      name="name"
                      defaultValue={org.name}
                      required
                      placeholder={t("Company or organization name")}
                    />
                  </label>
                  <label>
                    {" "}
                    {t("Default language")}{" "}
                    <select name="locale" defaultValue={org.locale}>
                      <option value="en">{t("English")}</option>
                      <option value="zh">简体中文</option>
                    </select>
                  </label>
                </div>
                <h3>{t("Enabled modules")}</h3>
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
                      {t(m)}
                    </label>
                  ))}
                </div>
                <Button className="primary mt">{t("Save settings")}</Button>
              </form>
              <div className="settings-section">
                <h3>{locale === "zh" ? "页面文本大小" : t("Page text size")}</h3>
                <p className="muted">
                  {locale === "zh"
                    ? "自适应调节工作区字号与阅读密度，偏好设置自动保存在本地。"
                    : t(
                        "Adjust the font and reading size for your workspace in this browser.",
                      )}
                </p>
                <div className="appearance-mode mt">
                  {[
                    { id: "small", en: "Small", zh: "小号", desc: "14px" },
                    { id: "normal", en: "Standard", zh: "标准", desc: "15px" },
                    { id: "large", en: "Large", zh: "大号", desc: "16.5px" },
                    { id: "xlarge", en: "Extra Large", zh: "特大", desc: "18px" },
                  ].map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      aria-pressed={textSize === s.id}
                      onClick={() => setTextSize(s.id)}
                    >
                      {locale === "zh" ? s.zh : s.en} ({s.desc})
                    </Button>
                  ))}
                </div>
              </div>
              <FileSettings api={api} organizationId={organization} />
              <AIProviderSettings
                api={api}
                organizationId={organization}
                onChanged={() => refresh()}
              />
              <div className="settings-section">
                <h3>{t("AI conversation history")}</h3>
                <p className="muted">
                  {t(
                    "Clear all saved AI conversation and design sessions. This cannot be undone.",
                  )}
                </p>
                <Button
                  type="button"
                  className="btn-danger mt"
                  onClick={async () => {
                    const confirmMsg =
                      t("Clear all AI conversation history? This cannot be undone.");
                    if (!window.confirm(confirmMsg)) return;
                    try {
                      await api("ai/history", "DELETE");
                      refresh();
                      setMessage(
                        t("AI conversation history cleared"),
                      );
                    } catch (e) {
                      setFormError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={15} />
                  <span>{t("Clear all AI history")}</span>
                </Button>
              </div>
              <div className="record-row">
                <span>{t("Email delivery")}</span>
                <Badge
                  value={
                    me.data.capabilities.email
                      ? "CONFIGURED"
                      : "CONFIGURATION_REQUIRED"
                  }
                />
              </div>
              <p className="notice">
                {" "}
                {t(
                  "Email verification and password reset delivery require SMTP configured by the server operator.",
                )}{" "}
              </p>
              {formError && <p className="error">{t(formError)}</p>}
            </section>
          ) : view === "team" ? (
            <section className="panel">
              <h2>{t("Workspace members")}</h2>
              {team.isError ? (
                <p className="error">{t(team.error.message)}</p>
              ) : (
                (team.data || []).map((m: any) => (
                  <div className="record-row" key={m.id}>
                    <div>
                      <strong>{m.user.name}</strong>
                      <small>{m.user.email}</small>
                    </div>
                    <select
                      aria-label={t("Role for {name}", { name: m.user.name })}
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
                        ].map((r) => (
                          <option key={r} value={r}>
                            {t(r)}
                          </option>
                        ))}
                    </select>
                  </div>
                ))
              )}
              <p className="notice">
                {" "}
                {t(
                  "Roles are enforced by the API. Owners retain organization control. Custom role definitions are not yet available.",
                )}{" "}
              </p>
              {formError && <p className="error">{t(formError)}</p>}
            </section>
          ) : (
            <section className="panel data-panel">
              <div className="filter-bar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label={t("Search records")}
                    placeholder={
                      locale === "zh" ? "搜索记录…" : t("Search records…")
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
                        {" "}
                        {t("Import CSV")}{" "}
                      </Button>
                    )}
                  {["projects", "tasks"].includes(view) && (
                    <Button onClick={() => setBoard(!board)}>
                      {board ? t("Table view") : t("Board view")}
                    </Button>
                  )}
                  {view === "inventory" && can(role, "inventory:write") && (
                    <Button
                      onClick={() => {
                        setFormError("");
                        setModal("transfer");
                      }}
                    >
                      {" "}
                      {t("Transfer stock")}{" "}
                    </Button>
                  )}
                  <span className="result-count">
                    {list.data?.total || 0} {t("records")}{" "}
                  </span>
                  <Button
                    onClick={exportCSV}
                    disabled={
                      !list.data?.items?.length ||
                      list.isFetching ||
                      list.isPlaceholderData ||
                      search !== searchValue
                    }
                  >
                    <Download size={15} /> {t("Export page")}{" "}
                  </Button>
                </div>
              </div>
              {list.isPending ? (
                <div className="skeleton table-skeleton" />
              ) : list.isError ? (
                <div className="error" role="alert">
                  {t(list.error.message)}
                  <Button onClick={() => list.refetch()}>{t("Retry")}</Button>
                </div>
              ) : board && ["projects", "tasks"].includes(view) ? (
                <div className="kanban">
                  {(view === "projects"
                    ? ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]
                    : ["TODO", "IN_PROGRESS", "DONE"]
                  ).map((status) => (
                    <section key={status}>
                      <h3>{t(titleCase(status))}</h3>
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
                                ? formatDate(r.dueDate, locale)
                                : t("No due date")}
                            </small>
                            {r.budget && <span>{money(r.budget)}</span>}
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <RecordsTable
                  resource={view}
                  empty={
                    <div>
                      <Empty
                        title={
                          searchValue
                            ? t("No matching records")
                            : t("No records yet")
                        }
                        description={
                          searchValue
                            ? t('No records match "{query}".', {
                                query: searchValue,
                              })
                            : t("No records are available in this workspace.")
                        }
                      />
                      <div className="table-empty-actions actions">
                        {searchValue ? (
                          <Button
                            onClick={() => {
                              setSearch("");
                              setPage(1);
                            }}
                          >
                            {t("Clear search")}
                          </Button>
                        ) : can(role, writePermission) &&
                          (config[view] || kinds[view]) ? (
                          <Button onClick={() => setModal("create")}>
                            {t("Create record")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  }
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
                            : view === "credit-notes"
                              ? ["invoiceId", "amount", "reason", "createdAt"]
                              : ["action", "entityId", "createdAt"])
                  }
                  lookups={lookups}
                  onSelect={
                    (config[view] || kinds[view]) && !list.isPlaceholderData
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
                <span>
                  {t("Page")} {page} {t("· Up to 25 records per page")}
                </span>
                <div className="actions">
                  <Button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    aria-label={t("Previous page")}
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <Button
                    disabled={page * 25 >= (list.data?.total || 0)}
                    onClick={() => setPage(page + 1)}
                    aria-label={t("Next page")}
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            </section>
          )}
          <footer className="app-footer">
            <span>{t("MetalFlow OS")}</span>
            <span>
              {org.name} · {org.currency} {t("· Tenant workspace")}{" "}
            </span>
          </footer>
        </main>
      </div>
      <Modal
        open={modal === "profile"}
        onClose={() => setModal("")}
        title={t("Profile settings")}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const f = new FormData(e.currentTarget);
              await api("profile", "PATCH", { name: f.get("name") });
              done();
              refresh();
            } catch (e) {
              setFormError((e as Error).message);
            }
          }}
        >
          <label>
            {t("Display name")}
            <input
              name="name"
              defaultValue={me.data.user.name}
              required
              maxLength={100}
              placeholder={t("Your display name")}
            />
          </label>
          <p className="muted mt">{me.data.user.email}</p>
          <Button className="primary mt">{t("Update profile")}</Button>
          {formError && <p className="error">{t(formError)}</p>}
        </form>
      </Modal>
      <Modal
        open={modal === "shortage"}
        onClose={() => setModal("")}
        title={t("Purchase shortage")}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (actionLock.current) return;
            actionLock.current = true;
            try {
              const purchase = await api(
                `orders/${selected?.id}/purchase-shortage`,
                "POST",
                Object.fromEntries(f),
              );
              refresh();
              navigate("purchases", {
                modal: "detail",
                record: purchase,
                saved: true,
              });
            } catch (error) {
              setFormError((error as Error).message);
            } finally {
              actionLock.current = false;
            }
          }}
        >
          <label>
            {t("Supplier")}
            <select name="supplierId" required>
              {lookups.suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Warehouse")}
            <select name="warehouseId" required>
              {lookups.warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name === "Main warehouse" ? t("Main warehouse") : w.name}
                </option>
              ))}
            </select>
          </label>
          <p className="notice">
            {t(
              "Purchase drafts require price review and approval before receiving.",
            )}
          </p>
          <Button className="primary mt">{t("Create purchase draft")}</Button>
          {formError && <p className="error">{t(formError)}</p>}
        </form>
      </Modal>
      <Modal
        open={modal === "credit"}
        onClose={() => setModal("")}
        title={t("Issue credit note")}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act("credit-notes", {
              invoiceId: selected?.id || f.get("invoiceId"),
              amount: f.get("amount"),
              reason: f.get("reason"),
              idempotencyKey: crypto.randomUUID(),
            });
          }}
        >
          {!selected && (
            <label>
              {t("Issued invoice ID")}
              <input name="invoiceId" required placeholder={t("e.g. INV-2026-001")} />
            </label>
          )}
          <label>
            {t("Credit amount")}
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
            />
          </label>
          <label>
            {t("Credit reason")}
            <input
              name="reason"
              minLength={5}
              required
              placeholder={t("Reason for credit note…")}
            />
          </label>
          {formError && <p className="error">{t(formError)}</p>}
          <Button className="primary mt">{t("Issue credit note")}</Button>
        </form>
      </Modal>
      <Modal
        open={modal === "import"}
        onClose={() => setModal("")}
        title={t("Import {resource}", { resource: title })}
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
          locale === "zh"
            ? "外观与莫兰迪配色"
            : t("Appearance & Morandi palettes")
        }
        wide
      >
        <p className="muted">
          {locale === "zh"
            ? "采用低饱和莫兰迪色调，可按需切换配色与明暗外观。"
            : t(
                "Muted colors, clear information. Choose a palette and light or dark mode independently.",
              )}
        </p>
        <div className="appearance-mode mt">
          <Button
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
          >
            <Sun size={16} />
            {locale === "zh" ? "浅色" : t("Light")}
          </Button>
          <Button
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
          >
            <Moon size={16} />
            {locale === "zh" ? "深色" : t("Dark")}
          </Button>
        </div>
        <div className="appearance-section">
          <strong>{locale === "zh" ? "页面文本大小" : t("Page text size")}</strong>
          <div className="appearance-mode mt">
            {[
              { id: "small", en: "Small", zh: "小号", desc: "14px" },
              { id: "normal", en: "Standard", zh: "标准", desc: "15px" },
              { id: "large", en: "Large", zh: "大号", desc: "16.5px" },
              { id: "xlarge", en: "Extra Large", zh: "特大", desc: "18px" },
            ].map((s) => (
              <Button
                key={s.id}
                type="button"
                aria-pressed={textSize === s.id}
                onClick={() => setTextSize(s.id)}
              >
                {locale === "zh" ? s.zh : s.en} ({s.desc})
              </Button>
            ))}
          </div>
        </div>
        <fieldset className="theme-options" aria-label={t("Color palette")}>
          {palettes.map((p) => (
            <label className="theme-option" key={p.id}>
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={colorPalette === p.id}
                onChange={() => setColorPalette(p.id)}
                aria-label={locale === "zh" ? p.zh : p.en}
              />
              <span className="palette-swatches" aria-hidden="true">
                {p.colors.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span>
                <strong>{locale === "zh" ? p.zh : p.en}</strong>
                <small>{locale === "zh" ? t("Muted palette") : p.zh}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="theme-example">
          <strong>
            {locale === "zh" ? "工作区预览" : t("Workspace preview")}
          </strong>
          <p>
            {locale === "zh"
              ? "设置将应用于所有模块，并在当前浏览器自动保存。"
              : t(
                  "Applies across every module and saves automatically in this browser.",
                )}
          </p>
          <div className="actions">
            <Button className="primary" onClick={() => setModal("")}>
              {locale === "zh" ? "完成" : t("Done")}
            </Button>
            <Badge value="APPROVED" />
            <span className="muted">
              {t("INV-2026 ·")} {money("1240")}
            </span>
          </div>
        </div>
      </Modal>
      <Modal
        open={modal === "command"}
        onClose={() => setModal("")}
        title={t("Find anything in your workspace")}
      >
        <div className="command-input">
          <Search size={18} />
          <input
            autoFocus
            placeholder={t("Search pages, customers, products, inquiries…")}
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
          />
          <kbd>{t("Esc")}</kbd>
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
                  navigate(group.resource, { modal: "detail", record: r });
                }}
              >
                {r.name || r.subject}
                <small>{resourceLabel(group.resource, locale)}</small>
              </button>
            )),
          )}
        </div>
      </Modal>
      <Modal
        open={modal === "notifications"}
        onClose={() => setModal("")}
        title={t("Activity notifications")}
      >
        {notifications.isPending ? (
          <p className="muted">{t("Loading activity…")}</p>
        ) : notifications.isError ? (
          <div role="alert">
            <p className="error">{t(notifications.error.message)}</p>
            <Button
              className="mt"
              onClick={() => void notifications.refetch()}
            >
              {t("Retry")}
            </Button>
          </div>
        ) : notifications.data?.length ? (
          notifications.data.map((item: RecordData) => (
            <div key={item.id} className="activity-row">
              <span className="timeline-dot" />
              <div>
                <strong>{actionLabel(item.action, locale)}</strong>
                <small>{item.entityId.slice(0, 8)}</small>
              </div>
              <time>{formatDate(item.createdAt, locale, "datetime")}</time>
            </div>
          ))
        ) : (
          <Empty
            title={t("No activity yet")}
            description={t("Workspace actions will appear here.")}
          />
        )}
      </Modal>
      <Modal
        open={modal === "create"}
        onClose={() => setModal("")}
        title={
          view === "team"
            ? t("Invite a teammate")
            : t("New {resource}", {
                resource: locale === "en" ? title.toLowerCase() : title,
              })
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
            source={
              selected?.subject || selected?.bomLines ? selected : undefined
            }
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
                  {" "}
                  {t("Email")}{" "}
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="teammate@company.com"
                  />
                </label>
                <label>
                  {" "}
                  {t("Role")}{" "}
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
                      <option key={r} value={r}>
                        {t(r)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : view === "inventory" ? (
              <>
                <label>
                  {" "}
                  {t("Product")}{" "}
                  <select name="productId" required>
                    {lookups.products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {" "}
                  {t("Warehouse")}{" "}
                  <select name="warehouseId" required>
                    {lookups.warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name === "Main warehouse"
                          ? t("Main warehouse")
                          : w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {" "}
                  {t("Quantity change")}{" "}
                  <input
                    name="quantity"
                    type="number"
                    step="0.0001"
                    required
                    placeholder="0.0000"
                  />
                </label>
                <label>
                  {" "}
                  {t("Reason")}{" "}
                  <input
                    name="reason"
                    minLength={5}
                    required
                    placeholder={t("Reason for adjustment…")}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {" "}
                  {t("Issued invoice ID")}{" "}
                  <input name="invoiceId" required placeholder={t("e.g. INV-2026-001")} />
                </label>
                <label>
                  {" "}
                  {t("Amount")}{" "}
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                  />
                </label>
                <label>
                  {" "}
                  {t("Reference")}{" "}
                  <input
                    name="reference"
                    required
                    placeholder={t("e.g. Wire transfer #123456")}
                  />
                </label>
                <label>
                  {" "}
                  {t("Method")}{" "}
                  <select name="method">
                    {["BANK", "CASH", "CARD", "OTHER"].map((m) => (
                      <option key={m} value={m}>
                        {t(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError && <p className="error">{t(formError)}</p>}
            <Button className="primary mt">
              {view === "team" ? t("Create invitation link") : t("Save")}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={modal === "terms"}
        onClose={() => setModal("")}
        title={t("Edit payment terms")}
      >
        {documentQuery.data && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await api(`documents/${selected?.id}/terms`, "PATCH", {
                  dueDate: form.get("dueDate")
                    ? new Date(`${form.get("dueDate")}T23:59:59Z`).toISOString()
                    : null,
                  notes: String(form.get("notes")),
                });
                done();
              } catch (error) {
                setFormError((error as Error).message);
              }
            }}
          >
            <label>
              {t("Due date")}
              <input
                type="date"
                name="dueDate"
                defaultValue={documentQuery.data.dueDate?.slice(0, 10) || ""}
              />
            </label>
            <label>
              {t("Terms & notes")}
              <textarea
                name="notes"
                defaultValue={documentQuery.data.notes}
                maxLength={5000}
                placeholder={t("Payment terms or notes…")}
              />
            </label>
            {formError && (
              <p className="error" role="alert">
                {t(formError)}
              </p>
            )}
            <Button className="primary mt">{t("Save")}</Button>
          </form>
        )}
      </Modal>
      <Modal
        open={modal === "edit-document"}
        onClose={() => setModal("")}
        title={t("Revise draft")}
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
        title={t("Transfer stock")}
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
            {" "}
            {t("Product")}{" "}
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
              {i ? t("Destination warehouse") : t("Source warehouse")}
              <select name={key} required>
                {lookups.warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name === "Main warehouse" ? t("Main warehouse") : w.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            {" "}
            {t("Quantity")}{" "}
            <input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              required
              placeholder="0.0000"
            />
          </label>
          <label>
            {" "}
            {t("Reason")}{" "}
            <input
              name="reason"
              minLength={5}
              required
              placeholder={t("Reason for stock transfer…")}
            />
          </label>
          {formError && <p className="error">{t(formError)}</p>}
          <Button className="primary mt">{t("Confirm transfer")}</Button>
        </form>
      </Modal>
      <Modal
        open={modal === "detail"}
        translateTitle={false}
        onClose={() => setModal("")}
        title={
          selected?.number ||
          selected?.name ||
          selected?.subject ||
          t("Record details")
        }
        wide
      >
        {modal === "detail" &&
          selected &&
          (kinds[view] ? (
            <>
              {documentQuery.isPending || documentQuery.isFetching ? (
                <p className="muted">{t("Loading…")}</p>
              ) : documentQuery.isError ? (
                <div className="error" role="alert">
                  {t(documentQuery.error.message)}
                  <Button onClick={() => documentQuery.refetch()}>
                    {t("Retry")}
                  </Button>
                </div>
              ) : (
                documentQuery.data && (
                  <>
                    <div className="detail-heading">
                      <Badge value={documentQuery.data.status} />
                      <strong>{money(documentQuery.data.total)}</strong>
                      <small>
                        {" "}
                        {t("Version")} {documentQuery.data.version} ·{" "}
                        {documentQuery.data.currency}
                      </small>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("Description")}</th>
                            <th>{t("Quantity")}</th>
                            <th>{t("Unit price")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documentQuery.data.lines.map((l: any, i: number) => (
                            <tr key={i}>
                              <td>{l.description}</td>
                              <td>
                                {l.quantity} {enumLabel("unit", l.unit, locale)}
                              </td>
                              <td>{l.unitPrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted">{documentQuery.data.notes}</p>
                    {documentQuery.data.kind === "INVOICE" && (
                      <p>
                        {t("Due date")}:{" "}
                        {documentQuery.data.dueDate
                          ? formatDate(documentQuery.data.dueDate, locale)
                          : t("Undated")}
                      </p>
                    )}
                    {documentQuery.data.lines.some(
                      (line: RecordData) => !line.productId,
                    ) && (
                      <p className="notice">
                        {t(
                          "Catalog lines move stock. Non-stock lines complete with the final delivery or receipt.",
                        )}
                      </p>
                    )}
                    <div className="actions wrap">
                      {documentQuery.data.kind === "INVOICE" &&
                        ["ISSUED", "PARTIALLY_PAID"].includes(
                          documentQuery.data.status,
                        ) &&
                        can(role, "finance:write") && (
                          <Button onClick={() => setModal("credit")}>
                            {t("Issue credit note")}
                          </Button>
                        )}

                      {documentQuery.data.status === "DRAFT" &&
                        (!documentQuery.data.sourceId ||
                          documentQuery.data.kind === "PURCHASE") &&
                        can(role, writePermission) && (
                          <Button onClick={() => setModal("edit-document")}>
                            {" "}
                            {t("Edit draft")}{" "}
                          </Button>
                        )}

                      {documentQuery.data.allowedTransitions.map(
                        (status: string) => (
                          <Button
                            key={status}
                            onClick={() => {
                              if (
                                status === "CANCELLED" &&
                                !window.confirm(
                                  t(
                                    documentQuery.data.kind === "ORDER"
                                      ? "Cancel this order? All remaining stock reservations will be released."
                                      : "Cancel this purchase? No stock will be received.",
                                  ),
                                )
                              )
                                return;
                              void act(
                                `documents/${documentQuery.data.id}/status`,
                                { status },
                              );
                            }}
                          >
                            {status === "FULFILLED" || status === "RECEIVED"
                              ? t("Complete services")
                              : status === "CANCELLED"
                                ? t("Cancel document")
                                : status === "CONFIRMED"
                                  ? t("Confirm order")
                                  : status === "ISSUED"
                                    ? t("Issue invoice")
                                    : t(titleCase(status))}
                          </Button>
                        ),
                      )}
                      {documentQuery.data.kind === "INVOICE" &&
                        documentQuery.data.status === "DRAFT" &&
                        can(role, "finance:write") && (
                          <Button onClick={() => setModal("terms")}>
                            {t("Edit payment terms")}
                          </Button>
                        )}
                      {documentQuery.data.kind === "ORDER" &&
                        ["DRAFT", "CONFIRMED"].includes(
                          documentQuery.data.status,
                        ) &&
                        documentQuery.data.lines.some(
                          (line: RecordData) => line.productId,
                        ) &&
                        can(role, "purchase:write") &&
                        can(role, "cost:read") && (
                          <Button onClick={() => setModal("shortage")}>
                            {t("Purchase shortage")}
                          </Button>
                        )}
                      {documentQuery.data.kind === "QUOTATION" &&
                        documentQuery.data.status === "ACCEPTED" &&
                        can(role, "sales:write") && (
                          <Button
                            className="primary"
                            onClick={() =>
                              act(
                                `documents/${documentQuery.data.id}/convert`,
                                {
                                  kind: "ORDER",
                                },
                              )
                            }
                          >
                            {" "}
                            {t("Convert to sales order")}{" "}
                          </Button>
                        )}
                      {documentQuery.data.kind === "ORDER" &&
                        [
                          "CONFIRMED",
                          "RESERVED",
                          "PROCESSING",
                          "FULFILLED",
                          "PARTIALLY_FULFILLED",
                        ].includes(documentQuery.data.status) &&
                        can(role, "finance:write") && (
                          <Button
                            onClick={() =>
                              act(
                                `documents/${documentQuery.data.id}/convert`,
                                {
                                  kind: "INVOICE",
                                },
                              )
                            }
                          >
                            {" "}
                            {t("Create invoice")}{" "}
                          </Button>
                        )}
                      {documentQuery.data.kind === "QUOTATION" &&
                        can(role, "sales:write") && (
                          <Button
                            onClick={() =>
                              act(
                                `documents/${documentQuery.data.id}/duplicate`,
                                {},
                              )
                            }
                          >
                            {" "}
                            {t("Duplicate")}{" "}
                          </Button>
                        )}
                      <Button
                        onClick={async () => {
                          try {
                            const blob = await api(
                              `documents/${documentQuery.data.id}/pdf`,
                            );
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${documentQuery.data.number}.pdf`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch (e) {
                            setFormError((e as Error).message);
                          }
                        }}
                      >
                        <Download size={15} /> {t("Download PDF")}{" "}
                      </Button>
                    </div>
                    {documentQuery.data.stockProgress.length > 0 &&
                      ((documentQuery.data.kind === "ORDER" &&
                        [
                          "CONFIRMED",
                          "RESERVED",
                          "PROCESSING",
                          "PARTIALLY_FULFILLED",
                        ].includes(documentQuery.data.status) &&
                        can(role, "inventory:write")) ||
                        (documentQuery.data.kind === "PURCHASE" &&
                          ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(
                            documentQuery.data.status,
                          ) &&
                          can(role, "purchase:write"))) && (
                        <StockOperation
                          key={documentQuery.data.id}
                          document={documentQuery.data}
                          api={api}
                          done={done}
                        />
                      )}
                    {documentQuery.data.kind === "INVOICE" &&
                      ["ISSUED", "PARTIALLY_PAID"].includes(
                        documentQuery.data.status,
                      ) &&
                      can(role, "finance:write") && (
                        <form
                          className="inline-operation"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            act("payments", {
                              invoiceId: documentQuery.data.id,
                              amount: f.get("amount"),
                              reference: f.get("reference"),
                              method: "BANK",
                              idempotencyKey: crypto.randomUUID(),
                            });
                          }}
                        >
                          <h3>{t("Record payment")}</h3>
                          <p>
                            {t("Paid:")} {money(documentQuery.data.paid)}
                          </p>
                          <label>
                            {" "}
                            {t("Amount")}{" "}
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                            />
                          </label>
                          <label>
                            {" "}
                            {t("Bank reference")}{" "}
                            <input name="reference" required />
                          </label>
                          <Button className="primary mt">
                            {t("Confirm payment")}
                          </Button>
                        </form>
                      )}
                    {formError && <p className="error">{t(formError)}</p>}
                  </>
                )
              )}
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
                    {" "}
                    {t("Approve budget change")}{" "}
                  </Button>
                )}
              {view === "inquiries" && (
                <>
                  <div className="source-text">{selected.text}</div>
                  {selected.extraction && (
                    <div className="notice">
                      <strong>{t("Human review required")}</strong>
                      <RecordDetails data={selected.extraction} />
                      <Button
                        onClick={async () => {
                          await api(`inquiries/${selected.id}`, "PATCH", {
                            reviewed: true,
                            status: "READY_TO_QUOTE",
                          });
                          done();
                        }}
                      >
                        {" "}
                        {t("Confirm reviewed extraction")}{" "}
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
                      <Sparkles size={15} /> {t("Extract with AI")}{" "}
                      {!me.data.capabilities.ai ? t(" · not configured") : ""}
                    </Button>
                    <Button
                      className="primary"
                      disabled={!!selected.extraction && !selected.reviewed}
                      onClick={() => {
                        navigate("quotations", {
                          modal: "create",
                          record: selected,
                        });
                      }}
                    >
                      {" "}
                      {t("Create quotation")}{" "}
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
                <RecordDetails data={selected} />
              )}
            </>
          ))}
      </Modal>
    </div>
  );
}
