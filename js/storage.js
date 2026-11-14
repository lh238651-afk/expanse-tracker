/**
 * Centralized Data Storage & Pure Financial Calculation Module
 *
 * Isolates all LocalStorage persistence behind clean data repository methods
 * so future migration to a REST API (Node.js/Express/SQL) only modifies
 * this module without touching UI rendering logic.
 */

export const STORAGE_KEYS = {
  TRANSACTIONS: "clearledger_transactions",
  BUDGET: "clearledger_budget",
  INITIALIZED: "clearledger_initialized",
};

export const EXPENSE_CATEGORIES = [
  "Food",
  "Housing",
  "Transport",
  "Utilities",
  "Healthcare",
  "Shopping",
  "Entertainment",
  "Education",
  "Other",
];

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investments",
  "Gift",
  "Refund",
  "Other",
];

export const CATEGORY_COLORS = {
  Food: "#1d4ed8",
  Housing: "#0f766e",
  Transport: "#d97706",
  Utilities: "#475569",
  Healthcare: "#dc2626",
  Shopping: "#7c3aed",
  Entertainment: "#db2777",
  Education: "#0284c7",
  Other: "#64748b",
  Salary: "#16a34a",
  Freelance: "#059669",
  Investments: "#0d9488",
  Gift: "#2563eb",
  Refund: "#65a30d",
};

const DEFAULT_BUDGET_LIMIT = 3200;

/**
 * Generates a unique transaction identifier.
 */
export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * Returns today's date in YYYY-MM-DD using local calendar date.
 */
export function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns current YYYY-MM string.
 */
export function getCurrentYearMonth() {
  return getTodayISO().slice(0, 7);
}

/**
 * Normalizes and validates a raw transaction object against the schema.
 */
function normalizeTransaction(raw) {
  if (!raw || typeof raw !== "object") return null;

  const type = raw.type === "income" ? "income" : "expense";
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : getTodayISO();

  return {
    id: String(raw.id || generateId()),
    title: String(raw.title || "Untitled").trim().slice(0, 80),
    amount: Math.round(amount * 100) / 100,
    category: String(raw.category || "Other").trim(),
    type,
    date,
    description: String(raw.description || "").trim().slice(0, 200),
  };
}

/**
 * Builds sample transactions anchored to the current month so initial dashboards
 * reflect realistic, immediately inspectable figures.
 */
function createSampleTransactions() {
  const today = new Date();
  const shiftMonth = (offset, day) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(day, maxDay);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(clampedDay).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  return [
    {
      id: generateId(),
      title: "Monthly Salary",
      amount: 5400,
      category: "Salary",
      type: "income",
      date: shiftMonth(0, 1),
      description: "Primary payroll direct deposit",
    },
    {
      id: generateId(),
      title: "Apartment Rent",
      amount: 1450,
      category: "Housing",
      type: "expense",
      date: shiftMonth(0, 2),
      description: "Monthly lease payment",
    },
    {
      id: generateId(),
      title: "Electric & Fiber Internet",
      amount: 168.4,
      category: "Utilities",
      type: "expense",
      date: shiftMonth(0, 4),
      description: "Monthly utility and broadband bill",
    },
    {
      id: generateId(),
      title: "UI Advisory Retainer",
      amount: 850,
      category: "Freelance",
      type: "income",
      date: shiftMonth(0, 6),
      description: "Design systems consulting invoice #204",
    },
    {
      id: generateId(),
      title: "Trader Joe's Market",
      amount: 184.25,
      category: "Food",
      type: "expense",
      date: shiftMonth(0, 7),
      description: "Weekly produce, pantry staples, and coffee",
    },
    {
      id: generateId(),
      title: "Metro Pass & Fuel",
      amount: 112.0,
      category: "Transport",
      type: "expense",
      date: shiftMonth(0, 9),
      description: "Commuter transit reload and unleaded fuel",
    },
    {
      id: generateId(),
      title: "Dental Checkup Copay",
      amount: 95.0,
      category: "Healthcare",
      type: "expense",
      date: shiftMonth(0, 10),
      description: "Routine cleaning and exam",
    },
    {
      id: generateId(),
      title: "Grocery Shopping",
      amount: 142.8,
      category: "Food",
      type: "expense",
      date: getTodayISO(),
      description: "Weekly groceries and household supplies",
    },
    {
      id: generateId(),
      title: "Office Desk Lamp",
      amount: 78.5,
      category: "Shopping",
      type: "expense",
      date: shiftMonth(0, 11),
      description: "LED task lamp for workspace",
    },
    {
      id: generateId(),
      title: "Monthly Salary",
      amount: 5400,
      category: "Salary",
      type: "income",
      date: shiftMonth(-1, 1),
      description: "Primary payroll direct deposit",
    },
    {
      id: generateId(),
      title: "Apartment Rent",
      amount: 1450,
      category: "Housing",
      type: "expense",
      date: shiftMonth(-1, 2),
      description: "Monthly lease payment",
    },
    {
      id: generateId(),
      title: "Whole Foods & Dining",
      amount: 465.3,
      category: "Food",
      type: "expense",
      date: shiftMonth(-1, 14),
      description: "Groceries and weekend dinner",
    },
    {
      id: generateId(),
      title: "Concert & Cinema",
      amount: 138.0,
      category: "Entertainment",
      type: "expense",
      date: shiftMonth(-1, 20),
      description: "Two tickets and streaming subscriptions",
    },
    {
      id: generateId(),
      title: "Index Fund Dividend",
      amount: 310.0,
      category: "Investments",
      type: "income",
      date: shiftMonth(-2, 15),
      description: "Quarterly ETF distribution",
    },
    {
      id: generateId(),
      title: "Monthly Salary",
      amount: 5400,
      category: "Salary",
      type: "income",
      date: shiftMonth(-2, 1),
      description: "Primary payroll direct deposit",
    },
    {
      id: generateId(),
      title: "Apartment Rent",
      amount: 1450,
      category: "Housing",
      type: "expense",
      date: shiftMonth(-2, 2),
      description: "Monthly lease payment",
    },
    {
      id: generateId(),
      title: "Online Course Renewal",
      amount: 240.0,
      category: "Education",
      type: "expense",
      date: shiftMonth(-2, 18),
      description: "Annual architecture workshop pass",
    },
  ];
}

