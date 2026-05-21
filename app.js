const state = {
  currentView: 'timer',
  subjects: JSON.parse(localStorage.getItem('subjects')) || [],
  dailyRecords: JSON.parse(localStorage.getItem('dailyRecords')) || {},
  activeSubject: null,
  timerInterval: null,
  timerSeconds: 0,
  timerSessionDay: null,
  isRunning: false,
  todos: JSON.parse(localStorage.getItem('todos')) || [],
  todoFilter: 'all',
  events: JSON.parse(localStorage.getItem('events')) || {},
  currentDate: new Date(),
  selectedDate: null,
  pomodoro: {
    workTime: parseInt(localStorage.getItem('pomodoroWorkTime')) || 25,
    breakTime: parseInt(localStorage.getItem('pomodoroBreakTime')) || 5,
    isWorkPhase: true,
    isRunning: false,
    timeLeft: 0,
    interval: null,
    cycles: 0,
  },
};

state.subjects = state.subjects.map(s => ({ id: s.id, name: s.name }));

function saveState() {
  localStorage.setItem('subjects', JSON.stringify(state.subjects));
  localStorage.setItem('dailyRecords', JSON.stringify(state.dailyRecords));
  localStorage.setItem('todos', JSON.stringify(state.todos));
  localStorage.setItem('events', JSON.stringify(state.events));
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatShortTime(seconds) {
  if (seconds < 60) return '<1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTodayKey() {
  const now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
}

function getTodayRecord() {
  const key = getTodayKey();
  if (!state.dailyRecords[key]) {
    state.dailyRecords[key] = { subjects: {}, total: 0 };
  }
  return state.dailyRecords[key];
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `${view}-view`);
  });
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

function renderSubjects() {
  const list = document.getElementById('subjectsList');
  const datalist = document.getElementById('subjectList');
  const record = getTodayRecord();

  if (state.subjects.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No subjects yet. Add one above!</p>';
    return;
  }

  list.innerHTML = state.subjects.map(subject => {
    const subjectTime = record.subjects[subject.id] || 0;
    const displayTime = subjectTime + (state.activeSubject === subject.id && state.isRunning ? state.timerSeconds : 0);
    return `
      <div class="subject-item ${state.activeSubject === subject.id ? 'active' : ''}" data-id="${subject.id}">
        <span class="subject-name">${subject.name}</span>
        <span class="subject-time">${formatTime(displayTime)}</span>
        <button class="subject-delete" data-id="${subject.id}">&times;</button>
      </div>
    `;
  }).join('');

  datalist.innerHTML = state.subjects.map(s => `<option value="${s.name}">`).join('');
  updateTotalTime();
}

function updateTotalTime() {
  const record = getTodayRecord();
  const total = record.total + (state.isRunning ? state.timerSeconds : 0);
  document.getElementById('totalTime').textContent = formatTime(total);
}

document.getElementById('addSubjectBtn').addEventListener('click', () => {
  const input = document.getElementById('subjectInput');
  const name = input.value.trim();
  if (!name) return;

  const existing = state.subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    state.activeSubject = existing.id;
  } else {
    state.activeSubject = generateId();
    state.subjects.push({ id: state.activeSubject, name });
  }

  input.value = '';
  saveState();
  renderSubjects();
});

document.getElementById('subjectInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('addSubjectBtn').click();
});

document.getElementById('subjectsList').addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.subject-delete');
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    state.subjects = state.subjects.filter(s => s.id !== id);
    if (state.activeSubject === id) {
      state.activeSubject = state.subjects[0]?.id || null;
      if (state.isRunning) toggleTimer();
    }
    saveState();
    renderSubjects();
    updateTimerDisplay();
    return;
  }

  const item = e.target.closest('.subject-item');
  if (item) {
    state.activeSubject = item.dataset.id;
    renderSubjects();
    updateTimerDisplay();
  }
});

function updateTimerDisplay() {
  const display = document.getElementById('timeDisplay');
  const activeSubjectEl = document.getElementById('activeSubject');

  const subject = state.subjects.find(s => s.id === state.activeSubject);
  if (subject) {
    activeSubjectEl.textContent = subject.name;
    const record = getTodayRecord();
    const subjectTime = record.subjects[subject.id] || 0;
    const currentTime = subjectTime + (state.isRunning ? state.timerSeconds : 0);
    display.textContent = formatTime(currentTime);
  } else {
    activeSubjectEl.textContent = 'Select a subject to start';
    display.textContent = '00:00:00';
  }
}

