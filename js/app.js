/**
 * ClearLedger Main Application Controller
 *
 * Coordinates view routing, modal dialogs, state synchronization,
 * and delegates rendering to feature modules.
 */

import { renderAnalyticsView } from "./analytics.js";
import { renderBudgetView } from "./budget.js";
import { renderDashboardView } from "./dashboard.js";
import {
  clearAllData,
  deleteTransaction,
  exportTransactionsCSV,
  formatMonthLabel,
  getAvailableMonths,
  getBudget,
  getCurrentYearMonth,
  getTodayISO,
  getTransactionById,
  getTransactions,
  resetToSampleData,
  saveBudget,
  saveTransaction,
  seedInitialDataIfNeeded,
  updateTransaction,
} from "./storage.js";
import {
  populateCategoryOptions,
  renderTransactionsView,
  validateTransactionForm,
} from "./transactions.js";

const VIEW_TITLES = {
  dashboard: "Dashboard",
  transactions: "Transactions",
  analytics: "Analytics",
  budget: "Budget",
};

const state = {
  currentView: "dashboard",
  selectedMonth: getCurrentYearMonth(),
  analyticsPeriod: "month",
  transactions: [],
  budget: { monthlyLimit: 3200, updatedAt: null },
  txFilters: {
    search: "",
    type: "all",
    category: "all",
    monthScope: "all",
    sort: "date-desc",
  },
  editingTransactionId: null,
  confirmAction: null,
};

