import { 
  auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, 
  getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc 
} from './firebase.js';

import { renderAnalyticsView } from './analytics.js';

let currentUser = null;
let currentActiveDay = 'legs';
let timerInterval = null;
let activeSessionExercises = [];
let masterTemplateBuffer = [];

window.fetchedLogs = [];

// Exercise Library Mapped by Equipment Type
const EXERCISE_LIBRARY = {
  "Barbell": [
    "Flat Barbell Bench Press",
    "Incline Barbell Bench Press",
    "Standing Overhead Press (OHP)",
    "Barbell Back Squat",
    "Romanian Deadlifts (RDLs)",
    "Barbell Bent-Over Row",
    "Barbell Hip Thrust",
    "Close-Grip Bench Press",
    "Barbell Bicep Curl"
  ],
  "Dumbbell": [
    "Incline Dumbbell Press",
    "Flat Dumbbell Press",
    "Dumbbell Shoulder Press",
    "Lateral Raises",
    "Dumbbell Bicep Curls",
    "Hammer Curls",
    "Dumbbell Goblet Squat",
    "Single-Arm Dumbbell Row",
    "Farmer's Walk"
  ],
  "Machine": [
    "Hack Squat",
    "Leg Extensions",
    "Seated Leg Curls",
    "Lying Leg Curls",
    "Leg Press",
    "Chest Press Machine",
    "Hip Adductor Machine",
    "Hip Abductor Machine",
    "Machine Shoulder Press"
  ],
  "Cable": [
    "Lat Pulldowns",
    "Seated Cable Rows",
    "Cable Chest Flys",
    "Tricep Rope Pushdowns",
    "Face Pulls",
    "Cable Lateral Raises",
    "Overhead Cable Tricep Extension",
    "Cable Bicep Curls"
  ],
  "Bodyweight": [
    "Pull-Ups",
    "Chin-Ups",
    "Dips",
    "Push-Ups",
    "Hanging Leg Raises",
    "Inverted Rows"
  ],
  "Other": [
    "Custom Exercise"
  ]
};

const defaultTemplates = {
  legs: {
    title: "🔵 Legs / Lower Body",
    accent: "border-blue-500",
    exercises: [
      { id: "leg_1", equipment: "Machine", name: "Hack Squat / Barbell Squat", target: "Quads & Glutes", setsCount: 3, rest: "3 min", setsData: [{ weight: 185, reps: 8 }, { weight: 185, reps: 8 }, { weight: 185, reps: 8 }] },
      { id: "leg_2", equipment: "Barbell", name: "Romanian Deadlifts (RDLs)", target: "Hamstrings & Glutes", setsCount: 3, rest: "3 min", setsData: [{ weight: 155, reps: 10 }, { weight: 155, reps: 10 }, { weight: 155, reps: 10 }] },
      { id: "leg_3", equipment: "Machine", name: "Leg Extensions", target: "Isolated Quads", setsCount: 3, rest: "2 min", setsData: [{ weight: 110, reps: 12 }, { weight: 110, reps: 12 }, { weight: 110, reps: 12 }] },
      { id: "leg_4", equipment: "Machine", name: "Seated or Lying Leg Curls", target: "Isolated Hamstrings", setsCount: 3, rest: "2 min", setsData: [{ weight: 90, reps: 12 }, { weight: 90, reps: 12 }, { weight: 90, reps: 12 }] },
      { id: "leg_5", equipment: "Machine", name: "Hip Adductor / Abductor Machine", target: "Inner/Outer Thighs", setsCount: 3, rest: "2 min", setsData: [{ weight: 120, reps: 15 }, { weight: 120, reps: 15 }, { weight: 120, reps: 15 }] }
    ]
  },
  push: {
    title: "🔴 Push (Chest, Shoulders, Triceps)",
    accent: "border-red-500",
    exercises: [
      { id: "push_1", equipment: "Barbell", name: "Flat Barbell Bench Press", target: "Chest & Triceps", setsCount: 3, rest: "3 min", setsData: [{ weight: 175, reps: 8 }, { weight: 175, reps: 8 }, { weight: 175, reps: 8 }] },
      { id: "push_2", equipment: "Barbell", name: "Standing Overhead Press (OHP)", target: "Front Delts & Core", setsCount: 3, rest: "3 min", setsData: [{ weight: 105, reps: 8 }, { weight: 105, reps: 8 }, { weight: 105, reps: 8 }] },
      { id: "push_3", equipment: "Dumbbell", name: "Incline Dumbbell Press", target: "Upper Chest", setsCount: 3, rest: "2.5 min", setsData: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
      { id: "push_4", equipment: "Cable", name: "Cable or DB Chest Flys", target: "Chest Isolation", setsCount: 3, rest: "2 min", setsData: [{ weight: 35, reps: 12 }, { weight: 35, reps: 12 }, { weight: 35, reps: 12 }] },
      { id: "push_5", equipment: "Dumbbell", name: "Lateral Raises", target: "Side Delts", setsCount: 3, rest: "2 min", setsData: [{ weight: 25, reps: 15 }, { weight: 25, reps: 15 }, { weight: 25, reps: 15 }] },
      { id: "push_6", equipment: "Cable", name: "Tricep Rope Pushdowns", target: "Tricep Isolation", setsCount: 3, rest: "2 min", setsData: [{ weight: 55, reps: 12 }, { weight: 55, reps: 12 }, { weight: 55, reps: 12 }] }
    ]
  },
  pull: {
    title: "🟢 Pull (Back, Biceps, Rear Delts)",
    accent: "border-emerald-500",
    exercises: [
      { id: "pull_1", equipment: "Cable", name: "Lat Pulldowns", target: "Lats & Upper Back", setsCount: 3, rest: "3 min", setsData: [{ weight: 140, reps: 10 }, { weight: 140, reps: 10 }, { weight: 140, reps: 10 }] },
      { id: "pull_2", equipment: "Cable", name: "Seated Cable Rows", target: "Mid-Back Thickness", setsCount: 3, rest: "2.5 min", setsData: [{ weight: 130, reps: 10 }, { weight: 130, reps: 10 }, { weight: 130, reps: 10 }] },
      { id: "pull_3", equipment: "Cable", name: "Face Pulls", target: "Rear Delts & Rotator Cuff", setsCount: 3, rest: "2 min", setsData: [{ weight: 45, reps: 15 }, { weight: 45, reps: 15 }, { weight: 45, reps: 15 }] },
      { id: "pull_4", equipment: "Dumbbell", name: "Bicep Curls (DB or BB)", target: "Bicep Isolation", setsCount: 3, rest: "2 min", setsData: [{ weight: 35, reps: 12 }, { weight: 35, reps: 12 }, { weight: 35, reps: 12 }] },
      { id: "pull_5", equipment: "Dumbbell", name: "Farmer's Walk", target: "Traps, Core & Grip", setsCount: 3, rest: "2 min", setsData: [{ weight: 65, reps: 60 }, { weight: 65, reps: 60 }, { weight: 65, reps: 60 }] }
    ]
  }
};

function setDefaultDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('workout-datetime').value = now.toISOString().slice(0, 16);
}

