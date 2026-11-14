/**
 * Transactions Module (Feature 2 & Feature 3)
 *
 * Handles transaction form validation, category resolution,
 * search/filter/sort pipeline, and Transaction History table rendering.
 */

import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from "./storage.js";

/**
 * Populates a <select> element with categories appropriate for transaction type.
 */
export function populateCategoryOptions(selectEl, type, selectedValue = "") {
  if (!selectEl) return;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  selectEl.innerHTML = categories
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join("");

  if (selectedValue && categories.includes(selectedValue)) {
    selectEl.value = selectedValue;
  } else {
    selectEl.value = categories[0];
  }
}

/**
 * Validates transaction form inputs and returns field-level errors + normalized payload.
 */
export function validateTransactionForm(values) {
  const errors = {};

  const type = values.type === "income" ? "income" : "expense";
  const title = String(values.title || "").trim();
  const amountRaw = String(values.amount ?? "").trim();
  const amount = Number(amountRaw);
  const category = String(values.category || "").trim();
  const date = String(values.date || "").trim();
  const description = String(values.description || "").trim();

  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > 80) {
    errors.title = "Title must be 80 characters or fewer.";
  }

  if (!amountRaw) {
    errors.amount = "Amount is required.";
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a valid amount greater than 0.";
  } else if (amount > 100000000) {
    errors.amount = "Amount exceeds supported maximum.";
  }

  const allowedCategories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!category || !allowedCategories.includes(category)) {
    errors.category = "Please select a valid category.";
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = "Please choose a valid date.";
  } else {
    const [y, m, d] = date.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
      errors.date = "Invalid calendar date.";
    }
  }

  if (description.length > 200) {
    errors.description = "Description must be 200 characters or fewer.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      title,
      amount: Math.round(amount * 100) / 100,
      category,
      type,
      date,
      description,
    },
  };
}

/**
 * Pure filter and sort function for transactions list.
 */
