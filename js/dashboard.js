/**
 * Dashboard Module (Feature 1)
 *
 * Renders dynamic financial summary cards, budget status banner,
 * Monthly Spending Overview chart, Expense Category Breakdown chart,
 * and Recent Transactions table.
 */

import {
  calculateBudgetStatus,
  calculateCategoryBreakdown,
  calculateFinancialSummary,
  calculateMonthlySeries,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from "./storage.js";

let monthlyOverviewChart = null;
let categoryBreakdownChart = null;

function destroyDashboardCharts() {
  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
    monthlyOverviewChart = null;
  }
  if (categoryBreakdownChart) {
    categoryBreakdownChart.destroy();
    categoryBreakdownChart = null;
  }
}

export function renderDashboardView(container, state, callbacks) {
  if (!container) return;

  destroyDashboardCharts();

  const { transactions, selectedMonth, budget } = state;
  const summary = calculateFinancialSummary(transactions, selectedMonth);
  const budgetStatus = calculateBudgetStatus(summary.monthlyExpenses, budget.monthlyLimit);

  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  const categoryBreakdown = calculateCategoryBreakdown(monthTransactions, "expense");
  const series = calculateMonthlySeries(transactions, 6, selectedMonth);

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    .slice(0, 6);

  const monthLabel = formatMonthLabel(selectedMonth);
  const balanceClass =
    summary.totalBalance > 0 ? "is-positive" : summary.totalBalance < 0 ? "is-negative" : "";

  const alertHtml = renderDashboardBudgetBanner(budgetStatus, monthLabel);

  container.innerHTML = `
    ${alertHtml}

    <div class="kpi-grid">
      <article class="kpi-card">
        <div class="kpi-label">
          <span>Total Balance</span>
          <i data-lucide="landmark"></i>
        </div>
        <div class="kpi-value ${balanceClass}">${formatCurrency(summary.totalBalance)}</div>
        <div class="kpi-meta">
          <span>All-time net</span>
          <span aria-hidden="true">·</span>
          <span class="tabular">${transactions.length} entries</span>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Total Income</span>
          <i data-lucide="arrow-down-left"></i>
        </div>
        <div class="kpi-value is-positive">${formatCurrency(summary.totalIncome)}</div>
        <div class="kpi-meta">
          <span>${escapeHtml(monthLabel)}:</span>
          <span class="tabular">${formatCurrency(summary.monthlyIncome)}</span>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Total Expenses</span>
          <i data-lucide="arrow-up-right"></i>
        </div>
        <div class="kpi-value">${formatCurrency(summary.totalExpenses)}</div>
        <div class="kpi-meta">
          <span>All recorded outflows</span>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Monthly Spending</span>
          <i data-lucide="calendar"></i>
        </div>
        <div class="kpi-value ${budgetStatus.level === "exceeded" ? "is-negative" : ""}">
          ${formatCurrency(summary.monthlyExpenses)}
        </div>
        <div class="kpi-meta">
          <span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span>
          <span>of ${formatCurrency(budgetStatus.limit)} budget</span>
        </div>
      </article>
    </div>

    <div class="charts-grid-2">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Monthly Spending Overview</h2>
            <p class="panel-subtitle">6-month income vs. expenses through ${escapeHtml(monthLabel)}</p>
          </div>
        </div>
        <div class="panel-body">
          ${
            transactions.length === 0
              ? renderChartEmpty("No cashflow history yet", "Add transactions to visualize monthly trends.")
              : `<div class="chart-canvas-wrap"><canvas id="dash-monthly-chart" aria-label="Monthly spending overview chart"></canvas></div>`
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Expense Category Breakdown</h2>
            <p class="panel-subtitle">${escapeHtml(monthLabel)} spending distribution</p>
          </div>
        </div>
        <div class="panel-body">
          ${
            categoryBreakdown.length === 0
              ? renderChartEmpty(
                  `No expenses in ${monthLabel}`,
                  "Log an expense in this month to view category distribution."
                )
              : `
                <div class="chart-canvas-wrap" style="height: 210px;">
                  <canvas id="dash-category-chart" aria-label="Expense category breakdown chart"></canvas>
                </div>
                <div class="category-legend-list">
                  ${categoryBreakdown
                    .slice(0, 6)
                    .map(
                      (item) => `
                        <div class="category-legend-item">
                          <div class="category-legend-left">
                            <span class="category-swatch" style="background-color: ${item.color};"></span>
                            <span class="category-legend-name">${escapeHtml(item.category)}</span>
                          </div>
                          <span class="category-legend-val">${formatCurrency(item.total)}</span>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              `
          }
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Recent Transactions</h2>
          <p class="panel-subtitle">Latest recorded activity across all accounts</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="dash-view-all-btn">
          <span>View All</span>
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
      ${renderRecentTransactionsBody(recentTransactions)}
    </section>
  `;

  bindDashboardEvents(container, callbacks);

  if (transactions.length > 0) {
    mountMonthlyOverviewChart(container.querySelector("#dash-monthly-chart"), series);
  }
  if (categoryBreakdown.length > 0) {
    mountCategoryBreakdownChart(container.querySelector("#dash-category-chart"), categoryBreakdown);
  }
}

function renderDashboardBudgetBanner(budgetStatus, monthLabel) {
  if (budgetStatus.level === "exceeded") {
    const overAmount = Math.abs(budgetStatus.remaining);
    return `
      <div class="status-banner status-banner-danger" role="alert">
        <div class="status-banner-left">
          <i data-lucide="alert-octagon"></i>
          <div class="status-banner-text">
            <strong>Budget Exceeded (${escapeHtml(monthLabel)}):</strong>
            Spending is <span class="tabular">${formatCurrency(overAmount)}</span> over your
            <span class="tabular">${formatCurrency(budgetStatus.limit)}</span> monthly budget
            (<span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span> used).
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-nav-target="budget">
          Manage Budget
        </button>
      </div>
    `;
  }

  if (budgetStatus.level === "warning") {
    return `
      <div class="status-banner status-banner-warning" role="status">
        <div class="status-banner-left">
          <i data-lucide="alert-triangle"></i>
          <div class="status-banner-text">
            <strong>Budget Warning (${escapeHtml(monthLabel)}):</strong>
            You have used <span class="tabular">${budgetStatus.utilization.toFixed(1)}%</span> of your monthly budget.
            <span class="tabular">${formatCurrency(budgetStatus.remaining)}</span> remaining.
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-nav-target="budget">
          View Budget
        </button>
      </div>
    `;
  }

  return "";
}

function renderChartEmpty(title, subtitle) {
  return `
    <div class="empty-state" style="padding: 36px 16px;">
      <div class="empty-state-icon"><i data-lucide="bar-chart-2"></i></div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <p class="empty-state-desc">${escapeHtml(subtitle)}</p>
    </div>
  `;
}

function renderRecentTransactionsBody(recent) {
  if (recent.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
        <h3 class="empty-state-title">No transactions yet</h3>
        <p class="empty-state-desc">Add an income or expense entry to see your recent financial ledger here.</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="open-add">
          <i data-lucide="plus"></i>
          <span>Add Transaction</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="col-right">Amount</th>
            <th class="col-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${recent
            .map((tx) => {
              const isIncome = tx.type === "income";
              return `
                <tr>
                  <td class="tabular" style="white-space: nowrap; color: var(--text-secondary);">
                    ${escapeHtml(formatDate(tx.date))}
                  </td>
                  <td>
                    <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                    ${
                      tx.description
                        ? `<div class="tx-desc-cell">${escapeHtml(tx.description)}</div>`
                        : ""
                    }
                  </td>
                  <td><span class="tx-category-text">${escapeHtml(tx.category)}</span></td>
                  <td>
                    <span class="tx-type-text ${isIncome ? "tx-type-income" : "tx-type-expense"}">
                      ${isIncome ? "Income" : "Expense"}
                    </span>
                  </td>
                  <td class="col-right">
                    <span class="tx-amount ${isIncome ? "tx-amount-income" : "tx-amount-expense"}">
                      ${isIncome ? "+" : "-"}${formatCurrency(tx.amount)}
                    </span>
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

function bindDashboardEvents(container, callbacks) {
  const viewAllBtn = container.querySelector("#dash-view-all-btn");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => callbacks.onNavigate("transactions"));
  }

  container.querySelectorAll("[data-nav-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onNavigate(btn.getAttribute("data-nav-target"));
    });
  });

  const openAdd = container.querySelector('[data-action="open-add"]');
  if (openAdd) {
    openAdd.addEventListener("click", () => callbacks.onOpenAddModal());
  }

  container.querySelectorAll('[data-action="edit-tx"]').forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onEditTransaction(btn.getAttribute("data-id")));
  });

  container.querySelectorAll('[data-action="delete-tx"]').forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onDeleteTransaction(btn.getAttribute("data-id")));
  });
}

function mountMonthlyOverviewChart(canvas, series) {
  if (!canvas || typeof window.Chart === "undefined") return;

  monthlyOverviewChart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Income",
          data: series.incomeSeries,
          backgroundColor: "#16a34a",
          borderRadius: 4,
          barPercentage: 0.68,
          categoryPercentage: 0.72,
        },
        {
          label: "Expenses",
          data: series.expenseSeries,
          backgroundColor: "#0f172a",
          borderRadius: 4,
          barPercentage: 0.68,
          categoryPercentage: 0.72,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "rectRounded",
            color: "#475569",
            font: { family: "Plus Jakarta Sans", size: 12, weight: "500" },
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { family: "IBM Plex Mono", size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          border: { display: false },
          ticks: {
            color: "#64748b",
            font: { family: "IBM Plex Mono", size: 11 },
            callback: (val) => "$" + Number(val).toLocaleString("en-US"),
          },
        },
      },
    },
  });
}

function mountCategoryBreakdownChart(canvas, breakdown) {
  if (!canvas || typeof window.Chart === "undefined") return;

  categoryBreakdownChart = new window.Chart(canvas, {
    type: "doughnut",
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${item.category}: ${formatCurrency(item.total)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}