const dom = {
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  sidebarOpenBtn: document.getElementById("sidebar-open-btn"),
  sidebarCloseBtn: document.getElementById("sidebar-close-btn"),
  navItems: document.querySelectorAll(".nav-item[data-view]"),
  viewTitle: document.getElementById("view-title"),
  monthSelect: document.getElementById("global-month-select"),
  openAddBtn: document.getElementById("btn-open-add-modal"),
  exportCsvBtn: document.getElementById("btn-export-csv"),
  resetSampleBtn: document.getElementById("btn-reset-sample"),
  clearDataBtn: document.getElementById("btn-clear-data"),
  views: {
    dashboard: document.getElementById("view-dashboard"),
    transactions: document.getElementById("view-transactions"),
    analytics: document.getElementById("view-analytics"),
    budget: document.getElementById("view-budget"),
  },
  txModal: document.getElementById("transaction-modal"),
  txModalTitle: document.getElementById("tx-modal-title"),
  txModalClose: document.getElementById("tx-modal-close"),
  txModalCancel: document.getElementById("tx-modal-cancel"),
  txForm: document.getElementById("transaction-form"),
  txIdInput: document.getElementById("tx-id"),
  txTypeInput: document.getElementById("tx-type"),
  txTypeButtons: document.querySelectorAll("[data-tx-type]"),
  txTitleInput: document.getElementById("tx-title"),
  txAmountInput: document.getElementById("tx-amount"),
  txCategorySelect: document.getElementById("tx-category"),
  txDateInput: document.getElementById("tx-date"),
  txDescInput: document.getElementById("tx-description"),
  txSubmitBtn: document.getElementById("tx-modal-submit"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-modal-title"),
  confirmMessage: document.getElementById("confirm-modal-message"),
  confirmClose: document.getElementById("confirm-modal-close"),
  confirmCancel: document.getElementById("confirm-modal-cancel"),
  confirmAccept: document.getElementById("confirm-modal-accept"),
  toastRegion: document.getElementById("toast-region"),
};

/* ==========================================================================
   Initialization & State Refresh
   ========================================================================== */

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function syncDataFromStorage() {
  state.transactions = getTransactions();
  state.budget = getBudget();
  renderMonthSelector();
}

function renderMonthSelector() {
  const months = getAvailableMonths(state.transactions, state.selectedMonth);
  dom.monthSelect.innerHTML = months
    .map((ym) => `<option value="${ym}">${formatMonthLabel(ym)}</option>`)
    .join("");
  dom.monthSelect.value = state.selectedMonth;
}

function showToast(message, variant = "success") {
  if (!dom.toastRegion) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.setAttribute("role", "status");
  const iconName = variant === "error" ? "alert-circle" : "check-circle-2";
  toast.innerHTML = `<i data-lucide="${iconName}"></i><span></span>`;
  toast.querySelector("span").textContent = message;
  dom.toastRegion.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

/* ==========================================================================
   View Routing & Rendering
   ========================================================================== */

function navigateTo(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  state.currentView = viewName;

  dom.navItems.forEach((btn) => {
    const isActive = btn.getAttribute("data-view") === viewName;
    btn.classList.toggle("active", isActive);
    if (isActive) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });

  if (dom.viewTitle) {
    dom.viewTitle.textContent = VIEW_TITLES[viewName];
  }

  Object.entries(dom.views).forEach(([key, el]) => {
    if (!el) return;
    const isCurrent = key === viewName;
    el.hidden = !isCurrent;
    el.classList.toggle("active", isCurrent);
  });

  closeMobileSidebar();
  renderActiveView();
}

function renderActiveView(options = {}) {
  const { preserveSearchFocus = false, cursorPos = null } = options;

  switch (state.currentView) {
    case "dashboard":
      renderDashboardView(dom.views.dashboard, state, {
        onNavigate: navigateTo,
        onOpenAddModal: () => openTransactionModal(),
        onEditTransaction: (id) => openTransactionModal(id),
        onDeleteTransaction: (id) => requestDeleteTransaction(id),
      });
      break;

    case "transactions":
      renderTransactionsView(dom.views.transactions, state, {
        onFilterChange: (patch, opts = {}) => {
          state.txFilters = { ...state.txFilters, ...patch };
          renderActiveView(opts);
        },
        onResetFilters: () => {
          state.txFilters = {
            search: "",
            type: "all",
            category: "all",
            monthScope: "all",
            sort: "date-desc",
          };
          renderActiveView();
        },
        onOpenAddModal: () => openTransactionModal(),
        onEditTransaction: (id) => openTransactionModal(id),
        onDeleteTransaction: (id) => requestDeleteTransaction(id),
      });

      if (preserveSearchFocus) {
        const searchEl = document.getElementById("tx-search-input");
        if (searchEl) {
          searchEl.focus();
          if (typeof cursorPos === "number") {
            searchEl.setSelectionRange(cursorPos, cursorPos);
          }
        }
      }
      break;

    case "analytics":
      renderAnalyticsView(dom.views.analytics, state, {
        onPeriodChange: (period) => {
          state.analyticsPeriod = period;
          renderActiveView();
        },
      });
      break;

    case "budget":
      renderBudgetView(dom.views.budget, state, {
        onSaveBudget: (newLimit) => {
          saveBudget(newLimit);
          syncDataFromStorage();
          renderActiveView();
          showToast("Monthly budget updated.");
        },
        onOpenAddModal: () => openTransactionModal(),
      });
      break;
  }

  refreshIcons();
}

/* ==========================================================================
   Transaction Add / Edit Modal
   ========================================================================== */

function clearFormErrors() {
  const fields = ["title", "amount", "category", "date", "description"];
  fields.forEach((field) => {
    const errEl = document.getElementById(`err-tx-${field}`);
    const inputEl = document.getElementById(`tx-${field}`);
    if (errEl) errEl.textContent = "";
    if (inputEl) inputEl.classList.remove("input-invalid");
  });
}

function setTransactionModalType(type, selectedCategory = "") {
  const normalizedType = type === "income" ? "income" : "expense";
  dom.txTypeInput.value = normalizedType;
  dom.txTypeButtons.forEach((btn) => {
    const active = btn.getAttribute("data-tx-type") === normalizedType;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  });
  populateCategoryOptions(dom.txCategorySelect, normalizedType, selectedCategory);
}

function openTransactionModal(transactionId = null) {
  clearFormErrors();
  state.editingTransactionId = transactionId;

  if (transactionId) {
    const tx = getTransactionById(transactionId);
    if (!tx) {
      showToast("Transaction not found.", "error");
      return;
    }
    dom.txModalTitle.textContent = "Edit Transaction";
    dom.txSubmitBtn.textContent = "Update Transaction";
    dom.txIdInput.value = tx.id;
    setTransactionModalType(tx.type, tx.category);
    dom.txTitleInput.value = tx.title;
    dom.txAmountInput.value = String(tx.amount);
    dom.txDateInput.value = tx.date;
    dom.txDescInput.value = tx.description || "";
  } else {
    dom.txModalTitle.textContent = "Add Transaction";
    dom.txSubmitBtn.textContent = "Save Transaction";
    dom.txIdInput.value = "";
    setTransactionModalType("expense");
    dom.txTitleInput.value = "";
    dom.txAmountInput.value = "";
    dom.txDateInput.value = getTodayISO();
    dom.txDescInput.value = "";
  }

  dom.txModal.hidden = false;
  window.requestAnimationFrame(() => {
    dom.txTitleInput.focus();
  });
}

function closeTransactionModal() {
  dom.txModal.hidden = true;
  state.editingTransactionId = null;
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const rawValues = {
    type: dom.txTypeInput.value,
    title: dom.txTitleInput.value,
    amount: dom.txAmountInput.value,
    category: dom.txCategorySelect.value,
    date: dom.txDateInput.value,
    description: dom.txDescInput.value,
  };

  const result = validateTransactionForm(rawValues);
  if (!result.valid) {
    Object.entries(result.errors).forEach(([field, msg]) => {
      const errEl = document.getElementById(`err-tx-${field}`);
      const inputEl = document.getElementById(`tx-${field}`);
      if (errEl) errEl.textContent = msg;
      if (inputEl) inputEl.classList.add("input-invalid");
    });
    const firstInvalid = dom.txForm.querySelector(".input-invalid");
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  try {
    if (state.editingTransactionId) {
      updateTransaction(state.editingTransactionId, result.normalized);
      showToast("Transaction updated.");
    } else {
      saveTransaction(result.normalized);
      showToast("Transaction added.");
    }

    const txMonth = result.normalized.date.slice(0, 7);
    if (txMonth) {
      state.selectedMonth = txMonth;
    }

    closeTransactionModal();
    syncDataFromStorage();
    renderActiveView();
  } catch (err) {
    console.error(err);
    showToast("Could not save transaction.", "error");
  }
}

/* ==========================================================================
   Confirmation Modal (Delete / Clear Data)
   ========================================================================== */

function openConfirmModal({ title, message, confirmLabel = "Confirm", onConfirm }) {
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAccept.textContent = confirmLabel;
  state.confirmAction = onConfirm;
  dom.confirmModal.hidden = false;
  dom.confirmAccept.focus();
}

function closeConfirmModal() {
  dom.confirmModal.hidden = true;
  state.confirmAction = null;
}

function requestDeleteTransaction(id) {
  const tx = getTransactionById(id);
  if (!tx) return;

  openConfirmModal({
    title: "Delete Transaction",
    message: `Are you sure you want to delete "${tx.title}" (${tx.date})? This action cannot be undone.`,
    confirmLabel: "Delete",
    onConfirm: () => {
      deleteTransaction(id);
      syncDataFromStorage();
      renderActiveView();
      showToast("Transaction deleted.");
    },
  });
}

/* ==========================================================================
   Mobile Sidebar Controls
   ========================================================================== */

function openMobileSidebar() {
  dom.sidebar.classList.add("is-open");
  dom.sidebarBackdrop.classList.add("is-open");
  dom.sidebarOpenBtn.setAttribute("aria-expanded", "true");
}

function closeMobileSidebar() {
  dom.sidebar.classList.remove("is-open");
  dom.sidebarBackdrop.classList.remove("is-open");
  dom.sidebarOpenBtn.setAttribute("aria-expanded", "false");
}

/* ==========================================================================
   Event Wiring & Bootstrap
   ========================================================================== */

function bindGlobalEvents() {
  dom.navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo(btn.getAttribute("data-view"));
    });
  });

  const brandLink = document.querySelector(".brand-link");
  if (brandLink) {
    brandLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo("dashboard");
    });
  }

  dom.sidebarOpenBtn.addEventListener("click", openMobileSidebar);
  dom.sidebarCloseBtn.addEventListener("click", closeMobileSidebar);
  dom.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

  dom.monthSelect.addEventListener("change", (e) => {
    state.selectedMonth = e.target.value;
    if (state.txFilters.monthScope !== "all") {
      state.txFilters.monthScope = state.selectedMonth;
    }
    renderActiveView();
  });

  dom.openAddBtn.addEventListener("click", () => openTransactionModal());

  dom.txTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setTransactionModalType(btn.getAttribute("data-tx-type"));
    });
  });

  [dom.txTitleInput, dom.txAmountInput, dom.txCategorySelect, dom.txDateInput, dom.txDescInput].forEach(
    (el) => {
      if (!el) return;
      const evtName = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evtName, () => {
        el.classList.remove("input-invalid");
        const fieldName = el.id.replace("tx-", "");
        const errEl = document.getElementById(`err-tx-${fieldName}`);
        if (errEl) errEl.textContent = "";
      });
    }
  );

  dom.txForm.addEventListener("submit", handleTransactionSubmit);
  dom.txModalClose.addEventListener("click", closeTransactionModal);
  dom.txModalCancel.addEventListener("click", closeTransactionModal);
  dom.txModal.addEventListener("click", (e) => {
    if (e.target === dom.txModal) closeTransactionModal();
  });

  dom.confirmClose.addEventListener("click", closeConfirmModal);
  dom.confirmCancel.addEventListener("click", closeConfirmModal);
  dom.confirmModal.addEventListener("click", (e) => {
    if (e.target === dom.confirmModal) closeConfirmModal();
  });
  dom.confirmAccept.addEventListener("click", () => {
    const action = state.confirmAction;
    closeConfirmModal();
    if (typeof action === "function") action();
  });

  dom.exportCsvBtn.addEventListener("click", () => {
    if (state.transactions.length === 0) {
      showToast("No transactions available to export.", "error");
      return;
    }
    exportTransactionsCSV(state.transactions);
    showToast("Transactions exported to CSV.");
  });

  dom.resetSampleBtn.addEventListener("click", () => {
    openConfirmModal({
      title: "Load Sample Data",
      message: "This will replace your current transactions and budget with sample financial data.",
      confirmLabel: "Load Sample",
      onConfirm: () => {
        resetToSampleData();
        state.selectedMonth = getCurrentYearMonth();
        syncDataFromStorage();
        renderActiveView();
        showToast("Sample dataset loaded.");
      },
    });
  });

  dom.clearDataBtn.addEventListener("click", () => {
    openConfirmModal({
      title: "Clear All Transactions",
      message: "Remove all recorded income and expense entries from LocalStorage? This cannot be undone.",
      confirmLabel: "Clear All",
      onConfirm: () => {
        clearAllData();
        syncDataFromStorage();
        renderActiveView();
        showToast("All transactions cleared.");
      },
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!dom.confirmModal.hidden) {
        closeConfirmModal();
      } else if (!dom.txModal.hidden) {
        closeTransactionModal();
      } else if (dom.sidebar.classList.contains("is-open")) {
        closeMobileSidebar();
      }
    }
  });
}

function init() {
  seedInitialDataIfNeeded();
  syncDataFromStorage();
  bindGlobalEvents();
  navigateTo("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