export function filterAndSortTransactions(transactions, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  const type = filters.type || "all";
  const category = filters.category || "all";
  const monthScope = filters.monthScope || "all";
  const sort = filters.sort || "date-desc";

  const filtered = transactions.filter((tx) => {
    if (type !== "all" && tx.type !== type) return false;
    if (category !== "all" && tx.category !== category) return false;
    if (monthScope !== "all" && !tx.date.startsWith(monthScope)) return false;

    if (search) {
      const haystack = `${tx.title} ${tx.description} ${tx.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case "date-asc":
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      case "amount-desc":
        return b.amount - a.amount || b.date.localeCompare(a.date);
      case "amount-asc":
        return a.amount - b.amount || b.date.localeCompare(a.date);
      case "date-desc":
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    }
  });

  return filtered;
}

/**
 * Renders the full Transaction History view into #view-transactions.
 */
export function renderTransactionsView(container, state, callbacks) {
  if (!container) return;

  const { transactions, selectedMonth, txFilters } = state;
  const allCategories = Array.from(
    new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...transactions.map((t) => t.category)])
  ).sort();

  const filtered = filterAndSortTransactions(transactions, txFilters);

  let filteredIncome = 0;
  let filteredExpenses = 0;
  for (const tx of filtered) {
    if (tx.type === "income") filteredIncome += tx.amount;
    else filteredExpenses += tx.amount;
  }
  const filteredNet = filteredIncome - filteredExpenses;

  const hasActiveFilters =
    Boolean(txFilters.search) ||
    txFilters.type !== "all" ||
    txFilters.category !== "all" ||
    txFilters.monthScope !== "all";

  const dateSortNext = txFilters.sort === "date-desc" ? "date-asc" : "date-desc";
  const amountSortNext = txFilters.sort === "amount-desc" ? "amount-asc" : "amount-desc";

  container.innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="input-with-icon search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="tx-search-input"
              class="input-control"
              placeholder="Search title, category, note..."
              value="${escapeHtml(txFilters.search)}"
              aria-label="Search transactions"
            />
          </div>

          <div class="segmented-control" role="group" aria-label="Filter by transaction type">
            <button type="button" class="segment-btn ${txFilters.type === "all" ? "active" : ""}" data-filter-type="all">
              All
            </button>
            <button type="button" class="segment-btn ${txFilters.type === "income" ? "active" : ""}" data-filter-type="income">
              Income
            </button>
            <button type="button" class="segment-btn ${txFilters.type === "expense" ? "active" : ""}" data-filter-type="expense">
              Expense
            </button>
          </div>
        </div>

        <div class="toolbar-group">
          <select id="tx-filter-category" class="select-control filter-select" aria-label="Filter by category">
            <option value="all" ${txFilters.category === "all" ? "selected" : ""}>All Categories</option>
            ${allCategories
              .map(
                (cat) =>
                  `<option value="${escapeHtml(cat)}" ${txFilters.category === cat ? "selected" : ""}>${escapeHtml(cat)}</option>`
              )
              .join("")}
          </select>

          <select id="tx-filter-month" class="select-control filter-select" aria-label="Filter by period">
            <option value="all" ${txFilters.monthScope === "all" ? "selected" : ""}>All Months</option>
            <option value="${escapeHtml(selectedMonth)}" ${txFilters.monthScope === selectedMonth ? "selected" : ""}>
              ${escapeHtml(formatMonthLabel(selectedMonth))}
            </option>
          </select>

          <select id="tx-sort-select" class="select-control filter-select" aria-label="Sort transactions">
            <option value="date-desc" ${txFilters.sort === "date-desc" ? "selected" : ""}>Date: Newest First</option>
            <option value="date-asc" ${txFilters.sort === "date-asc" ? "selected" : ""}>Date: Oldest First</option>
            <option value="amount-desc" ${txFilters.sort === "amount-desc" ? "selected" : ""}>Amount: High to Low</option>
            <option value="amount-asc" ${txFilters.sort === "amount-asc" ? "selected" : ""}>Amount: Low to High</option>
          </select>

          ${
            hasActiveFilters
              ? `<button type="button" class="btn btn-secondary btn-sm" id="tx-clear-filters">Reset</button>`
              : ""
          }
        </div>
      </div>

      <div class="filter-summary-bar">
        <span>Showing <strong class="tabular">${filtered.length}</strong> of <strong class="tabular">${transactions.length}</strong> transactions</span>
        <div class="filter-summary-metrics">
          <span class="tx-type-income">Income: ${formatCurrency(filteredIncome, true)}</span>
          <span aria-hidden="true">·</span>
          <span>Expenses: -${formatCurrency(filteredExpenses)}</span>
          <span aria-hidden="true">·</span>
          <span>Net: ${formatCurrency(filteredNet, true)}</span>
        </div>
      </div>

      ${renderTransactionTableContent(filtered, transactions.length, dateSortNext, amountSortNext, txFilters.sort)}
    </div>
  `;

  bindTransactionsEvents(container, txFilters, callbacks);
}

function renderTransactionTableContent(filtered, totalCount, dateSortNext, amountSortNext, currentSort) {
  if (totalCount === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
        <h2 class="empty-state-title">No transactions recorded yet</h2>
        <p class="empty-state-desc">
          Start tracking your finances by logging your first income or expense entry.
        </p>
        <button type="button" class="btn btn-primary btn-sm" data-action="open-add">
          <i data-lucide="plus"></i>
          <span>Add First Transaction</span>
        </button>
      </div>
    `;
  }

  if (filtered.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="filter-x"></i></div>
        <h2 class="empty-state-title">No matching transactions</h2>
        <p class="empty-state-desc">
          Try clearing your search query or adjusting the type, category, or month filters.
        </p>
        <button type="button" class="btn btn-secondary btn-sm" id="tx-empty-reset">
          Clear Filters
        </button>
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <button type="button" class="sort-th-btn" data-sort-target="${dateSortNext}">
                <span>Date</span>
                <i data-lucide="${currentSort === "date-asc" ? "arrow-up" : "arrow-down"}"></i>
              </button>
            </th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="col-right">
              <button type="button" class="sort-th-btn" data-sort-target="${amountSortNext}">
                <span>Amount</span>
                <i data-lucide="${currentSort === "amount-asc" ? "arrow-up" : "arrow-down"}"></i>
              </button>
            </th>
            <th class="col-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((tx) => {
              const isIncome = tx.type === "income";
              const signPrefix = isIncome ? "+" : "-";
              const amountCls = isIncome ? "tx-amount-income" : "tx-amount-expense";
              const typeCls = isIncome ? "tx-type-income" : "tx-type-expense";
              const typeLabel = isIncome ? "Income" : "Expense";

              return `
                <tr data-tx-id="${escapeHtml(tx.id)}">
                  <td class="tabular" style="white-space: nowrap; color: var(--text-secondary);">
                    ${escapeHtml(formatDate(tx.date))}
                  </td>
                  <td>
                    <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                    ${
                      tx.description
                        ? `<div class="tx-desc-cell" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</div>`
                        : ""
                    }
                  </td>
                  <td>
                    <span class="tx-category-text">${escapeHtml(tx.category)}</span>
                  </td>
                  <td>
                    <span class="tx-type-text ${typeCls}">${typeLabel}</span>
                  </td>
                  <td class="col-right">
                    <span class="tx-amount ${amountCls}">${signPrefix}${formatCurrency(tx.amount)}</span>
                  </td>
                  <td class="col-right">
                    <div class="row-actions">
                      <button
                        type="button"
                        class="icon-btn"
                        data-action="edit-tx"
                        data-id="${escapeHtml(tx.id)}"
                        aria-label="Edit ${escapeHtml(tx.title)}"
                        title="Edit transaction"
                      >
                        <i data-lucide="pencil"></i>
                      </button>
                      <button
                        type="button"
                        class="icon-btn icon-btn-danger"
                        data-action="delete-tx"
                        data-id="${escapeHtml(tx.id)}"
                        aria-label="Delete ${escapeHtml(tx.title)}"
                        title="Delete transaction"
                      >
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindTransactionsEvents(container, txFilters, callbacks) {
  const searchInput = container.querySelector("#tx-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const cursorPos = e.target.selectionStart;
      callbacks.onFilterChange({ search: e.target.value }, { preserveSearchFocus: true, cursorPos });
    });
  }

  container.querySelectorAll("[data-filter-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onFilterChange({ type: btn.getAttribute("data-filter-type") });
    });
  });

  const catSelect = container.querySelector("#tx-filter-category");
  if (catSelect) {
    catSelect.addEventListener("change", (e) => {
      callbacks.onFilterChange({ category: e.target.value });
    });
  }

  const monthSelect = container.querySelector("#tx-filter-month");
  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      callbacks.onFilterChange({ monthScope: e.target.value });
    });
  }

  const sortSelect = container.querySelector("#tx-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      callbacks.onFilterChange({ sort: e.target.value });
    });
  }

  container.querySelectorAll("[data-sort-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onFilterChange({ sort: btn.getAttribute("data-sort-target") });
    });
  });

  const clearBtn = container.querySelector("#tx-clear-filters") || container.querySelector("#tx-empty-reset");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      callbacks.onResetFilters();
    });
  }

  const openAddBtn = container.querySelector('[data-action="open-add"]');
  if (openAddBtn) {
    openAddBtn.addEventListener("click", () => callbacks.onOpenAddModal());
  }

  container.querySelectorAll('[data-action="edit-tx"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onEditTransaction(btn.getAttribute("data-id"));
    });
  });

  container.querySelectorAll('[data-action="delete-tx"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onDeleteTransaction(btn.getAttribute("data-id"));
    });
  });
}