function saveDraftSession() {
  if (currentActiveDay && activeSessionExercises.length > 0) {
    localStorage.setItem(`draft_session_${currentActiveDay}`, JSON.stringify(activeSessionExercises));
  }
}

function clearDraftSession(day) {
  localStorage.removeItem(`draft_session_${day}`);
}

window.openAuthModal = () => document.getElementById('auth-modal').classList.remove('hidden');
window.closeAuthModal = () => document.getElementById('auth-modal').classList.add('hidden');

window.loginWithGoogle = async () => {
  try { await signInWithPopup(auth, googleProvider); closeAuthModal(); } catch (e) { alert(e.message); }
};
window.loginWithEmail = async () => {
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
    closeAuthModal();
  } catch (e) { alert(e.message); }
};
window.signUpWithEmail = async () => {
  try {
    await createUserWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
    closeAuthModal();
  } catch (e) { alert(e.message); }
};
window.logOut = () => signOut(auth);

window.showHomeView = () => {
  document.getElementById('home-container').classList.remove('hidden');
  document.getElementById('nav-tabs-bar').classList.add('hidden');
  document.getElementById('rest-timer-widget').classList.add('hidden');
  document.getElementById('routine-header-bar').classList.add('hidden');
  document.getElementById('workout-container').classList.add('hidden');
  document.getElementById('history-container').classList.add('hidden');
  document.getElementById('analytics-container').classList.add('hidden');
  document.getElementById('save-bar').classList.add('hidden');
  fetchHomeMetrics();
};

