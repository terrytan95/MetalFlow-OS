export type RecordData = Record<string, any>;
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  resource?: string;
  default?: string;
};
export const config: Record<
  string,
  {
    title: string;
    zh: string;
    description: string;
    fields: Field[];
    columns: string[];
    permission: string;
  }
> = {
  "change-orders": {
    title: "Project change orders",
    zh: "项目变更单",
    description:
      "Approved scope changes update the project budget with an audit trail.",
    permission: "projects:write",
    columns: ["name", "projectId", "amount", "status"],
    fields: [
      { key: "name", label: "Change title", required: true },
      {
        key: "projectId",
        label: "Project",
        resource: "projects",
        required: true,
      },
      { key: "amount", label: "Budget change amount", required: true },
      { key: "reason", label: "Reason", type: "textarea", required: true },
    ],
  },
  customers: {
    title: "Customers",
    zh: "客户",
    description:
      "Relationships, commercial history and the people behind every order.",
    permission: "sales:write",
    columns: ["name", "email", "phone", "type"],
    fields: [
      { key: "name", label: "Customer name", required: true },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      {
        key: "type",
        label: "Customer type",
        options: [
          "BUSINESS",
          "INDIVIDUAL",
          "CONTRACTOR",
          "DISTRIBUTOR",
          "DEVELOPER",
          "DESIGNER",
        ],
      },
      { key: "address", label: "Address" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  products: {
    title: "Product catalog",
    zh: "产品目录",
    description:
      "Precise specifications. Consistent units. One source of truth.",
    permission: "inventory:write",
    columns: ["sku", "name", "material", "profile", "unit", "price"],
    fields: [
      { key: "sku", label: "SKU", required: true },
      { key: "name", label: "Product name", required: true },
      {
        key: "material",
        label: "Material",
        options: ["Stainless steel", "Aluminum", "Steel", "Other"],
      },
      { key: "grade", label: "Grade" },
      {
        key: "profile",
        label: "Profile",
        options: [
          "square-tube",
          "rectangular-tube",
          "round-tube",
          "sheet",
          "plate",
          "solid-bar",
          "angle",
          "channel",
          "extrusion",
          "accessory",
        ],
      },
      {
        key: "unit",
        label: "Stock / pricing unit",
        options: [
          "piece",
          "m",
          "ft",
          "kg",
          "lb",
          "m2",
          "ft2",
          "sheet",
          "custom",
        ],
      },
      { key: "price", label: "Selling price", type: "number", required: true },
      { key: "cost", label: "Unit cost", type: "number", default: "0" },
      {
        key: "reorderPoint",
        label: "Reorder threshold",
        type: "number",
        default: "0",
      },
      {
        key: "specifications",
        label: "Specifications (JSON; dimensions in mm)",
        type: "json",
        default: "{}",
      },
    ],
  },
  inquiries: {
    title: "Inquiry inbox",
    zh: "询价收件箱",
    description:
      "Turn customer requirements into clear, reviewable quotations.",
    permission: "sales:write",
    columns: ["subject", "customerId", "source", "status", "createdAt"],
    fields: [
      { key: "subject", label: "Subject", required: true },
      {
        key: "customerId",
        label: "Customer",
        resource: "customers",
        required: true,
      },
      {
        key: "source",
        label: "Source",
        options: ["MANUAL", "EMAIL", "PHONE", "WHATSAPP", "CSV"],
      },
      {
        key: "text",
        label: "Original inquiry",
        type: "textarea",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        options: [
          "NEW",
          "REVIEWING",
          "AWAITING_INFORMATION",
          "READY_TO_QUOTE",
          "QUOTED",
          "CLOSED",
        ],
      },
    ],
  },
  suppliers: {
    title: "Suppliers",
    zh: "供应商",
    description: "Your supply network, organized and connected.",
    permission: "purchase:write",
    columns: ["name", "email", "phone"],
    fields: [
      { key: "name", label: "Supplier name", required: true },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  warehouses: {
    title: "Warehouses",
    zh: "仓库",
    description: "Know where your materials are stored.",
    permission: "inventory:write",
    columns: ["name", "address"],
    fields: [
      { key: "name", label: "Warehouse name", required: true },
      { key: "address", label: "Address" },
    ],
  },
  projects: {
    title: "Renovation projects",
    zh: "装修项目",
    description: "Keep scope, budget and delivery moving together.",
    permission: "projects:write",
    columns: ["name", "customerId", "status", "budget", "dueDate"],
    fields: [
      { key: "name", label: "Project name", required: true },
      {
        key: "customerId",
        label: "Customer",
        resource: "customers",
        required: true,
      },
      { key: "address", label: "Site address" },
      { key: "budget", label: "Budget", type: "number", required: true },
      {
        key: "status",
        label: "Status",
        options: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"],
      },
      { key: "dueDate", label: "Due date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  tasks: {
    title: "Tasks & scheduling",
    zh: "任务与排期",
    description: "Small commitments. Clear ownership. Visible progress.",
    permission: "projects:write",
    columns: ["name", "projectId", "status", "dueDate"],
    fields: [
      { key: "name", label: "Task name", required: true },
      { key: "projectId", label: "Project", resource: "projects" },
      {
        key: "status",
        label: "Status",
        options: ["TODO", "IN_PROGRESS", "DONE"],
      },
      { key: "dueDate", label: "Due date", type: "date" },
    ],
  },
  expenses: {
    title: "Expenses",
    zh: "费用",
    description: "Trace operational and project costs.",
    permission: "finance:write",
    columns: ["name", "category", "amount", "date", "projectId"],
    fields: [
      { key: "name", label: "Description", required: true },
      {
        key: "category",
        label: "Category",
        options: ["Materials", "Labor", "Transport", "Equipment", "Other"],
      },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "projectId", label: "Project", resource: "projects" },
    ],
  },
  fabrication: {
    title: "Fabrication jobs",
    zh: "加工工单",
    description: "From material preparation to finished work.",
    permission: "fabrication:write",
    columns: ["name", "status", "orderId", "createdAt"],
    fields: [
      { key: "name", label: "Job name", required: true },
      { key: "orderId", label: "Sales order ID" },
      {
        key: "status",
        label: "Status",
        options: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      },
      { key: "notes", label: "Work instructions", type: "textarea" },
    ],
  },
};
export const groups = [
  {
    label: "Overview",
    items: [
      ["dashboard", "Overview", "概览"],
      ["inquiries", "Inquiry inbox", "询价收件箱"],
      ["tasks", "Tasks & approvals", "任务与审批"],
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      ["quotations", "Quotations", "报价"],
      ["customers", "Customers", "客户"],
      ["orders", "Sales orders", "销售订单"],
      ["products", "Product catalog", "产品目录"],
    ],
  },
  {
    label: "Supply chain",
    items: [
      ["inventory", "Inventory", "库存"],
      ["warehouses", "Warehouses", "仓库"],
      ["purchases", "Procurement", "采购"],
      ["suppliers", "Suppliers", "供应商"],
      ["movements", "Stock movements", "库存流水"],
    ],
  },
  {
    label: "Operations",
    items: [
      ["cutting", "Cutting optimization", "切割优化"],
      ["fabrication", "Fabrication jobs", "加工工单"],
      ["design", "AI design studio", "AI 设计"],
      ["takeoffs", "Drawing takeoff", "图纸算量"],
      ["projects", "Projects", "项目"],
      ["change-orders", "Change orders", "项目变更"],
    ],
  },
  {
    label: "Finance & intelligence",
    items: [
      ["invoices", "Invoices", "发票"],
      ["payments", "Payments", "收款"],
      ["expenses", "Expenses", "费用"],
      ["analytics", "Analytics", "分析"],
      ["assistant", "AI assistant", "AI 助手"],
    ],
  },
  {
    label: "Administration",
    items: [
      ["team", "Team & permissions", "团队权限"],
      ["settings", "Settings & integrations", "设置与集成"],
      ["audit", "Audit log", "审计日志"],
    ],
  },
];
export const kinds: Record<string, string> = {
  quotations: "QUOTATION",
  orders: "ORDER",
  purchases: "PURCHASE",
  invoices: "INVOICE",
};
export const grants: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: ["*"],
  SALES_MANAGER: ["read", "sales:write", "sales:approve", "cost:read"],
  SALES_REP: ["read", "sales:write"],
  WAREHOUSE_MANAGER: ["read", "inventory:write"],
  PROCUREMENT_MANAGER: [
    "read",
    "purchase:write",
    "purchase:approve",
    "cost:read",
  ],
  FABRICATION_OPERATOR: ["read", "fabrication:write"],
  PROJECT_MANAGER: ["read", "projects:write"],
  ACCOUNTANT: ["read", "finance:read", "finance:write", "cost:read"],
  VIEWER: ["read"],
};
export const can = (role: string, p: string) =>
  grants[role]?.some((x) => x === "*" || x === p) || false;
export const titleCase = (v: string) => {
  const text =
    v === v.toUpperCase()
      ? v.toLowerCase().replaceAll("_", " ")
      : v.replace(/([A-Z])/g, " $1").replaceAll("_", " ");
  return text.replace(/^./, (s) => s.toUpperCase());
};