function toggleTimer() {
  if (!state.activeSubject) return;

  if (state.isRunning) {
    clearInterval(state.timerInterval);
    state.isRunning = false;

    const sessionDay = state.timerSessionDay || getTodayKey();
    if (!state.dailyRecords[sessionDay]) {
      state.dailyRecords[sessionDay] = { subjects: {}, total: 0 };
    }
    state.dailyRecords[sessionDay].subjects[state.activeSubject] = (state.dailyRecords[sessionDay].subjects[state.activeSubject] || 0) + state.timerSeconds;
    state.dailyRecords[sessionDay].total += state.timerSeconds;
    state.timerSeconds = 0;
    state.timerSessionDay = null;
    saveState();

    document.getElementById('startBtn').classList.remove('hidden');
    document.getElementById('pauseBtn').classList.add('hidden');
  } else {
    state.isRunning = true;
    state.timerSessionDay = getTodayKey();
    state.timerInterval = setInterval(() => {
      state.timerSeconds++;
      updateTimerDisplay();
      renderSubjects();
    }, 1000);

    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('pauseBtn').classList.remove('hidden');
  }
}

document.getElementById('startBtn').addEventListener('click', toggleTimer);
document.getElementById('pauseBtn').addEventListener('click', toggleTimer);

document.getElementById('resetBtn').addEventListener('click', () => {
  if (state.isRunning) toggleTimer();
  state.timerSeconds = 0;
  updateTimerDisplay();
  renderSubjects();
});

function renderTodos() {
  const list = document.getElementById('todosList');
  const filtered = state.todos.filter(todo => {
    if (state.todoFilter === 'active') return !todo.completed;
    if (state.todoFilter === 'completed') return todo.completed;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px;">
      ${state.todoFilter === 'all' ? 'No tasks yet. Add one above!' : 
        state.todoFilter === 'active' ? 'No active tasks!' : 
        'No completed tasks!'}
    </p>`;
  } else {
    list.innerHTML = filtered.map(todo => `
      <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <div class="todo-checkbox" data-id="${todo.id}"></div>
        <div class="todo-content">
          <div class="todo-text">${todo.text}</div>
          <div class="todo-meta">
            <span class="todo-priority ${todo.priority}">${todo.priority}</span>
            ${todo.dueDate ? `<span>Due: ${new Date(todo.dueDate).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        <button class="todo-delete" data-id="${todo.id}">&times;</button>
      </div>
    `).join('');
  }

  const remaining = state.todos.filter(t => !t.completed).length;
  document.getElementById('todosCount').textContent = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
}

document.getElementById('addTodoBtn').addEventListener('click', () => {
  const input = document.getElementById('todoInput');
  const dateInput = document.getElementById('todoDate');
  const prioritySelect = document.getElementById('todoPriority');
  const text = input.value.trim();
  if (!text) return;

  state.todos.push({
    id: generateId(),
    text,
    dueDate: dateInput.value || null,
    priority: prioritySelect.value,
    completed: false,
    createdAt: new Date().toISOString()
  });

  input.value = '';
  dateInput.value = '';
  saveState();
  renderTodos();
});

document.getElementById('todoInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('addTodoBtn').click();
});

document.getElementById('todosList').addEventListener('click', (e) => {
  const checkbox = e.target.closest('.todo-checkbox');
  if (checkbox) {
    const todo = state.todos.find(t => t.id === checkbox.dataset.id);
    if (todo) {
      todo.completed = !todo.completed;
      saveState();
      renderTodos();
    }
    return;
  }

  const deleteBtn = e.target.closest('.todo-delete');
  if (deleteBtn) {
    state.todos = state.todos.filter(t => t.id !== deleteBtn.dataset.id);
    saveState();
    renderTodos();
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.todoFilter = btn.dataset.filter;
    renderTodos();
  });
});

