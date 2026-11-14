/**
 * Expense Analytics Module (Feature 4)
 *
 * Computes and visualizes category-wise expense breakdown,
 * monthly income vs. expenses, spending distribution,
 * highest spending category, and total savings.
 */

import {
  calculateCategoryBreakdown,
  calculateMonthlySeries,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
} from "./storage.js";

let analyticsIncomeVsExpenseChart = null;
let analyticsCategoryBarChart = null;
let analyticsDistributionChart = null;

function destroyAnalyticsCharts() {
  if (analyticsIncomeVsExpenseChart) {
    analyticsIncomeVsExpenseChart.destroy();
    analyticsIncomeVsExpenseChart = null;
  }
  if (analyticsCategoryBarChart) {
    analyticsCategoryBarChart.destroy();
    analyticsCategoryBarChart = null;
  }
  if (analyticsDistributionChart) {
    analyticsDistributionChart.destroy();
    analyticsDistributionChart = null;
  }
}

export function renderAnalyticsView(container, state, callbacks) {
  if (!container) return;

  destroyAnalyticsCharts();

  const { transactions, selectedMonth, analyticsPeriod } = state;
  const period = analyticsPeriod === "all" ? "all" : "month";
  const periodLabel = period === "all" ? "All Time" : formatMonthLabel(selectedMonth);

  const scopedTransactions =
    period === "all"
      ? transactions
      : transactions.filter((tx) => tx.date.startsWith(selectedMonth));

  let periodIncome = 0;
  let periodExpenses = 0;
  let expenseCount = 0;

  for (const tx of scopedTransactions) {
    if (tx.type === "income") {
      periodIncome += tx.amount;
    } else {
      periodExpenses += tx.amount;
      expenseCount += 1;
    }
  }

  const totalSavings = periodIncome - periodExpenses;
  const savingsRate = periodIncome > 0 ? (totalSavings / periodIncome) * 100 : 0;
  const expenseRatio = periodIncome > 0 ? (periodExpenses / periodIncome) * 100 : 0;
  const avgExpense = expenseCount > 0 ? periodExpenses / expenseCount : 0;

  const categoryBreakdown = calculateCategoryBreakdown(scopedTransactions, "expense");
  const topCategory = categoryBreakdown[0] || null;
  const series = calculateMonthlySeries(transactions, 6, selectedMonth);

  container.innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <div>
          <h2 class="panel-title">Financial Analytics · ${escapeHtml(periodLabel)}</h2>
          <p class="panel-subtitle">Dynamic spending patterns, category distribution, and net savings</p>
        </div>
        <div class="segmented-control" role="group" aria-label="Analytics timeframe">
          <button
            type="button"
            class="segment-btn ${period === "month" ? "active" : ""}"
            data-analytics-period="month"
          >
            ${escapeHtml(formatMonthLabel(selectedMonth))}
          </button>
          <button
            type="button"
            class="segment-btn ${period === "all" ? "active" : ""}"
            data-analytics-period="all"
          >
            All Time
          </button>
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <article class="kpi-card">
        <div class="kpi-label">
          <span>Total Savings</span>
          <i data-lucide="piggy-bank"></i>
        </div>
        <div class="kpi-value ${totalSavings > 0 ? "is-positive" : totalSavings < 0 ? "is-negative" : ""}">
          ${formatCurrency(totalSavings)}
        </div>
        <div class="kpi-meta">
          <span class="tabular">${periodIncome > 0 ? `${savingsRate.toFixed(1)}% savings rate` : "No income recorded"}</span>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Highest Spending Category</span>
          <i data-lucide="trending-up"></i>
        </div>
        <div class="kpi-value" style="font-family: var(--font-sans); font-size: 20px;">
          ${topCategory ? escapeHtml(topCategory.category) : "—"}
        </div>
        <div class="kpi-meta">
          ${
            topCategory
              ? `<span class="tabular">${formatCurrency(topCategory.total)}</span>
                 <span aria-hidden="true">·</span>
                 <span class="tabular">${topCategory.percentage.toFixed(1)}% of expenses</span>`
              : `<span>No expenses in period</span>`
          }
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Average Expense</span>
          <i data-lucide="calculator"></i>
        </div>
        <div class="kpi-value">${formatCurrency(avgExpense)}</div>
        <div class="kpi-meta">
          <span class="tabular">${expenseCount} expense ${expenseCount === 1 ? "entry" : "entries"}</span>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label">
          <span>Expense-to-Income Ratio</span>
          <i data-lucide="percent"></i>
        </div>
        <div class="kpi-value ${expenseRatio > 100 ? "is-negative" : ""}">
          ${periodIncome > 0 ? `${expenseRatio.toFixed(1)}%` : "—"}
        </div>
        <div class="kpi-meta">
          <span class="tabular">${formatCurrency(periodExpenses)} spent vs ${formatCurrency(periodIncome)} in</span>
        </div>
      </article>
    </div>

    <div class="charts-grid-equal">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">Monthly Income vs. Expenses</h3>
            <p class="panel-subtitle">Trailing 6-month comparison</p>
          </div>
        </div>
        <div class="panel-body">
          ${
            transactions.length === 0
              ? renderAnalyticsEmpty("No transaction history", "Add income and expenses to compare monthly cashflow.")
              : `<div class="chart-canvas-wrap chart-canvas-wrap-tall">
                   <canvas id="analytics-income-expense-chart" aria-label="Monthly income versus expenses chart"></canvas>
                 </div>`
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">Category-Wise Expense Breakdown</h3>
            <p class="panel-subtitle">Ranked spending totals (${escapeHtml(periodLabel)})</p>
          </div>
        </div>
        <div class="panel-body">
          ${
            categoryBreakdown.length === 0
              ? renderAnalyticsEmpty("No expenses in period", "Log expenses to analyze category totals.")
              : `<div class="chart-canvas-wrap chart-canvas-wrap-tall">
                   <canvas id="analytics-category-bar-chart" aria-label="Category-wise expense breakdown chart"></canvas>
                 </div>`
          }
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Spending Distribution</h3>
          <p class="panel-subtitle">Proportional share across expense categories (${escapeHtml(periodLabel)})</p>
        </div>
      </div>
      ${
        categoryBreakdown.length === 0
          ? renderAnalyticsEmpty("No spending distribution available", "Add expense entries to view distribution metrics.")
          : `
            <div class="panel-body">
              <div class="charts-grid-2" style="align-items: center;">
                <div class="chart-canvas-wrap" style="height: 250px;">
                  <canvas id="analytics-distribution-chart" aria-label="Spending distribution chart"></canvas>
                </div>
                <div class="table-wrap">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th class="col-right">Entries</th>
                        <th class="col-right">Amount</th>
                        <th class="col-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${categoryBreakdown
                        .map(
                          (item) => `
                            <tr>
                              <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <span class="category-swatch" style="background-color: ${item.color};"></span>
                                  <span>${escapeHtml(item.category)}</span>
                                </div>
                              </td>
                              <td class="col-right tabular" style="color: var(--text-secondary);">${item.count}</td>
                              <td class="col-right tabular" style="font-weight: 600;">${formatCurrency(item.total)}</td>
                              <td class="col-right tabular">
                                <span style="margin-right: 8px; color: var(--text-secondary);">${item.percentage.toFixed(1)}%</span>
                                <span class="inline-bar-track" aria-hidden="true">
                                  <span class="inline-bar-fill" style="width: ${Math.min(100, item.percentage).toFixed(1)}%; background-color: ${item.color};"></span>
                                </span>
                              </td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `
      }
    </section>
  `;

  container.querySelectorAll("[data-analytics-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onPeriodChange(btn.getAttribute("data-analytics-period"));
    });
  });

  if (transactions.length > 0) {
    mountIncomeVsExpenseChart(container.querySelector("#analytics-income-expense-chart"), series);
  }
  if (categoryBreakdown.length > 0) {
    mountCategoryBarChart(container.querySelector("#analytics-category-bar-chart"), categoryBreakdown);
    mountDistributionChart(container.querySelector("#analytics-distribution-chart"), categoryBreakdown);
  }
}

