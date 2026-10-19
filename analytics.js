// Calculate estimated 1RM using Epley Formula
export function calculateOneRepMax(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Process raw historical logs into aggregated strength metrics
export function computeAnalyticsMetrics(logs) {
  let totalVolumeLbs = 0;
  let totalCompletedSets = 0;
  const exercisePRs = {}; // { 'Flat Barbell Bench Press': { weight, reps, oneRM, date } }
  const exerciseHistory = {}; // { 'Flat Barbell Bench Press': [ { date, oneRM, maxWeight, volume } ] }

  logs.forEach(log => {
    const dateStr = log.dateFormatted || log.date || 'Unknown Date';
    
    (log.exercises || []).forEach(ex => {
      const exName = ex.name ? ex.name.trim() : 'Unnamed Exercise';
      if (!exerciseHistory[exName]) exerciseHistory[exName] = [];

      let sessionMaxOneRM = 0;
      let sessionMaxWeight = 0;

      (ex.setsData || []).forEach(set => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        const setVolume = w * r;
        
        totalVolumeLbs += setVolume;
        totalCompletedSets += 1;

        const setOneRM = calculateOneRepMax(w, r);
        if (setOneRM > sessionMaxOneRM) sessionMaxOneRM = setOneRM;
        if (w > sessionMaxWeight) sessionMaxWeight = w;

        // Check All-Time Personal Record (PR)
        if (!exercisePRs[exName] || setOneRM > exercisePRs[exName].oneRM) {
          exercisePRs[exName] = {
            weight: w,
            reps: r,
            oneRM: setOneRM,
            date: dateStr
          };
        }
      });

      if (sessionMaxOneRM > 0) {
        exerciseHistory[exName].push({
          date: dateStr,
          timestamp: log.timestamp || 0,
          oneRM: sessionMaxOneRM,
          maxWeight: sessionMaxWeight
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

// Render Trends View DOM
export function renderAnalyticsView(logs) {
  const container = document.getElementById('analytics-container');
  if (!container) return;

  const metrics = computeAnalyticsMetrics(logs);

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center space-y-2">
        <i class="fa-solid fa-chart-line text-blue-400 text-3xl"></i>
        <h3 class="text-base font-bold text-slate-200">No Analytics Available Yet</h3>
        <p class="text-xs text-slate-400">Log at least one workout session to unlock strength trends and 1RM progress tracking.</p>
      </div>
    `;
    return;
  }

  // Pick top exercises for 1RM breakdown cards (prioritize Bench Press)
  const trackedExercises = Object.keys(metrics.exercisePRs).sort((a, b) => {
    if (a.toLowerCase().includes('bench')) return -1;
    if (b.toLowerCase().includes('bench')) return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = `
    <!-- Top Summary Stat Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center space-y-1 shadow">
        <span class="text-xs text-slate-400 font-semibold block">Total Workouts</span>
        <span class="text-xl font-extrabold text-blue-400">${metrics.totalSessions}</span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center space-y-1 shadow">
        <span class="text-xs text-slate-400 font-semibold block">Total Volume</span>
        <span class="text-xl font-extrabold text-emerald-400">${(metrics.totalVolumeLbs / 1000).toFixed(1)}k <span class="text-xs font-normal text-slate-400">lbs</span></span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center space-y-1 shadow">
        <span class="text-xs text-slate-400 font-semibold block">Sets Logged</span>
        <span class="text-xl font-extrabold text-purple-400">${metrics.totalCompletedSets}</span>
      </div>
      <div class="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-center space-y-1 shadow">
        <span class="text-xs text-slate-400 font-semibold block">Avg Vol / Session</span>
        <span class="text-xl font-extrabold text-amber-400">${Math.round(metrics.totalVolumeLbs / (metrics.totalSessions || 1))} <span class="text-xs font-normal text-slate-400">lbs</span></span>
      </div>
    </div>

    <!-- Estimated 1RM & All-Time PR Leaderboard -->
    <div class="space-y-3 pt-2">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-200 uppercase tracking-wider"><i class="fa-solid fa-trophy text-amber-400 mr-1.5"></i> Estimated 1RM & All-Time PRs</h3>
        <span class="text-[10px] text-slate-400">Epley Formula</span>
      </div>

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
              
              <!-- Session Progression History -->
              <div class="border-t border-slate-700/60 pt-2 space-y-1">
                <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Recent Sessions:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${history.slice(-4).map(h => `
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
}