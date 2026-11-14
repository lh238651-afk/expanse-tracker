/**
 * Budget Management Module (Feature 5)
 *
 * Manages monthly budget target configuration, tracks monthly expenses,
 * computes remaining budget & utilization percentage, and surfaces
 * semantic warning (80%+) and exceeded (100%+) alerts.
 */

import {
  calculateBudgetStatus,
  calculateCategoryBreakdown,
  calculateFinancialSummary,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
} from "./storage.js";

export function renderBudgetView(container, state, callbacks) {
  if (!container) return;

  const { transactions, selectedMonth, budget } = state;
  const monthLabel = formatMonthLabel(selectedMonth);
  const summary = calculateFinancialSummary(transactions, selectedMonth);
  const budgetStatus = calculateBudgetStatus(summary.monthlyExpenses, budget.monthlyLimit);

  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  const categoryBreakdown = calculateCategoryBreakdown(monthTransactions, "expense");

  const progressPctWidth = Math.min(100, Math.max(0, budgetStatus.utilization)).toFixed(1);
  const progressClass =
    budgetStatus.level === "exceeded"
      ? "is-danger"
      : budgetStatus.level === "warning"
      ? "is-warning"
      : "is-nominal";

  const remainingLabel = budgetStatus.remaining >= 0 ? "Remaining Budget" : "Over Budget By";
  const remainingDisplay = formatCurrency(Math.abs(budgetStatus.remaining));

  container.innerHTML = `
    ${renderBudgetAlertBanner(budgetStatus, monthLabel)}

    <div class="budget-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Monthly Budget Target</h2>
            <p class="panel-subtitle">Set your spending cap for ${escapeHtml(monthLabel)}</p>
          </div>
        </div>
        <div class="panel-body">
          <form id="budget-form" class="budget-form" novalidate>
            <div class="form-group">
              <label for="budget-limit-input" class="form-label">Monthly Limit ($)</label>
              <input
                type="number"
                id="budget-limit-input"
                class="input-control mono-input"
                step="1"
                min="1"
                value="${budgetStatus.limit}"
                required
              />
              <span class="field-error" id="err-budget-limit" role="alert"></span>
            </div>

            <div class="budget-presets" aria-label="Quick budget presets">
              <button type="button" class="btn btn-secondary btn-sm" data-budget-preset="2000">$2,000</button>
              <button type="button" class="btn btn-secondary btn-sm" data-budget-preset="3200">$3,200</button>
              <button type="button" class="btn btn-secondary btn-sm" data-budget-preset="5000">$5,000</button>
            </div>

            <div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                <i data-lucide="check"></i>
                <span>Update Monthly Budget</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Budget Utilization · ${escapeHtml(monthLabel)}</h2>
            <p class="panel-subtitle">Warning triggers at 80% · Exceeded alert at 100%</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="budget-progress-header">
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">
              ${formatCurrency(budgetStatus.spent)} spent of ${formatCurrency(budgetStatus.limit)}
            </span>
            <span class="budget-pct ${budgetStatus.level === "exceeded" ? "is-negative" : ""}" style="color: ${
              budgetStatus.level === "exceeded"
                ? "var(--status-danger)"
                : budgetStatus.level === "warning"
                ? "var(--status-warning)"
                : "var(--text-primary)"
            };">
              ${budgetStatus.utilization.toFixed(1)}%
            </span>
          </div>

          <div
            class="progress-track"
            role="progressbar"
            aria-valuenow="${Math.round(budgetStatus.utilization)}"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Monthly budget utilization"
          >
            <div class="progress-fill ${progressClass}" style="width: ${progressPctWidth}%;"></div>
          </div>

          <div class="progress-threshold-note">
            <span>0%</span>
            <span>80% Warning (${formatCurrency(budgetStatus.limit * 0.8)})</span>
            <span>100% Limit</span>
          </div>

          <div class="budget-metrics-row">
            <div>
              <div class="budget-metric-label">Monthly Budget</div>
              <div class="budget-metric-value">${formatCurrency(budgetStatus.limit)}</div>
            </div>
            <div>
              <div class="budget-metric-label">Monthly Expenses</div>
              <div class="budget-metric-value">${formatCurrency(budgetStatus.spent)}</div>
            </div>
            <div>
              <div class="budget-metric-label">${remainingLabel}</div>
              <div class="budget-metric-value" style="color: ${
                budgetStatus.remaining < 0 ? "var(--status-danger)" : "var(--status-success)"
              };">
                ${budgetStatus.remaining < 0 ? "-" : ""}${remainingDisplay}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Monthly Spending by Category</h3>
          <p class="panel-subtitle">Category share against ${escapeHtml(monthLabel)} budget</p>
        </div>
      </div>
      ${
        categoryBreakdown.length === 0
          ? `
            <div class="empty-state">
              <div class="empty-state-icon"><i data-lucide="wallet"></i></div>
              <div class="empty-state-title">No expenses recorded for ${escapeHtml(monthLabel)}</div>
              <p class="empty-state-desc">Add an expense transaction to track category impact against your budget.</p>
              <button type="button" class="btn btn-primary btn-sm" id="budget-open-add">
                <i data-lucide="plus"></i>
                <span>Add Expense</span>
              </button>
            </div>
          `
          : `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th class="col-right">Transactions</th>
                    <th class="col-right">Amount Spent</th>
                    <th class="col-right">% of Budget</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryBreakdown
                    .map((item) => {
                      const pctOfBudget =
                        budgetStatus.limit > 0 ? (item.total / budgetStatus.limit) * 100 : 0;
                      return `
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <span class="category-swatch" style="background-color: ${item.color};"></span>
                              <span style="font-weight: 500;">${escapeHtml(item.category)}</span>
                            </div>
                          </td>
                          <td class="col-right tabular" style="color: var(--text-secondary);">${item.count}</td>
                          <td class="col-right tabular" style="font-weight: 600;">${formatCurrency(item.total)}</td>
                          <td class="col-right tabular">
                            <span style="margin-right: 8px; color: var(--text-secondary);">${pctOfBudget.toFixed(1)}%</span>
                            <span class="inline-bar-track" aria-hidden="true">
                              <span class="inline-bar-fill" style="width: ${Math.min(100, pctOfBudget).toFixed(1)}%; background-color: ${item.color};"></span>
                            </span>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `;

  bindBudgetEvents(container, callbacks);
}

function renderBudgetAlertBanner(budgetStatus, monthLabel) {
  if (budgetStatus.level === "exceeded") {
    const overAmount = Math.abs(budgetStatus.remaining);
    return `
      <div class="status-banner status-banner-danger" role="alert">
        <div class="status-banner-left">
          <i data-lucide="alert-octagon"></i>
          <div class="status-banner-text">
            <strong>Budget Exceeded:</strong>
            Your ${escapeHtml(monthLabel)} spending is
            <span class="tabular">${formatCurrency(overAmount)}</span> over your
            <span class="tabular">${formatCurrency(budgetStatus.limit)}</span> budget
            (<span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span> utilization).
          </div>
        </div>
      </div>
    `;
  }

  if (budgetStatus.level === "warning") {
    return `
      <div class="status-banner status-banner-warning" role="status">
        <div class="status-banner-left">
          <i data-lucide="alert-triangle"></i>
          <div class="status-banner-text">
            <strong>Approaching Budget Limit (80%+):</strong>
            You have used <span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span> of your
            ${escapeHtml(monthLabel)} budget, with
            <span class="tabular">${formatCurrency(budgetStatus.remaining)}</span> remaining.
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="status-banner status-banner-nominal" role="status">
      <div class="status-banner-left">
        <i data-lucide="check-circle-2"></i>
        <div class="status-banner-text">
          <strong>On Track:</strong>
          ${escapeHtml(monthLabel)} expenses are at
          <span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span> of your monthly budget
          (<span class="tabular">${formatCurrency(budgetStatus.remaining)}</span> remaining).
        </div>
      </div>
    </div>
  `;
}

function bindBudgetEvents(container, callbacks) {
  const form = container.querySelector("#budget-form");
  const limitInput = container.querySelector("#budget-limit-input");
  const errorEl = container.querySelector("#err-budget-limit");

  if (limitInput) {
    limitInput.addEventListener("input", () => {
      if (errorEl) errorEl.textContent = "";
      limitInput.classList.remove("input-invalid");
    });
  }

  container.querySelectorAll("[data-budget-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetVal = btn.getAttribute("data-budget-preset");
      if (limitInput) {
        limitInput.value = presetVal;
        if (errorEl) errorEl.textContent = "";
        limitInput.classList.remove("input-invalid");
      }
    });
  });

  if (form && limitInput) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = String(limitInput.value || "").trim();
      const val = Number(raw);
      if (!raw || !Number.isFinite(val) || val < 1 || val > 100000000) {
        if (errorEl) errorEl.textContent = "Please enter a valid monthly budget of at least $1.";
        limitInput.classList.add("input-invalid");
        limitInput.focus();
        return;
      }
      callbacks.onSaveBudget(val);
    });
  }

  const addBtn = container.querySelector("#budget-open-add");
  if (addBtn) {
    addBtn.addEventListener("click", () => callbacks.onOpenAddModal());
  }
}