function renderAnalyticsEmpty(title, desc) {
  return `
    <div class="empty-state" style="padding: 36px 20px;">
      <div class="empty-state-icon"><i data-lucide="pie-chart"></i></div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <p class="empty-state-desc">${escapeHtml(desc)}</p>
    </div>
  `;
}

function mountIncomeVsExpenseChart(canvas, series) {
  if (!canvas || typeof window.Chart === "undefined") return;

  analyticsIncomeVsExpenseChart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Income",
          data: series.incomeSeries,
          backgroundColor: "#16a34a",
          borderRadius: 4,
          barPercentage: 0.7,
        },
        {
          label: "Expenses",
          data: series.expenseSeries,
          backgroundColor: "#dc2626",
          borderRadius: 4,
          barPercentage: 0.7,
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
          ticks: { color: "#64748b", font: { family: "IBM Plex Mono", size: 11 } },
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

function mountCategoryBarChart(canvas, breakdown) {
  if (!canvas || typeof window.Chart === "undefined") return;

  analyticsCategoryBarChart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          label: "Expenses",
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `${formatCurrency(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          border: { display: false },
          ticks: {
            color: "#64748b",
            font: { family: "IBM Plex Mono", size: 11 },
            callback: (val) => "$" + Number(val).toLocaleString("en-US"),
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: "#334155",
            font: { family: "Plus Jakarta Sans", size: 12, weight: "500" },
          },
        },
      },
    },
  });
}

function mountDistributionChart(canvas, breakdown) {
  if (!canvas || typeof window.Chart === "undefined") return;

  analyticsDistributionChart = new window.Chart(canvas, {
    type: "doughnut",
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
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