document.getElementById('clearCompletedBtn').addEventListener('click', () => {
  state.todos = state.todos.filter(t => !t.completed);
  saveState();
  renderTodos();
});

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('currentMonth');

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  monthLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);

  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = prevLastDay.getDate();

  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const selectedStr = state.selectedDate ? formatDateStr(
    state.selectedDate.getFullYear(),
    state.selectedDate.getMonth(),
    state.selectedDate.getDate()
  ) : null;

  let html = '<div class="calendar-header">';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    html += `<span>${d}</span>`;
  });
  html += '</div><div class="calendar-days">';

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = formatDateStr(prevYear, prevMonth, day);
    const hasEvents = state.events[dateStr]?.length > 0;
    const dayTotal = state.dailyRecords[dateStr]?.total || 0;

    html += `<div class="calendar-day other-month" data-date="${dateStr}">
      <span class="day-number">${day}</span>
      ${dayTotal > 0 ? `<span class="day-study-time">${formatShortTime(dayTotal)}</span>` : ''}
      ${hasEvents ? '<span class="event-dot"></span>' : ''}
    </div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateStr(year, month, day);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedStr;
    const hasEvents = state.events[dateStr]?.length > 0;
    const dayTotal = state.dailyRecords[dateStr]?.total || 0;

    html += `<div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
      <span class="day-number">${day}</span>
      ${dayTotal > 0 ? `<span class="day-study-time">${formatShortTime(dayTotal)}</span>` : ''}
      ${hasEvents ? '<span class="event-dot"></span>' : ''}
    </div>`;
  }

  const remainingDays = 42 - (startDayOfWeek + daysInMonth);
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = formatDateStr(nextYear, nextMonth, day);
    const hasEvents = state.events[dateStr]?.length > 0;
    const dayTotal = state.dailyRecords[dateStr]?.total || 0;

    html += `<div class="calendar-day other-month" data-date="${dateStr}">
      <span class="day-number">${day}</span>
      ${dayTotal > 0 ? `<span class="day-study-time">${formatShortTime(dayTotal)}</span>` : ''}
      ${hasEvents ? '<span class="event-dot"></span>' : ''}
    </div>`;
  }

  html += '</div>';
  grid.innerHTML = html;
}

function formatDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function selectDate(dateStr) {
  state.selectedDate = new Date(dateStr + 'T00:00:00');
  renderCalendar();
  renderEvents();

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('selectedDate').textContent = state.selectedDate.toLocaleDateString('en-US', options);
}

document.getElementById('calendarGrid').addEventListener('click', (e) => {
  const day = e.target.closest('.calendar-day');
  if (day) {
    selectDate(day.dataset.date);
  }
});

document.getElementById('prevMonth').addEventListener('click', () => {
  state.currentDate.setMonth(state.currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  state.currentDate.setMonth(state.currentDate.getMonth() + 1);
  renderCalendar();
});

function renderEvents() {
  const list = document.getElementById('eventsList');
  const dateStr = state.selectedDate ? formatDateStr(
    state.selectedDate.getFullYear(),
    state.selectedDate.getMonth(),
    state.selectedDate.getDate()
  ) : null;

  const events = dateStr ? (state.events[dateStr] || []) : [];

  if (events.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No events for this date</p>';
    return;
  }

  events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  list.innerHTML = events.map(event => `
    <div class="event-item" data-id="${event.id}">
      <div class="event-info">
        <div class="event-name">${event.name}</div>
        ${event.time ? `<div class="event-time">${formatEventTime(event.time)}</div>` : ''}
      </div>
      <button class="event-delete" data-id="${event.id}">&times;</button>
    </div>
  `).join('');
}

function formatEventTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

document.getElementById('addEventBtn').addEventListener('click', () => {
  const input = document.getElementById('eventInput');
  const timeInput = document.getElementById('eventTime');
  const name = input.value.trim();
  if (!name || !state.selectedDate) return;

  const dateStr = formatDateStr(
    state.selectedDate.getFullYear(),
    state.selectedDate.getMonth(),
    state.selectedDate.getDate()
  );

  if (!state.events[dateStr]) {
    state.events[dateStr] = [];
  }

  state.events[dateStr].push({
    id: generateId(),
    name,
    time: timeInput.value || null
  });

  input.value = '';
  timeInput.value = '';
  saveState();
  renderEvents();
  renderCalendar();
});

document.getElementById('eventInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('addEventBtn').click();
});

document.getElementById('eventsList').addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.event-delete');
  if (deleteBtn && state.selectedDate) {
    const dateStr = formatDateStr(
      state.selectedDate.getFullYear(),
      state.selectedDate.getMonth(),
      state.selectedDate.getDate()
    );

    state.events[dateStr] = (state.events[dateStr] || []).filter(ev => ev.id !== deleteBtn.dataset.id);
    if (state.events[dateStr].length === 0) {
      delete state.events[dateStr];
    }

    saveState();
    renderEvents();
    renderCalendar();
  }
});

function updatePomodoroDisplay() {
  const phase = document.getElementById('pomodoroPhase');
  const time = document.getElementById('pomodoroTime');
  const cycles = document.getElementById('pomodoroCycles');

  phase.textContent = state.pomodoro.isWorkPhase ? 'Work' : 'Break';
  phase.className = 'pomodoro-phase' + (state.pomodoro.isWorkPhase ? '' : ' break');

  const mins = Math.floor(state.pomodoro.timeLeft / 60);
  const secs = state.pomodoro.timeLeft % 60;
  time.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  cycles.textContent = `Cycles: ${state.pomodoro.cycles}`;
}

const pomodoroAudio = new Audio('gustavorezende-bell-172780.mp3');

function pomodoroNotify(message) {
  pomodoroAudio.currentTime = 0;
  pomodoroAudio.play();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Pomodoro Timer', { body: message });
  }
}

function pomodoroTick() {
  state.pomodoro.timeLeft--;

  if (state.pomodoro.timeLeft <= 0) {
    if (state.pomodoro.isWorkPhase) {
      state.pomodoro.isWorkPhase = false;
      state.pomodoro.timeLeft = state.pomodoro.breakTime * 60;
      pomodoroNotify('Work time is over! Time for a break.');
    } else {
      state.pomodoro.isWorkPhase = true;
      state.pomodoro.timeLeft = state.pomodoro.workTime * 60;
      state.pomodoro.cycles++;
      pomodoroNotify('Break is over! Time to focus.');
    }
  }

  updatePomodoroDisplay();
}

function togglePomodoro() {
  if (state.pomodoro.isRunning) {
    clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = false;
    document.getElementById('pomodoroStartBtn').classList.remove('hidden');
    document.getElementById('pomodoroPauseBtn').classList.add('hidden');
  } else {
    state.pomodoro.isRunning = true;
    state.pomodoro.interval = setInterval(pomodoroTick, 1000);
    document.getElementById('pomodoroStartBtn').classList.add('hidden');
    document.getElementById('pomodoroPauseBtn').classList.remove('hidden');
  }
}

function resetPomodoro() {
  if (state.pomodoro.isRunning) {
    clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = false;
  }
  state.pomodoro.isWorkPhase = true;
  state.pomodoro.timeLeft = state.pomodoro.workTime * 60;
  state.pomodoro.cycles = 0;
  document.getElementById('pomodoroStartBtn').classList.remove('hidden');
  document.getElementById('pomodoroPauseBtn').classList.add('hidden');
  updatePomodoroDisplay();
}

document.getElementById('pomodoroWorkTime').value = state.pomodoro.workTime;
document.getElementById('pomodoroBreakTime').value = state.pomodoro.breakTime;
state.pomodoro.timeLeft = state.pomodoro.workTime * 60;

document.getElementById('pomodoroApplyBtn').addEventListener('click', () => {
  const work = parseInt(document.getElementById('pomodoroWorkTime').value);
  const breakT = parseInt(document.getElementById('pomodoroBreakTime').value);
  if (work > 0 && breakT > 0) {
    state.pomodoro.workTime = work;
    state.pomodoro.breakTime = breakT;
    localStorage.setItem('pomodoroWorkTime', work);
    localStorage.setItem('pomodoroBreakTime', breakT);
    resetPomodoro();
  }
});

document.getElementById('pomodoroStartBtn').addEventListener('click', togglePomodoro);
document.getElementById('pomodoroPauseBtn').addEventListener('click', togglePomodoro);
document.getElementById('pomodoroResetBtn').addEventListener('click', resetPomodoro);

function init() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  renderSubjects();
  renderTodos();
  renderCalendar();
  updatePomodoroDisplay();

  if (state.subjects.length > 0) {
    state.activeSubject = state.subjects[0].id;
    renderSubjects();
  }

  const today = new Date();
  selectDate(formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()));
}

init();