window.setDay = async (day) => {
  currentActiveDay = day;
  document.getElementById('home-container').classList.add('hidden');
  document.getElementById('nav-tabs-bar').classList.remove('hidden');

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'bg-red-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 'text-white');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });

  const activeBtn = document.getElementById(`btn-day-${day}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
    activeBtn.classList.add('text-white');
    if (day === 'legs') activeBtn.classList.add('bg-blue-600');
    if (day === 'push') activeBtn.classList.add('bg-red-600');
    if (day === 'pull') activeBtn.classList.add('bg-emerald-600');
    if (day === 'history') activeBtn.classList.add('bg-purple-600');
    if (day === 'analytics') activeBtn.classList.add('bg-amber-600');
  }

  if (day === 'history') {
    document.getElementById('rest-timer-widget').classList.add('hidden');
    document.getElementById('workout-container').classList.add('hidden');
    document.getElementById('save-bar').classList.add('hidden');
    document.getElementById('routine-header-bar').classList.add('hidden');
    document.getElementById('analytics-container').classList.add('hidden');
    document.getElementById('history-container').classList.remove('hidden');
    loadHistory();
  } else if (day === 'analytics') {
    document.getElementById('rest-timer-widget').classList.add('hidden');
    document.getElementById('workout-container').classList.add('hidden');
    document.getElementById('save-bar').classList.add('hidden');
    document.getElementById('routine-header-bar').classList.add('hidden');
    document.getElementById('history-container').classList.add('hidden');
    document.getElementById('analytics-container').classList.remove('hidden');
    await loadAnalytics();
  } else {
    document.getElementById('rest-timer-widget').classList.remove('hidden');
    document.getElementById('workout-container').classList.remove('hidden');
    document.getElementById('save-bar').classList.remove('hidden');
    document.getElementById('routine-header-bar').classList.remove('hidden');
    document.getElementById('history-container').classList.add('hidden');
    document.getElementById('analytics-container').classList.add('hidden');
    
    if (!activeSessionExercises || activeSessionExercises.length === 0 || activeSessionExercises._day !== day) {
      await initRoutineForDay(day);
    } else {
      renderSessionView();
    }
  }
};

async function initRoutineForDay(day) {
  document.getElementById('routine-title').innerText = defaultTemplates[day] ? defaultTemplates[day].title : "Workout Session";
  
  const savedDraft = localStorage.getItem(`draft_session_${day}`);
  if (savedDraft) {
    try {
      activeSessionExercises = JSON.parse(savedDraft);
      activeSessionExercises._day = day;
      renderSessionView();
      return;
    } catch (e) { console.error("Draft load error:", e); }
  }

  let templateExercises = defaultTemplates[day] ? defaultTemplates[day].exercises : [];
  if (currentUser) {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists() && userDoc.data().templates && userDoc.data().templates[day]) {
        templateExercises = userDoc.data().templates[day];
      }
    } catch (e) { console.error("Template fetch error:", e); }
  } else {
    const localTpl = localStorage.getItem(`template_${day}`);
    if (localTpl) templateExercises = JSON.parse(localTpl);
  }

  let lastLoggedSession = null;
  const allLogs = await fetchAllLogs();
  const dayLogs = allLogs.filter(l => l.day === day);
  if (dayLogs.length > 0) lastLoggedSession = dayLogs[0];

  activeSessionExercises = JSON.parse(JSON.stringify(templateExercises)).map(ex => {
    let setsData = ex.setsData;
    if (lastLoggedSession && lastLoggedSession.exercises) {
      const pastEx = lastLoggedSession.exercises.find(e => {
        const cleanPast = e.name ? e.name.replace(/^\d+\.\s*/, '').trim().toLowerCase() : '';
        const cleanCurrent = ex.name ? ex.name.replace(/^\d+\.\s*/, '').trim().toLowerCase() : '';
        return cleanPast === cleanCurrent;
      });
      if (pastEx && pastEx.setsData && pastEx.setsData.length > 0) setsData = JSON.parse(JSON.stringify(pastEx.setsData));
    }
    return { ...ex, equipment: ex.equipment || "Barbell", setsData: setsData, completed: false };
  });

  activeSessionExercises._day = day;
  renderSessionView();
}

function renderSessionView() {
  const container = document.getElementById('workout-container');
  const dayData = defaultTemplates[currentActiveDay];

  let html = '';
  if (activeSessionExercises.length === 0) {
    html = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400">No exercises in this session. Add one below.</div>`;
  } else {
    activeSessionExercises.forEach((ex, exIdx) => {
      const currentEq = ex.equipment || "Barbell";
      const availableOptions = EXERCISE_LIBRARY[currentEq] || EXERCISE_LIBRARY["Barbell"];
      const isCustomName = !availableOptions.includes(ex.name);

      html += `
        <div class="exercise-card ${ex.completed ? 'completed' : ''} bg-slate-800 border-l-4 ${dayData ? dayData.accent : 'border-blue-500'} border-y border-r border-slate-700 rounded-xl p-3.5 shadow-sm space-y-3">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1 space-y-1.5 min-w-0">
              <div class="flex gap-2 items-center">
                <!-- Equipment Selector -->
                <select onchange="handleEquipmentChange(${exIdx}, this.value)" class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-blue-400 font-bold text-xs focus:outline-none focus:border-blue-500 shrink-0">
                  ${Object.keys(EXERCISE_LIBRARY).map(eq => `<option value="${eq}" ${currentEq === eq ? 'selected' : ''}>${eq}</option>`).join('')}
                </select>

                <!-- Exercise Name Auto-Fill Selector (Full Flex) -->
                <select onchange="handleExerciseSelect(${exIdx}, this.value)" class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-bold text-xs flex-1 w-full focus:outline-none focus:border-blue-500 truncate">
                  ${availableOptions.map(opt => `<option value="${opt}" ${ex.name === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                  <option value="__CUSTOM__" ${isCustomName ? 'selected' : ''}>+ Custom Name...</option>
                </select>
              </div>

              ${isCustomName ? `
                <input type="text" value="${ex.name}" placeholder="Type custom exercise name..." onchange="updateActiveExName(${exIdx}, this.value)" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold text-xs w-full focus:outline-none focus:border-blue-500">
              ` : ''}
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <!-- Reorder Buttons (Up/Down) -->
              <div class="flex flex-col gap-0.5">
                <button onclick="moveActiveExercise(${exIdx}, -1)" ${exIdx === 0 ? 'disabled class="text-slate-700 cursor-not-allowed px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
                  <i class="fa-solid fa-chevron-up text-[10px]"></i>
                </button>
                <button onclick="moveActiveExercise(${exIdx}, 1)" ${exIdx === activeSessionExercises.length - 1 ? 'disabled class="text-slate-700 cursor-not-allowed px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
                  <i class="fa-solid fa-chevron-down text-[10px]"></i>
                </button>
              </div>

              <button onclick="toggleExerciseDone(${exIdx})" class="px-2.5 py-1 rounded-lg text-xs font-semibold ${ex.completed ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
                <i class="fa-solid ${ex.completed ? 'fa-check' : 'fa-circle'} mr-1"></i> ${ex.completed ? 'Done' : 'Mark Done'}
              </button>
              <button onclick="removeFromCurrentSession(${exIdx})" title="Remove exercise" class="text-slate-500 hover:text-red-400 p-1">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>

          <div class="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg text-xs">
            <div class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 pb-1">
              <span class="col-span-2">Set</span>
              <span class="col-span-5">Weight (LBS)</span>
              <span class="col-span-5">Reps</span>
            </div>
            ${ex.setsData.map((s, sIdx) => `
              <div class="grid grid-cols-12 gap-2 items-center">
                <span class="col-span-2 font-bold text-slate-400">Set ${sIdx + 1}</span>
                <input type="number" value="${s.weight}" onchange="updateSetVal(${exIdx}, ${sIdx}, 'weight', this.value)" class="col-span-5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-blue-400 font-bold focus:outline-none focus:border-blue-500">
                <input type="number" value="${s.reps}" onchange="updateSetVal(${exIdx}, ${sIdx}, 'reps', this.value)" class="col-span-5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-blue-500">
              </div>
            `).join('')}
            <div class="flex justify-between items-center pt-1.5">
              <button onclick="addSetToExercise(${exIdx})" class="text-[11px] text-blue-400 hover:text-blue-300 font-semibold">+ Add Set</button>
              ${ex.setsData.length > 1 ? `<button onclick="removeSetFromExercise(${exIdx})" class="text-[11px] text-red-400 hover:text-red-300 font-semibold">- Remove Set</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  html += `
    <button onclick="addCustomExerciseToActiveSession()" class="w-full bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 text-blue-400 font-bold py-2.5 rounded-xl text-xs transition flex justify-center items-center gap-1.5">
      <i class="fa-solid fa-plus"></i> Add Exercise To Session
    </button>
  `;

  container.innerHTML = html;
  saveDraftSession();
}

window.moveActiveExercise = (exIdx, direction) => {
  const targetIdx = exIdx + direction;
  if (targetIdx < 0 || targetIdx >= activeSessionExercises.length) return;
  const temp = activeSessionExercises[exIdx];
  activeSessionExercises[exIdx] = activeSessionExercises[targetIdx];
  activeSessionExercises[targetIdx] = temp;
  renderSessionView();
};

window.handleEquipmentChange = (exIdx, newEquipment) => {
  activeSessionExercises[exIdx].equipment = newEquipment;
  const libraryForEq = EXERCISE_LIBRARY[newEquipment];
  if (libraryForEq && libraryForEq.length > 0) activeSessionExercises[exIdx].name = libraryForEq[0];
  renderSessionView();
};

window.handleExerciseSelect = (exIdx, selectedVal) => {
  activeSessionExercises[exIdx].name = selectedVal === '__CUSTOM__' ? "Custom Exercise" : selectedVal;
  renderSessionView();
};

window.updateActiveExName = (exIdx, val) => { 
  activeSessionExercises[exIdx].name = val;
  saveDraftSession();
};

window.addCustomExerciseToActiveSession = () => {
  activeSessionExercises.push({
    id: `custom_active_${Date.now()}`,
    equipment: "Barbell",
    name: "Flat Barbell Bench Press",
    target: "Custom Focus",
    rest: "2 min",
    completed: false,
    setsData: [{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }]
  });
  renderSessionView();
};

window.toggleExerciseDone = (idx) => {
  activeSessionExercises[idx].completed = !activeSessionExercises[idx].completed;
  renderSessionView();
};

window.updateSetVal = (exIdx, setIdx, field, val) => {
  activeSessionExercises[exIdx].setsData[setIdx][field] = parseFloat(val) || 0;
  saveDraftSession();
};

window.addSetToExercise = (exIdx) => {
  const lastSet = activeSessionExercises[exIdx].setsData[activeSessionExercises[exIdx].setsData.length - 1] || { weight: 100, reps: 10 };
  activeSessionExercises[exIdx].setsData.push({ ...lastSet });
  renderSessionView();
};

window.removeSetFromExercise = (exIdx) => {
  if (activeSessionExercises[exIdx].setsData.length > 1) {
    activeSessionExercises[exIdx].setsData.pop();
    renderSessionView();
  }
};

window.removeFromCurrentSession = (exIdx) => {
  activeSessionExercises.splice(exIdx, 1);
  renderSessionView();
};

window.saveCurrentWorkout = async () => {
  const completedExercises = activeSessionExercises.filter(ex => ex.completed);
  if (completedExercises.length === 0 && !confirm("No exercises are marked as done. Save anyway?")) return;

  const customDateTimeVal = document.getElementById('workout-datetime').value;
  const sessionDate = customDateTimeVal ? new Date(customDateTimeVal) : new Date();

  const logItem = {
    day: currentActiveDay,
    title: defaultTemplates[currentActiveDay] ? defaultTemplates[currentActiveDay].title : "Custom Session",
    dateFormatted: sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    timestamp: sessionDate.getTime(),
    exercises: (completedExercises.length > 0 ? completedExercises : activeSessionExercises).map(ex => ({
      equipment: ex.equipment || "Barbell",
      name: ex.name,
      setsData: ex.setsData,
      completed: ex.completed
    }))
  };

  if (currentUser) {
    try {
      await addDoc(collection(db, "users", currentUser.uid, "logs"), logItem);
      alert(`Session logged for ${logItem.dateFormatted}!`);
    } catch (e) { alert("Cloud error: " + e.message); }
  } else {
    const localLogs = JSON.parse(localStorage.getItem('ppl_logs') || '[]');
    localLogs.unshift(logItem);
    localStorage.setItem('ppl_logs', JSON.stringify(localLogs));
    alert(`Session saved locally for ${logItem.dateFormatted}!`);
  }

  clearDraftSession(currentActiveDay);
  setDefaultDateTime();
  activeSessionExercises = [];
  initRoutineForDay(currentActiveDay);
};

// Master Template Management
window.openTemplateModal = async () => {
  let templateExercises = defaultTemplates[currentActiveDay].exercises;
  if (currentUser) {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists() && userDoc.data().templates && userDoc.data().templates[currentActiveDay]) {
        templateExercises = userDoc.data().templates[currentActiveDay];
      }
    } catch (e) { console.error(e); }
  } else {
    const localTpl = localStorage.getItem(`template_${currentActiveDay}`);
    if (localTpl) templateExercises = JSON.parse(localTpl);
  }

  masterTemplateBuffer = JSON.parse(JSON.stringify(templateExercises));
  renderTemplateEditor();
  document.getElementById('template-modal').classList.remove('hidden');
};

window.closeTemplateModal = () => document.getElementById('template-modal').classList.add('hidden');

function renderTemplateEditor() {
  const container = document.getElementById('template-editor-list');
  let html = '';
  masterTemplateBuffer.forEach((ex, i) => {
    const currentEq = ex.equipment || "Barbell";
    const availableOptions = EXERCISE_LIBRARY[currentEq] || EXERCISE_LIBRARY["Barbell"];

    html += `
      <div class="bg-slate-900 border border-slate-700/80 p-3 rounded-xl space-y-2 text-xs">
        <div class="flex justify-between items-center gap-2">
          <select onchange="masterTemplateBuffer[${i}].equipment=this.value; masterTemplateBuffer[${i}].name=EXERCISE_LIBRARY[this.value][0]; renderTemplateEditor();" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-blue-400 font-bold shrink-0">
            ${Object.keys(EXERCISE_LIBRARY).map(eq => `<option value="${eq}" ${currentEq === eq ? 'selected' : ''}>${eq}</option>`).join('')}
          </select>
          <select onchange="masterTemplateBuffer[${i}].name=this.value" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold flex-1">
            ${availableOptions.map(opt => `<option value="${opt}" ${ex.name === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>

          <div class="flex items-center gap-1 shrink-0">
            <button onclick="moveTemplateExercise(${i}, -1)" ${i === 0 ? 'disabled class="text-slate-700 px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
              <i class="fa-solid fa-chevron-up text-[10px]"></i>
            </button>
            <button onclick="moveTemplateExercise(${i}, 1)" ${i === masterTemplateBuffer.length - 1 ? 'disabled class="text-slate-700 px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
              <i class="fa-solid fa-chevron-down text-[10px]"></i>
            </button>
            <button onclick="masterTemplateBuffer.splice(${i}, 1); renderTemplateEditor();" class="text-slate-500 hover:text-red-400 p-1">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

window.moveTemplateExercise = (i, direction) => {
  const target = i + direction;
  if (target < 0 || target >= masterTemplateBuffer.length) return;
  const temp = masterTemplateBuffer[i];
  masterTemplateBuffer[i] = masterTemplateBuffer[target];
  masterTemplateBuffer[target] = temp;
  renderTemplateEditor();
};

window.addNewExerciseToTemplate = () => {
  masterTemplateBuffer.push({
    id: `custom_${Date.now()}`,
    equipment: "Barbell",
    name: "Flat Barbell Bench Press",
    target: "General",
    rest: "2 min",
    setsData: [{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }]
  });
  renderTemplateEditor();
};

window.saveMasterTemplate = async () => {
  if (currentUser) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        templates: { [currentActiveDay]: masterTemplateBuffer }
      }, { merge: true });
      alert("Master template saved to cloud!");
    } catch (e) { alert("Error saving template: " + e.message); }
  } else {
    localStorage.setItem(`template_${currentActiveDay}`, JSON.stringify(masterTemplateBuffer));
    alert("Master template saved locally!");
  }
  closeTemplateModal();
  clearDraftSession(currentActiveDay);
  initRoutineForDay(currentActiveDay);
};

async function fetchAllLogs() {
  let logs = [];
  if (currentUser) {
    try {
      const q = collection(db, "users", currentUser.uid, "logs");
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => logs.push({ docId: docSnap.id, isEditing: false, ...docSnap.data() }));
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (e) { console.error("Cloud fetch logs error:", e); }
  } else {
    logs = JSON.parse(localStorage.getItem('ppl_logs') || '[]').map((l, i) => ({ localIdx: i, isEditing: false, ...l }));
  }
  return logs;
}

async function fetchHomeMetrics() {
  const logs = await fetchAllLogs();
  document.getElementById('home-total-logs').innerText = logs.length;
  document.getElementById('home-last-date').innerText = logs.length > 0 ? (logs[0].dateFormatted || logs[0].date) : 'None';
}

async function loadAnalytics() {
  const logs = await fetchAllLogs();
  renderAnalyticsView(logs);
}

async function loadHistory() {
  const historyList = document.getElementById('history-list');
  const countLabel = document.getElementById('log-count');
  historyList.innerHTML = `<p class="text-xs text-slate-400">Loading history...</p>`;

  window.fetchedLogs = await fetchAllLogs();
  countLabel.innerText = `${window.fetchedLogs.length} Sessions Logged`;
  renderHistoryList();
}

function renderHistoryList() {
  const historyList = document.getElementById('history-list');
  if (window.fetchedLogs.length === 0) {
    historyList.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400">No workout history logged yet.</div>`;
    return;
  }

  let html = '';
  window.fetchedLogs.forEach((log, logIdx) => {
    const exercises = (log.exercises || []).map(ex => {
      if (!ex.setsData || ex.setsData.length === 0) {
        const fallbackWeight = ex.weight || 100;
        return {
          ...ex,
          setsData: [{ weight: fallbackWeight, reps: 10 }, { weight: fallbackWeight, reps: 10 }, { weight: fallbackWeight, reps: 10 }]
        };
      }
      return ex;
    });

    const currentIsoDate = log.timestamp ? new Date(log.timestamp - new Date(log.timestamp).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

    if (log.isEditing) {
      html += `
        <div class="bg-slate-800 border-2 border-blue-500/80 rounded-xl p-4 text-xs space-y-4">
          <div class="space-y-2 border-b border-slate-700 pb-2">
            <div class="flex justify-between items-center gap-2">
              <input type="text" value="${log.title || 'Workout Session'}" onchange="updateHistoryTitle(${logIdx}, this.value)" class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-bold text-sm w-full focus:outline-none focus:border-blue-500">
              <div class="flex gap-2 shrink-0">
                <button onclick="saveEditedLog(${logIdx})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded transition">Save</button>
                <button onclick="toggleEditHistory(${logIdx})" class="bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold px-3 py-1 rounded transition">Cancel</button>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <span class="text-slate-400 font-bold text-[10px] uppercase">Logged Date/Time:</span>
              <input type="datetime-local" value="${currentIsoDate}" onchange="updateHistoryDateTime(${logIdx}, this.value)" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-blue-400 font-semibold text-xs focus:outline-none focus:border-blue-500">
            </div>
          </div>

          ${exercises.map((ex, exIdx) => {
            const currentEq = ex.equipment || "Barbell";
            const availableOptions = EXERCISE_LIBRARY[currentEq] || EXERCISE_LIBRARY["Barbell"];
            return `
              <div class="bg-slate-900/70 border border-slate-700/60 p-3 rounded-lg space-y-2">
                <div class="flex justify-between items-center gap-2 border-b border-slate-800 pb-1.5">
                  <select onchange="window.fetchedLogs[${logIdx}].exercises[${exIdx}].equipment=this.value; window.fetchedLogs[${logIdx}].exercises[${exIdx}].name=EXERCISE_LIBRARY[this.value][0]; renderHistoryList();" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-blue-400 font-bold shrink-0">
                    ${Object.keys(EXERCISE_LIBRARY).map(eq => `<option value="${eq}" ${currentEq === eq ? 'selected' : ''}>${eq}</option>`).join('')}
                  </select>
                  <select onchange="updateHistoryExName(${logIdx}, ${exIdx}, this.value)" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold focus:outline-none focus:border-blue-500 text-xs flex-1">
                    ${availableOptions.map(opt => `<option value="${opt}" ${ex.name === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                  </select>

                  <div class="flex items-center gap-1 shrink-0">
                    <button onclick="moveHistoryExercise(${logIdx}, ${exIdx}, -1)" ${exIdx === 0 ? 'disabled class="text-slate-700 px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
                      <i class="fa-solid fa-chevron-up text-[10px]"></i>
                    </button>
                    <button onclick="moveHistoryExercise(${logIdx}, ${exIdx}, 1)" ${exIdx === exercises.length - 1 ? 'disabled class="text-slate-700 px-1"' : 'class="text-slate-400 hover:text-blue-400 px-1"'}>
                      <i class="fa-solid fa-chevron-down text-[10px]"></i>
                    </button>
                    <button onclick="deleteExFromHistory(${logIdx}, ${exIdx})" title="Delete Exercise" class="text-slate-500 hover:text-red-400 px-1">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="space-y-1.5 pt-1">
                  <div class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span class="col-span-2">Set</span>
                    <span class="col-span-5">Weight (LBS)</span>
                    <span class="col-span-5">Reps</span>
                  </div>
                  ${ex.setsData.map((s, sIdx) => `
                    <div class="grid grid-cols-12 gap-2 items-center">
                      <span class="col-span-2 text-slate-400 font-bold">Set ${sIdx + 1}</span>
                      <input type="number" value="${s.weight}" onchange="updateHistorySetVal(${logIdx}, ${exIdx}, ${sIdx}, 'weight', this.value)" class="col-span-5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-blue-400 font-bold focus:outline-none focus:border-blue-500">
                      <input type="number" value="${s.reps}" onchange="updateHistorySetVal(${logIdx}, ${exIdx}, ${sIdx}, 'reps', this.value)" class="col-span-5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-blue-500">
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}

          <button onclick="addExerciseToHistoryLog(${logIdx})" class="w-full bg-slate-900 hover:bg-slate-700 border border-dashed border-slate-600 text-blue-400 font-bold py-2 rounded-lg text-xs transition">
            + Add Exercise To Log
          </button>
        </div>
      `;
    } else {
      html += `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3.5 text-xs">
          <div class="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
            <div>
              <span class="font-bold text-slate-100 block text-sm">${log.title || 'Workout Session'}</span>
              <span class="text-[10px] text-blue-400 font-semibold"><i class="fa-regular fa-calendar-days mr-1"></i>${log.dateFormatted || log.date}</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="toggleEditHistory(${logIdx})" class="text-blue-400 hover:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                <i class="fa-solid fa-pen mr-1"></i> Edit
              </button>
              <button onclick="deleteLog('${log.docId || ''}', ${log.localIdx})" class="text-slate-500 hover:text-red-400 p-1">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="space-y-2 mt-2">
            ${exercises.map(ex => `
              <div class="border-b border-slate-700/40 pb-1.5">
                <div class="font-bold text-slate-200">✅ <span class="text-blue-400 text-[11px]">[${ex.equipment || 'Barbell'}]</span> ${ex.name}</div>
                <div class="flex flex-wrap gap-2 text-[11px] text-blue-400 mt-0.5">
                  ${ex.setsData.map((s, i) => `<span>Set ${i+1}: <strong>${s.weight} lbs × ${s.reps} reps</strong></span>`).join(' • ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });
  historyList.innerHTML = html;
}

window.moveHistoryExercise = (logIdx, exIdx, direction) => {
  const exercises = window.fetchedLogs[logIdx].exercises;
  const targetIdx = exIdx + direction;
  if (targetIdx < 0 || targetIdx >= exercises.length) return;
  const temp = exercises[exIdx];
  exercises[exIdx] = exercises[targetIdx];
  exercises[targetIdx] = temp;
  renderHistoryList();
};

window.addExerciseToHistoryLog = (logIdx) => {
  window.fetchedLogs[logIdx].exercises.push({
    equipment: "Barbell",
    name: "Flat Barbell Bench Press",
    completed: true,
    setsData: [{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }]
  });
  renderHistoryList();
};

window.toggleEditHistory = (logIdx) => {
  window.fetchedLogs[logIdx].isEditing = !window.fetchedLogs[logIdx].isEditing;
  renderHistoryList();
};

window.updateHistoryTitle = (logIdx, val) => { window.fetchedLogs[logIdx].title = val; };
window.updateHistoryExName = (logIdx, exIdx, val) => { window.fetchedLogs[logIdx].exercises[exIdx].name = val; };

window.updateHistoryDateTime = (logIdx, val) => {
  if (val) {
    const d = new Date(val);
    window.fetchedLogs[logIdx].timestamp = d.getTime();
    window.fetchedLogs[logIdx].dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

window.updateHistorySetVal = (logIdx, exIdx, setIdx, field, val) => {
  const ex = window.fetchedLogs[logIdx].exercises[exIdx];
  ex.setsData[setIdx][field] = parseFloat(val) || 0;
};

window.deleteExFromHistory = (logIdx, exIdx) => {
  window.fetchedLogs[logIdx].exercises.splice(exIdx, 1);
  renderHistoryList();
};

window.saveEditedLog = async (logIdx) => {
  const log = window.fetchedLogs[logIdx];
  log.isEditing = false;

  if (currentUser && log.docId) {
    try {
      const docRef = doc(db, "users", currentUser.uid, "logs", log.docId);
      await updateDoc(docRef, { 
        title: log.title || 'Workout Session', 
        exercises: log.exercises,
        timestamp: log.timestamp,
        dateFormatted: log.dateFormatted
      });
      alert("Log updated in cloud!");
    } catch (e) { alert("Error saving log edit: " + e.message); }
  } else {
    const localLogs = JSON.parse(localStorage.getItem('ppl_logs') || '[]');
    localLogs[log.localIdx].title = log.title || 'Workout Session';
    localLogs[log.localIdx].exercises = log.exercises;
    localLogs[log.localIdx].timestamp = log.timestamp;
    localLogs[log.localIdx].dateFormatted = log.dateFormatted;
    localStorage.setItem('ppl_logs', JSON.stringify(localLogs));
    alert("Log updated locally!");
  }
  renderHistoryList();
};

window.deleteLog = async (docId, localIdx) => {
  if (!confirm("Delete this log entry?")) return;
  if (currentUser && docId) {
    await deleteDoc(doc(db, "users", currentUser.uid, "logs", docId));
  } else {
    const localLogs = JSON.parse(localStorage.getItem('ppl_logs') || '[]');
    localLogs.splice(localIdx, 1);
    localStorage.setItem('ppl_logs', JSON.stringify(localLogs));
  }
  loadHistory();
};

window.startTimer = (seconds) => {
  clearInterval(timerInterval);
  let rem = seconds;
  updateTimerDisplay(rem);
  timerInterval = setInterval(() => {
    rem--;
    if (rem <= 0) {
      clearInterval(timerInterval);
      alert("Rest Time Up!");
      updateTimerDisplay(0);
    } else { updateTimerDisplay(rem); }
  }, 1000);
};

window.resetTimer = () => { clearInterval(timerInterval); updateTimerDisplay(0); };

function updateTimerDisplay(s) {
  const m = Math.floor(s / 60); const sec = s % 60;
  document.getElementById('timer-display').innerText = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const authStatus = document.getElementById('auth-status');
  if (user) {
    authStatus.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="hidden sm:inline text-xs text-slate-300 font-medium truncate max-w-[120px]">${user.email || 'Google User'}</span>
        <button onclick="logOut()" class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg transition">Log Out</button>
      </div>
    `;
  } else {
    authStatus.innerHTML = `
      <button id="btn-open-auth" onclick="openAuthModal()" class="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg transition">
        <i class="fa-solid fa-right-to-bracket mr-1"></i> Log In / Sign Up
      </button>
    `;
  }
  showHomeView();
});

setDefaultDateTime();