/* ==========================================================================
   Data Repository API (Future REST API replacement boundary)
   ========================================================================== */

export function seedInitialDataIfNeeded() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const sample = createSampleTransactions();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
      localStorage.setItem(
        STORAGE_KEYS.BUDGET,
        JSON.stringify({ monthlyLimit: DEFAULT_BUDGET_LIMIT, updatedAt: new Date().toISOString() })
      );
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
    }
  } catch (err) {
    console.error("Failed to initialize storage:", err);
  }
}

export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction).filter(Boolean);
  } catch (err) {
    console.error("Failed to read transactions from LocalStorage:", err);
    return [];
  }
}

export function getTransactionById(id) {
  return getTransactions().find((tx) => tx.id === id) || null;
}

export function saveTransaction(transactionInput) {
  const normalized = normalizeTransaction({
    ...transactionInput,
    id: generateId(),
  });
  if (!normalized) {
    throw new Error("Invalid transaction payload.");
  }
  const existing = getTransactions();
  const next = [normalized, ...existing];
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(next));
  return normalized;
}

export function updateTransaction(id, updates) {
  const existing = getTransactions();
  const index = existing.findIndex((tx) => tx.id === id);
  if (index === -1) return null;

  const merged = normalizeTransaction({
    ...existing[index],
    ...updates,
    id,
  });
  if (!merged) {
    throw new Error("Invalid transaction update payload.");
  }
  existing[index] = merged;
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(existing));
  return merged;
}

export function deleteTransaction(id) {
  const existing = getTransactions();
  const filtered = existing.filter((tx) => tx.id !== id);
  if (filtered.length === existing.length) return false;
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
  return true;
}

export function getBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { monthlyLimit: DEFAULT_BUDGET_LIMIT, updatedAt: null };
    }
    const parsed = JSON.parse(raw);
    const limit = Number(parsed?.monthlyLimit);
    return {
      monthlyLimit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_BUDGET_LIMIT,
      updatedAt: parsed?.updatedAt || null,
    };
  } catch (err) {
    console.error("Failed to read budget from LocalStorage:", err);
    return { monthlyLimit: DEFAULT_BUDGET_LIMIT, updatedAt: null };
  }
}

export function saveBudget(monthlyLimit) {
  const numeric = Number(monthlyLimit);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Budget must be a positive number.");
  }
  const payload = {
    monthlyLimit: Math.round(numeric * 100) / 100,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(payload));
  return payload;
}

export function clearAllData() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
}

