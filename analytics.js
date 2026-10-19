let chartInstance = null;

export function calculateOneRepMax(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Strip leading numbers (e.g., "1. Hack Squat" -> "Hack Squat")
function sanitizeExerciseName(name) {
  if (!name) return 'Unnamed Exercise';
  return name.replace(/^\d+\.\s*/, '').trim();
}

export function computeAnalyticsMetrics(logs) {
  let totalVolumeLbs = 0;
  let totalCompletedSets = 0;
  const exercisePRs = {};
  const exerciseHistory = {};

  // Sort logs chronologically ascending for proper chart timeline plotting
  const sortedLogs = [...logs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  sortedLogs.forEach(log => {
    const dateStr = log.dateFormatted || log.date || 'Unknown Date';
    
    (log.exercises || []).forEach(ex => {
      const cleanName = sanitizeExerciseName(ex.name);
      if (!exerciseHistory[cleanName]) exerciseHistory[cleanName] = [];

      let sessionMaxOneRM = 0;
      let sessionMaxWeight = 0;
      let sessionTotalVolume = 0;

      (ex.setsData || []).forEach(set => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        const setVolume = w * r;
        
        totalVolumeLbs += setVolume;
        totalCompletedSets += 1;
        sessionTotalVolume += setVolume;

        const setOneRM = calculateOneRepMax(w, r);
        if (setOneRM > sessionMaxOneRM) sessionMaxOneRM = setOneRM;
        if (w > sessionMaxWeight) sessionMaxWeight = w;

        if (!exercisePRs[cleanName] || setOneRM > exercisePRs[cleanName].oneRM) {
          exercisePRs[cleanName] = {
            weight: w,
            reps: r,
            oneRM: setOneRM,
            date: dateStr
          };
        }
      });

      if (sessionMaxOneRM > 0) {
        exerciseHistory[cleanName].push({
          date: dateStr,
          timestamp: log.timestamp || 0,
          oneRM: sessionMaxOneRM,
          maxWeight: sessionMaxWeight,
          volume: sessionTotalVolume
        });
      }
    });
  });

  return {
    totalSessions: logs.length,
    totalVolumeLbs,
    totalCompletedSets,
    exercisePRs,
    exerciseHistory
  };
}

export function renderAnalyticsView(logs) {
  const container = document.getElementById('analytics-container');
  if (!container) return;

  const metrics = computeAnalyticsMetrics(logs);

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center space-y-2">
        <i class="fa-solid fa-chart-line text-blue-400 text-3xl"></i>
        <h3 class="text-base font-bold text-slate-200">No Analytics Available Yet</h3>
        <p class="text-xs text-slate-400">Log at least one workout session to unlock strength trends.</p>
      </div>
    `;
    return;
  }

  const trackedExercises = Object.keys(metrics.exercisePRs).sort((a, b) => {
    if (a.toLowerCase().includes('bench')) return -1;
    if (b.toLowerCase().includes('bench')) return 1;
    return a.localeCompare(b);
  });

  const defaultExercise = trackedExercises[0] || '';

  container.innerHTML = `
    <!-- Top Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center shadow">
        <span class="text-xs text-slate-400 font-semibold block">Total Workouts</span>
        <span class="text-xl font-extrabold text-blue-400">${metrics.totalSessions}</span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center shadow">
        <span class="text-xs text-slate-400 font-semibold block">Total Volume</span>
        <span class="text-xl font-extrabold text-emerald-400">${(metrics.totalVolumeLbs / 1000).toFixed(1)}k <span class="text-xs text-slate-400">lbs</span></span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center shadow">
        <span class="text-xs text-slate-400 font-semibold block">Sets Logged</span>
        <span class="text-xl font-extrabold text-purple-400">${metrics.totalCompletedSets}</span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center shadow">
        <span class="text-xs text-slate-400 font-semibold block">Avg Vol / Session</span>
        <span class="text-xl font-extrabold text-amber-400">${Math.round(metrics.totalVolumeLbs / (metrics.totalSessions || 1))} <span class="text-xs text-slate-400">lbs</span></span>
      </div>
    </div>

    <!-- Interactive Line Chart Container -->
    <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-3">
        <div>
          <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
            <i class="fa-solid fa-chart-area text-blue-400"></i> Exercise Progression Chart
          </h3>
          <p class="text-[11px] text-slate-400">Select an exercise to plot estimated 1RM and volume trends over time.</p>
        </div>
        <select id="chart-exercise-select" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 w-full sm:w-auto">
          ${trackedExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('')}
        </select>
      </div>

      <div class="relative w-full h-64">
        <canvas id="trendChart"></canvas>
      </div>
    </div>

    <!-- PR Leaderboard Grid -->
    <div class="space-y-3 pt-2">
      <h3 class="text-sm font-bold text-slate-200 uppercase tracking-wider">
        <i class="fa-solid fa-trophy text-amber-400 mr-1.5"></i> Estimated 1RM & All-Time PRs
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${trackedExercises.map(exName => {
          const pr = metrics.exercisePRs[exName];
          const history = metrics.exerciseHistory[exName] || [];
          return `
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-bold text-slate-100 text-xs sm:text-sm">${exName}</h4>
                  <span class="text-[10px] text-slate-400">PR Set: ${pr.weight} lbs × ${pr.reps} reps (${pr.date})</span>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 block font-medium">Est. 1RM</span>
                  <span class="text-base font-extrabold text-blue-400">${pr.oneRM} lbs</span>
                </div>
              </div>
              
              <div class="border-t border-slate-700/60 pt-2 space-y-1">
                <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Recent Sessions:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${history.slice(-5).map(h => `
                    <span class="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                      ${h.oneRM} lbs <span class="text-slate-500">1RM</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Attach dropdown change handler and initialize Chart.js
  const selectElem = document.getElementById('chart-exercise-select');
  if (selectElem) {
    selectElem.value = defaultExercise;
    updateChart(defaultExercise, metrics);
    selectElem.addEventListener('change', (e) => updateChart(e.target.value, metrics));
  }
}

function updateChart(exerciseName, metrics) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const history = metrics.exerciseHistory[exerciseName] || [];
  const labels = history.map(h => h.date.split(',')[0]); // Extract short date
  const oneRMData = history.map(h => h.oneRM);
  const volumeData = history.map(h => h.volume);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Est. 1RM (lbs)',
          data: oneRMData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'Total Vol Pushed (lbs)',
          data: volumeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: '#334155' }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '1RM (lbs)', color: '#3b82f6', font: { size: 10 } },
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { color: '#334155' }
        },
        y2: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Volume (lbs)', color: '#10b981', font: { size: 10 } },
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}