import { zh } from "./zh.ts";
export type Locale = "en" | "zh";
export type Values = Record<string, string | number>;
export function translate(
  text: string,
  locale: Locale,
  values?: Values,
): string {
  let result = locale === "en" ? text : translateChinese(text);
  if (values)
    result = result.replace(/\{(\w+)\}/g, (match, key) =>
      values[key] === undefined ? match : String(values[key]),
    );
  return result;
}
function translateChinese(text: string): string {
  if (zh[text]) return zh[text];
  const trimmed = text.trim();
  if (zh[trimmed]) return text.replace(trimmed, zh[trimmed]);
  const state =
    zh[text.toUpperCase()] || zh[text.toUpperCase().replaceAll(" ", "_")];
  if (state) return state;
  for (const [pattern, format] of patterns) {
    const match = text.match(pattern);
    if (match) return format(match);
  }
  if (text.includes("; "))
    return text.split("; ").map(translateChinese).join("；");
  if (text.includes(": ")) {
    const [field, ...rest] = text.split(": ");
    const tail = rest.join(": "),
      translated = translateChinese(tail);
    if (translated !== tail) return `${fieldLabel(field, "zh")}：${translated}`;
  }
  return text;
}
const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d+) inquiries to review$/, (m) => `${m[1]} 条询价待核对`],
  [/^(\d+) orders in progress$/, (m) => `${m[1]} 份订单处理中`],
  [/^(\d+) active projects$/, (m) => `${m[1]} 个进行中项目`],
  [/^New (.+)$/i, (m) => `新建${resourceLabel(m[1], "zh")}`],
  [/^Import (.+)$/i, (m) => `导入${resourceLabel(m[1], "zh")}`],
  [/^Confirm import \((\d+)\)$/, (m) => `确认导入（${m[1]} 行）`],
  [/^Add API key · (.+)$/, (m) => `添加 API 密钥 · ${m[1]}`],
  [/^Delete key (.+)$/, (m) => `删除密钥 ${m[1]}`],
  [/^Role for (.+)$/, (m) => `${m[1]} 的角色`],
  [/^Verify (.+)$/, (m) => `核对 ${m[1]}`],
  [/^Request failed \((\d+)\)$/, (m) => `请求失败（${m[1]}）`],
  [/^Invitation link: (.+)$/, (m) => `邀请链接：${m[1]}`],
  [
    /^Customer (.+) already exists; no records merged$/,
    (m) => `客户“${m[1]}”已存在，未合并任何记录`,
  ],
  [/^Unknown SKU: (.+)$/, (m) => `未知 SKU：${m[1]}`],
  [/^(.+) not found$/, (m) => `找不到${resourceLabel(m[1], "zh")}`],
  [
    /^Cannot change (\w+) to (\w+)$/,
    (m) =>
      `无法从“${enumLabel("status", m[1], "zh")}”变更为“${enumLabel("status", m[2], "zh")}”`,
  ],
  [
    /^Row (\d+) has (\d+) fields; expected (\d+)$/,
    (m) => `第 ${m[1]} 行有 ${m[2]} 个字段，应有 ${m[3]} 个`,
  ],
  [
    /^Invalid input: expected (\w+), received (\w+)$/,
    (m) => `输入类型无效，应为${translate(m[1], "zh")}`,
  ],
  [
    /^Too small: expected (\w+) to have >=(\d+) characters$/,
    (m) => `至少需要 ${m[2]} 个字符`,
  ],
  [
    /^Too big: expected (\w+) to have <=(\d+) characters$/,
    (m) => `最多允许 ${m[2]} 个字符`,
  ],
  [
    /^Too small: expected (\w+) to be >=([\d.]+)$/,
    (m) => `数值不得小于 ${m[2]}`,
  ],
  [/^Too big: expected (\w+) to be <=([\d.]+)$/, (m) => `数值不得大于 ${m[2]}`],
  [/^Invalid string: must match pattern .+$/, () => "格式无效"],
  [
    /^Invalid option: expected one of (.+)$/,
    (m) =>
      `请选择有效选项：${m[1]
        .split("|")
        .map((v) => translate(v.replaceAll('"', ""), "zh"))
        .join("、")}`,
  ],
];
export const resourceNames: Record<string, string> = {
  dashboard: "Overview",
  inquiries: "Inquiry inbox",
  inquiry: "Inquiry",
  quotations: "Quotations",
  quotation: "Quotation",
  customers: "Customers",
  customer: "Customer",
  orders: "Sales orders",
  order: "Order",
  products: "Product catalog",
  product: "Product",
  inventory: "Inventory",
  warehouses: "Warehouses",
  warehouse: "Warehouse",
  purchases: "Procurement",
  purchase: "Purchase",
  suppliers: "Suppliers",
  supplier: "Supplier",
  movements: "Stock movements",
  cutting: "Cutting optimization",
  fabrication: "Fabrication jobs",
  design: "AI design studio",
  takeoffs: "Drawing takeoff",
  takeoff: "Drawing takeoff",
  projects: "Projects",
  project: "Project",
  tasks: "Tasks & scheduling",
  task: "Task",
  invoices: "Invoices",
  invoice: "Invoice",
  payments: "Payments",
  payment: "Payment",
  expenses: "Expenses",
  expense: "Expense",
  analytics: "Analytics",
  assistant: "AI assistant",
  team: "Team & permissions",
  settings: "Settings & integrations",
  audit: "Audit log",
  "tax-rates": "Tax rates",
  "credit-notes": "Credit notes",
  "change-orders": "Change orders",
  file: "File",
  fileAsset: "File",
  document: "Document",
  organization: "Organization",
  membership: "Membership",
  "ai.provider": "AI provider",
  "ai.key": "API key",
};
export function resourceLabel(key: string, locale: Locale) {
  return translate(
    resourceNames[key] ||
      Object.values(resourceNames).find(
        (name) => name.toLowerCase() === key.toLowerCase(),
      ) ||
      key,
    locale,
  );
}
export const fieldNames: Record<string, string> = {
  id: "Record ID",
  idempotencyKey: "Request ID",
  mime: "File type",
  size: "File size",
  path: "Storage path",
  detail: "Details",
  requestId: "Request ID",
  width: "Width (mm)",
  height: "Height (mm)",
  thickness: "Thickness (mm)",
  length: "Length (mm)",
  density: "Density (kg/m³)",
  finish: "Surface finish",
  emailVerified: "Email verified",
  country: "Country / region code",
  businessType: "Business type",
  locale: "Language",
  organizationId: "Organization",
  createdBy: "Created by",
  updatedBy: "Updated by",
  name: "Name",
  email: "Email",
  phone: "Phone",
  type: "Type",
  address: "Address",
  notes: "Notes",
  tags: "Tags",
  creditLimit: "Credit limit",
  sku: "SKU",
  material: "Material",
  grade: "Grade",
  profile: "Material profile",
  unit: "Unit",
  specifications: "Specifications",
  cost: "Unit cost",
  price: "Selling price",
  reorderPoint: "Reorder threshold",
  customerId: "Customer",
  supplierId: "Supplier",
  subject: "Subject",
  text: "Text",
  source: "Source",
  status: "Status",
  createdAt: "Created",
  updatedAt: "Updated",
  requestedDate: "Requested date",
  dueDate: "Due date",
  validUntil: "Valid until",
  budget: "Budget",
  projectId: "Project",
  category: "Category",
  amount: "Amount",
  date: "Date",
  orderId: "Sales order ID",
  number: "Number",
  currency: "Currency",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  taxRate: "Tax rate (%)",
  total: "Total",
  paid: "Paid",
  credited: "Credited",
  product: "Product",
  warehouse: "Warehouse",
  productId: "Product",
  warehouseId: "Warehouse",
  fromWarehouseId: "Source warehouse",
  toWarehouseId: "Destination warehouse",
  onHand: "On hand",
  reserved: "Reserved",
  available: "Available",
  quantity: "Quantity",
  reference: "Reference",
  method: "Method",
  kind: "Type",
  action: "Action",
  entityId: "Record ID",
  invoiceId: "Invoice",
  reason: "Reason",
  rate: "Rate (%)",
  active: "Active",
  reviewed: "Reviewed",
  extraction: "Extracted fields",
  widthMm: "Width (mm)",
  heightMm: "Height (mm)",
  thicknessMm: "Thickness (mm)",
  lengthMm: "Length (mm)",
  missing: "Missing information",
  uncertainties: "Uncertainties",
  model: "Model",
  fileId: "File",
  disclaimer: "Note",
  measurements: "Measurements",
  scale: "Scale",
  points: "Points",
  x: "X coordinate",
  y: "Y coordinate",
  unitPrice: "Unit price",
  description: "Description",
  verified: "Verified",
  lines: "Line items",
  assignedTo: "Assigned to",
  cutPlan: "Cutting plan",
  algorithm: "Algorithm",
  patterns: "Cutting patterns",
  cuts: "Cuts",
  remaining: "Remaining length",
  stockPieces: "Stock pieces",
  waste: "Non-product material",
  utilization: "Utilization",
  offcuts: "Reusable offcuts",
  version: "Version",
  sourceId: "Source record",
  inquiryId: "Inquiry",
  label: "Label",
  enabled: "Enabled",
  input: "Input",
  result: "Result",
  usage: "Usage",
  error: "Error",
  priority: "Priority",
  protocol: "API protocol",
  baseUrl: "Base URL",
  apiKey: "API key",
  textModel: "Text model ID",
  imageModel: "Image model ID (optional)",
  dailyRequestLimit: "Daily request limit",
  dailyTokenLimit: "Daily token threshold",
  role: "Role",
  due: "Due date",
  inputTokens: "Input tokens",
  outputTokens: "Output tokens",
  totalTokens: "Total tokens",
  input_tokens: "Input tokens",
  output_tokens: "Output tokens",
  total_tokens: "Total tokens",
};
export function fieldLabel(key: string, locale: Locale) {
  if (/^\d+$/.test(key)) return `${Number(key) + 1}`;
  return key
    .split(".")
    .map((part) =>
      /^\d+$/.test(part)
        ? String(Number(part) + 1)
        : translate(fieldNames[part] || part, locale),
    )
    .join(locale === "zh" ? " · " : " · ");
}
const movements: Record<string, string> = {
  ADJUSTMENT: "Stock adjustment",
  FULFILLMENT: "Order fulfillment",
  RECEIPT: "Goods receipt",
  TRANSFER: "Stock transfer",
  IMPORT: "Stock import",
  DEMO_SEED: "Demo opening stock",
};
export function enumLabel(
  field: string,
  value: unknown,
  locale: Locale,
): string {
  const text = String(value);
  if (typeof value === "boolean")
    return translate(value ? "Yes" : "No", locale);
  if (locale === "en") return text;
  if (field === "profile" && text === "sheet") return "薄板";
  if (field === "kind" && movements[text])
    return translate(movements[text], locale);
  const result = translate(text, locale);
  if (result !== text) return result;
  const aliases: Record<string, string> = {
    "stainless steel": "Stainless steel",
    "square tube": "square-tube",
    "rectangular tube": "rectangular-tube",
    "round tube": "round-tube",
    "solid bar": "solid-bar",
  };
  return translate(
    aliases[text.toLowerCase()] || text.toLowerCase(),
    locale,
  ) === (aliases[text.toLowerCase()] || text.toLowerCase())
    ? text
    : translate(aliases[text.toLowerCase()] || text.toLowerCase(), locale);
}
const actionEntities: Record<string, string> = {
  ...resourceNames,
  customers: "Customer",
  products: "Product",
  inquiries: "Inquiry",
  tasks: "Task",
  projects: "Project",
  warehouses: "Warehouse",
  suppliers: "Supplier",
  fabrication: "Fabrication job",
  "tax-rates": "Tax rate",
  "change-orders": "Project change",
  "document.convert": "Document",
  "project.change": "Project change",
  membership: "Membership",
};
const verbs: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  revise: "Revise",
  role: "Change role",
  reserve: "Reserve stock",
  fulfill: "Fulfill order",
  record: "Record payment",
  receive: "Receive materials",
  transfer: "Transfer stock",
  adjust: "Adjust stock",
  shortage: "Purchase shortage",
  credit: "Issue credit note",
  approve: "Approve",
  approved: "Approve",
  pending_approval: "Submit for approval",
  sent: "Mark as sent",
  accepted: "Accept",
  rejected: "Reject",
  cancelled: "Cancel",
  confirmed: "Confirm",
  issued: "Issue",
  processing: "Start processing",
  converted: "Convert",
  expired: "Mark as expired",
};
export function actionLabel(action: string, locale: Locale) {
  const direct: Record<string, string> = {
    "inventory.reserve": "Reserve stock",
    "inventory.adjust": "Adjust stock",
    "inventory.transfer": "Transfer stock",
    "order.fulfill": "Fulfill order",
    "payment.record": "Record payment",
    "purchase.receive": "Receive materials",
    "purchase.shortage": "Create shortage purchase",
    "invoice.credit": "Issue credit note",
    "project.change.approve": "Approve budget change",
    "membership.role": "Change member role",
    "organization.update": "Update organization settings",
    "document.revise": "Revise document",
  };
  if (direct[action]) return translate(direct[action], locale);

  if (action.startsWith("document.convert."))
    return translate(
      action.endsWith("order") ? "Convert to sales order" : "Create invoice",
      locale,
    );
  if (action.startsWith("import."))
    return `${translate("Import", locale)}${locale === "en" ? " " : ""}${resourceLabel(action.slice(7), locale)}`;
  const parts = action.split("."),
    verb = parts.pop() || "",
    entity = parts.join(".");
  if (actionEntities[entity] && verbs[verb])
    return `${translate(verbs[verb], locale)}${locale === "en" ? " " : ["create", "update", "delete", "revise"].includes(verb) ? "" : " · "}${translate(actionEntities[entity], locale)}`;
  return locale === "zh"
    ? translate(action.replaceAll(".", " "), locale)
    : action.replaceAll(/[._]/g, " ");
}
export const localeTag = (locale: Locale) =>
  locale === "zh" ? "zh-CN" : "en-US";