export function resetToSampleData() {
  const sample = createSampleTransactions();
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
  localStorage.setItem(
    STORAGE_KEYS.BUDGET,
    JSON.stringify({ monthlyLimit: DEFAULT_BUDGET_LIMIT, updatedAt: new Date().toISOString() })
  );
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
}

export function exportTransactionsCSV(transactions) {
  const headers = ["ID", "Date", "Title", "Type", "Category", "Amount", "Description"];
  const escapeCSV = (val) => {
    const str = String(val ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = transactions.map((tx) =>
    [tx.id, tx.date, tx.title, tx.type, tx.category, tx.amount.toFixed(2), tx.description]
      .map(escapeCSV)
      .join(",")
  );
  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clearledger-transactions-${getTodayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   Pure Calculation & Formatting Helpers (Independent of LocalStorage)
   ========================================================================== */

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(amount, showSign = false) {
  const num = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${absFormatted}`;
  if (showSign && num > 0) return `+${absFormatted}`;
  return absFormatted;
}

export function formatDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || "—";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
}

export function formatMonthLabel(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth || "";
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export function formatMonthShort(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth || "";
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(y, m - 1, 1));
}

export function getAvailableMonths(transactions, activeMonth) {
  const set = new Set([getCurrentYearMonth()]);
  if (activeMonth && /^\d{4}-\d{2}$/.test(activeMonth)) {
    set.add(activeMonth);
  }
  transactions.forEach((tx) => {
    if (tx.date && tx.date.length >= 7) {
      set.add(tx.date.slice(0, 7));
    }
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/**
 * Calculates overall and selected-month financial totals dynamically.
 * Total Balance = Total Income - Total Expenses.
 */
export function calculateFinancialSummary(transactions, selectedMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyCount = 0;

  for (const tx of transactions) {
    const isSelectedMonth = selectedMonth ? tx.date.startsWith(selectedMonth) : false;
    if (tx.type === "income") {
      totalIncome += tx.amount;
      if (isSelectedMonth) {
        monthlyIncome += tx.amount;
        monthlyCount += 1;
      }
    } else {
      totalExpenses += tx.amount;
      if (isSelectedMonth) {
        monthlyExpenses += tx.amount;
        monthlyCount += 1;
      }
    }
  }

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    monthlyIncome,
    monthlyExpenses,
    monthlyBalance: monthlyIncome - monthlyExpenses,
    monthlyCount,
  };
}

/**
 * Groups transactions by category for a given type ("expense" | "income").
 */
export function calculateCategoryBreakdown(transactions, type = "expense") {
  const map = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    grandTotal += tx.amount;
    const prev = map.get(tx.category) || { category: tx.category, total: 0, count: 0 };
    prev.total += tx.amount;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[item.category] || "#64748b",
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Generates chronological monthly income vs expense series for the last N months.
 */
export function calculateMonthlySeries(transactions, monthCount = 6, anchorMonth = getCurrentYearMonth()) {
  const [y, m] = anchorMonth.split("-").map(Number);
  const months = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(ym);
  }

  const bucket = new Map(months.map((ym) => [ym, { income: 0, expense: 0 }]));
  for (const tx of transactions) {
    const ym = tx.date.slice(0, 7);
    if (!bucket.has(ym)) continue;
    const entry = bucket.get(ym);
    if (tx.type === "income") {
      entry.income += tx.amount;
    } else {
      entry.expense += tx.amount;
    }
  }

  return {
    months,
    labels: months.map(formatMonthShort),
    incomeSeries: months.map((ym) => Math.round(bucket.get(ym).income * 100) / 100),
    expenseSeries: months.map((ym) => Math.round(bucket.get(ym).expense * 100) / 100),
    savingsSeries: months.map(
      (ym) => Math.round((bucket.get(ym).income - bucket.get(ym).expense) * 100) / 100
    ),
  };
}

/**
 * Evaluates monthly budget utilization and warning/exceeded states.
 */
export function calculateBudgetStatus(monthlyExpenses, monthlyLimit) {
  const limit = Math.max(0, Number(monthlyLimit) || 0);
  const spent = Math.max(0, Number(monthlyExpenses) || 0);
  const remaining = limit - spent;
  const utilization = limit > 0 ? (spent / limit) * 100 : 0;

  let level = "nominal";
  if (utilization >= 100) {
    level = "exceeded";
  } else if (utilization >= 80) {
    level = "warning";
  }

  return {
    limit,
    spent,
    remaining,
    utilization,
    level,
  };
}