export function formatDate(
  value: string | Date,
  locale: Locale,
  kind: "date" | "time" | "datetime" = "date",
) {
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  const options: Intl.DateTimeFormatOptions =
    kind === "time"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : kind === "datetime"
        ? {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        : { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
}
export function formatNumber(
  value: string | number | bigint,
  locale: Locale,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 4 },
) {
  return new Intl.NumberFormat(localeTag(locale), options).format(
    typeof value === "string" ? Number(value) : value,
  );
}
export function apiError(payload: any, locale: Locale, status: number) {
  const issues = payload?.error?.issues;
  if (locale === "zh" && Array.isArray(issues) && issues.length) {
    return issues
      .map((issue: any) => {
        const field = fieldLabel((issue.path || []).join("."), locale);
        let message: string;
        switch (issue.code) {
          case "invalid_type":
            message = "请填写有效的" + translate(String(issue.expected), "zh");
            break;
          case "too_small":
            message =
              issue.origin === "string"
                ? `至少需要 ${issue.minimum} 个字符`
                : issue.origin === "array"
                  ? `至少需要 ${issue.minimum} 项`
                  : `不得小于 ${issue.minimum}`;
            break;
          case "too_big":
            message =
              issue.origin === "string"
                ? `最多允许 ${issue.maximum} 个字符`
                : issue.origin === "array"
                  ? `最多允许 ${issue.maximum} 项`
                  : `不得大于 ${issue.maximum}`;
            break;
          case "invalid_value":
            message = "请选择有效选项";
            break;
          case "invalid_format":
            message =
              issue.format === "email"
                ? "邮箱格式无效"
                : issue.format === "uuid"
                  ? "记录标识无效"
                  : "格式无效";
            break;
          default:
            message = translate(issue.message || "Invalid input", locale);
        }
        return `${field ? field + "：" : ""}${message}`;
      })
      .join("；");
  }
  const message = payload?.error?.message || payload?.message;
  return translate(
    typeof message === "string" ? message : `Request failed (${status})`,
    locale,
  );
}
