  // Define the localStorage keys at the top of your file
const STORAGE_USERS = 'todo_users';
const STORAGE_SESSION = 'todo_session';
const STORAGE_TASKS = 'todo_tasks';

const elements = {
      authPanel: document.getElementById('authPanel'),
      dashboard: document.getElementById('dashboard'),
      loginTab: document.getElementById('loginTab'),
      registerTab: document.getElementById('registerTab'),
      loginForm: document.getElementById('loginForm'),
      registerForm: document.getElementById('registerForm'),
      loginEmail: document.getElementById('loginEmail'),
      loginPassword: document.getElementById('loginPassword'),
      registerName: document.getElementById('registerName'),
      registerEmail: document.getElementById('registerEmail'),
      registerPassword: document.getElementById('registerPassword'),
      logoutBtn: document.getElementById('logoutBtn'),
      welcomeName: document.getElementById('welcomeName'),
      taskForm: document.getElementById('taskForm'),
      formHeading: document.getElementById('formHeading'),
      cancelEditBtn: document.getElementById('cancelEditBtn'),
      taskTitle: document.getElementById('taskTitle'),
      taskDescription: document.getElementById('taskDescription'),
      taskDueDate: document.getElementById('taskDueDate'),
      taskDuration: document.getElementById('taskDuration'),
      taskReminder: document.getElementById('taskReminder'),
      taskEmail: document.getElementById('taskEmail'),
      taskList: document.getElementById('taskList'),
      taskCount: document.getElementById('taskCount'),
      toast: document.getElementById('toast'),
    };

    let currentUser = null;
    let tasks = [];
    let editTaskId = null;
    let timerInterval = null;

    function showToast(message, type = 'success') {
      elements.toast.textContent = message;
      elements.toast.className = `toast ${type}`;
      elements.toast.classList.remove('hidden');
      clearTimeout(elements.toast.hideTimeout);
      elements.toast.hideTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
      }, 3200);
    }

    function loadUsers() {
      return JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}');
    }

    function saveUsers(users) {
      localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    }

    function setSession(email) {
      localStorage.setItem(STORAGE_SESSION, email);
    }

    function getSession() {
      return localStorage.getItem(STORAGE_SESSION);
    }

    function clearSession() {
      localStorage.removeItem(STORAGE_SESSION);
    }

    function loadTasks() {
      const dataset = JSON.parse(localStorage.getItem(STORAGE_TASKS) || '{}');
      return currentUser ? dataset[currentUser.email] || [] : [];
    }

    function saveTasks() {
      const dataset = JSON.parse(localStorage.getItem(STORAGE_TASKS) || '{}');
      dataset[currentUser.email] = tasks;
      localStorage.setItem(STORAGE_TASKS, JSON.stringify(dataset));
    }

    function getNowISO() {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
    }

    function showPanel(authVisible) {
      elements.authPanel.classList.toggle('hidden', !authVisible);
      elements.dashboard.classList.toggle('hidden', authVisible);
    }

    function activateTab(tabName) {
      const loginActive = tabName === 'login';
      elements.loginTab.classList.toggle('active', loginActive);
      elements.registerTab.classList.toggle('active', !loginActive);
      elements.loginForm.classList.toggle('hidden', !loginActive);
      elements.registerForm.classList.toggle('hidden', loginActive);
    }

    function renderTasks() {
      elements.taskList.innerHTML = '';
      elements.taskCount.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;

      if (!tasks.length) {
        const placeholder = document.createElement('div');
        placeholder.className = 'task-card';
        placeholder.innerHTML = '<p class="note">No tasks yet. Add your first task to start the countdown and reminders.</p>';
        elements.taskList.appendChild(placeholder);
        return;
      }

      tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

      tasks.forEach((task) => {
        const card = document.createElement('article');
        card.className = 'task-card';
        const dueDate = new Date(task.dueDate);
        const isDue = new Date() >= dueDate;
        if (isDue) card.classList.add('due');

        card.innerHTML = `
          <div class="task-title">
            <div>
              <h3>${escapeHtml(task.title)}</h3>
              <p class="note">${escapeHtml(task.description || 'No description added.')}</p>
            </div>
            <span class="badge">${task.status || 'Pending'}</span>
          </div>
          <div class="task-meta">
            <div><strong>Countdown:</strong> <span class="countdown" data-task-id="${task.id}">${formatCountdown(task)}</span></div>
            <div><strong>Deadline:</strong> ${dueDate.toLocaleString()}</div>
            <div><strong>Duration:</strong> ${task.duration} min</div>
            <div><strong>Reminder:</strong> ${task.reminderMinutes} min before</div>
            <div><strong>Reminder email:</strong> ${task.email || currentUser.email}</div>
          </div>
          <div class="task-actions">
            <button class="button secondary" data-action="edit" data-id="${task.id}">Edit</button>
            <button class="button danger" data-action="delete" data-id="${task.id}">Delete</button>
            <button class="button primary" data-action="email" data-id="${task.id}">Reminder email</button>
          </div>
        `;

        elements.taskList.appendChild(card);
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatCountdown(task) {
      const now = Date.now();
      const due = new Date(task.dueDate).getTime();
      const diff = due - now;
      if (diff <= 0) return 'Deadline reached';
      const seconds = Math.floor(diff / 1000);
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${days ? days + 'd ' : ''}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }

    function updateCountdowns() {
      document.querySelectorAll('.countdown').forEach((span) => {
        const id = span.dataset.taskId;
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        span.textContent = formatCountdown(task);
        const dueTime = new Date(task.dueDate).getTime();
        if (!task.alarmSent && Date.now() >= dueTime) {
          task.alarmSent = true;
          saveTasks();
          showAlarm(task);
          renderTasks();
        }
      });
    }

    function showAlarm(task) {
      showToast(`Alarm: "${task.title}" is due now!`, 'error');
      playAlarmTone();
      if (Notification.permission === 'granted') {
        new Notification('Task alarm', {
          body: `${task.title} is due now!`,
          icon: 'https://img.icons8.com/fluency/48/000000/alarm-clock.png',
        });
      }
    }

    function playAlarmTone() {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 520;
        oscillator.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.45);
      } catch (error) {
        console.warn('Alarm tone unsupported', error);
      }
    }

    function scheduleReminder(task) {
      if (!task.reminderMinutes || !task.dueDate) return;
      const reminderTime = new Date(task.dueDate).getTime() - task.reminderMinutes * 60000;
      task.reminderTime = reminderTime;
      task.reminderSent = task.reminderSent || false;
      saveTasks();
      const delay = reminderTime - Date.now();
      if (delay <= 0 || task.reminderSent) return;
      setTimeout(() => {
        showReminder(task);
      }, delay);
    }

    function showReminder(task) {
      if (task.reminderSent) return;
      task.reminderSent = true;
      saveTasks();
      showToast(`Reminder: ${task.title} is coming up in ${task.reminderMinutes} min.`, 'success');
      if (Notification.permission === 'granted') {
        new Notification('Task reminder', {
          body: `${task.title} is due at ${new Date(task.dueDate).toLocaleTimeString()}`,
          icon: 'https://img.icons8.com/fluency/48/000000/appointment-reminders.png',
        });
      }
      if (task.email) {
        const message = `Reminder for task: ${task.title} (due ${new Date(task.dueDate).toLocaleString()})`;
        const subject = encodeURIComponent(`Task Reminder: ${task.title}`);
        const body = encodeURIComponent(message);
        window.open(`mailto:${encodeURIComponent(task.email)}?subject=${subject}&body=${body}`, '_blank');
      }
    }

    function scheduleAllReminders() {
      tasks.forEach((task) => {
        scheduleReminder(task);
      });
    }

    function handleLogin(event) {
      event.preventDefault();
      const email = elements.loginEmail.value.trim().toLowerCase();
      const password = elements.loginPassword.value.trim();
      const users = loadUsers();
      if (!email || !password) {
        showToast('Enter both email and password.', 'error');
        return;
      }
      if (!users[email] || users[email].password !== password) {
        showToast('Login failed. Check your credentials.', 'error');
        return;
      }
      currentUser = users[email];
      setSession(email);
      openDashboard();
      showToast('Login successful!');
    }

    function handleRegister(event) {
      event.preventDefault();
      const name = elements.registerName.value.trim();
      const email = elements.registerEmail.value.trim().toLowerCase();
      const password = elements.registerPassword.value.trim();
      if (!name || !email || !password) {
        showToast('Fill all registration fields.', 'error');
        return;
      }
      const users = loadUsers();
      if (users[email]) {
        showToast('Email already registered. Please login.', 'error');
        return;
      }
      users[email] = {
        name,
        email,
        password,
      };
      saveUsers(users);
      showToast('Registration complete! You can now log in.');
      activateTab('login');
    }

    function handleLogout() {
      clearSession();
      currentUser = null;
      tasks = [];
      editTaskId = null;
      showPanel(true);
      elements.loginForm.reset();
      elements.registerForm.reset();
      if (timerInterval) clearInterval(timerInterval);
    }

    function openDashboard() {
      elements.authPanel.classList.add('hidden');
      elements.dashboard.classList.remove('hidden');
      elements.welcomeName.textContent = currentUser.name;
      loadUserTasks();
      renderTasks();
      scheduleAllReminders();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(updateCountdowns, 1000);
    }

    function loadUserTasks() {
      tasks = loadTasks();
      tasks.forEach((task) => {
        task.reminderSent = task.reminderSent || false;
        task.alarmSent = task.alarmSent || false;
      });
    }

    function handleTaskSubmit(event) {
      event.preventDefault();
      const title = elements.taskTitle.value.trim();
      const description = elements.taskDescription.value.trim();
      const dueDate = elements.taskDueDate.value;
      const duration = parseInt(elements.taskDuration.value, 10);
      const reminderMinutes = parseInt(elements.taskReminder.value, 10) || 0;
      const email = elements.taskEmail.value.trim();
      if (!title || !dueDate || !duration) {
        showToast('Please fill title, deadline and duration.', 'error');
        return;
      }
      const dueTimestamp = new Date(dueDate).getTime();
      if (isNaN(dueTimestamp) || dueTimestamp <= Date.now()) {
        showToast('Choose a deadline in the future.', 'error');
        return;
      }
      if (editTaskId) {
        const task = tasks.find((task) => task.id === editTaskId);
        if (!task) return;
        task.title = title;
        task.description = description;
        task.dueDate = dueDate;
        task.duration = duration;
        task.reminderMinutes = reminderMinutes;
        task.email = email;
        task.alarmSent = false;
        task.reminderSent = false;
        showToast('Task updated successfully.');
      } else {
        tasks.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title,
          description,
          dueDate,
          duration,
          reminderMinutes,
          email,
          status: 'Pending',
          reminderSent: false,
          alarmSent: false,
        });
        showToast('Task created successfully.');
      }
      saveTasks();
      scheduleAllReminders();
      elements.taskForm.reset();
      elements.taskDueDate.value = getNowISO();
      editTaskId = null;
      elements.cancelEditBtn.classList.add('hidden');
      elements.formHeading.textContent = 'Create a new task';
      renderTasks();
    }

    function handleTaskClick(event) {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.action;
      const taskId = button.dataset.id;
      if (action === 'edit') return beginTaskEdit(taskId);
      if (action === 'delete') return deleteTask(taskId);
      if (action === 'email') return sendReminderEmail(taskId);
    }

    function beginTaskEdit(taskId) {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      editTaskId = task.id;
      elements.taskTitle.value = task.title;
      elements.taskDescription.value = task.description;
      elements.taskDueDate.value = task.dueDate;
      elements.taskDuration.value = task.duration;
      elements.taskReminder.value = task.reminderMinutes;
      elements.taskEmail.value = task.email;
      elements.formHeading.textContent = 'Edit task';
      elements.cancelEditBtn.classList.remove('hidden');
    }

    function deleteTask(taskId) {
      tasks = tasks.filter((task) => task.id !== taskId);
      saveTasks();
      renderTasks();
      showToast('Task deleted.');
    }

    function sendReminderEmail(taskId) {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      const recipient = task.email || currentUser.email;
      if (!recipient) {
        showToast('No reminder email address available.', 'error');
        return;
      }
      const subject = encodeURIComponent(`Reminder: ${task.title}`);
      const body = encodeURIComponent(
        `Task: ${task.title}\nDue: ${new Date(task.dueDate).toLocaleString()}\nDuration: ${task.duration} min\nDescription: ${task.description}`
      );
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
    }

    function setupSession() {
      const storedEmail = getSession();
      if (!storedEmail) {
        showPanel(true);
        return;
      }
      const users = loadUsers();
      const user = users[storedEmail];
      if (!user) {
        clearSession();
        showPanel(true);
        return;
      }
      currentUser = user;
      openDashboard();
    }

    function requestNotificationPermission() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    function initEvents() {
      elements.loginTab.addEventListener('click', () => activateTab('login'));
      elements.registerTab.addEventListener('click', () => activateTab('register'));
      elements.loginForm.addEventListener('submit', handleLogin);
      elements.registerForm.addEventListener('submit', handleRegister);
      elements.logoutBtn.addEventListener('click', handleLogout);
      elements.taskForm.addEventListener('submit', handleTaskSubmit);
      elements.taskList.addEventListener('click', handleTaskClick);
      elements.cancelEditBtn.addEventListener('click', () => {
        editTaskId = null;
        elements.taskForm.reset();
        elements.formHeading.textContent = 'Create a new task';
        elements.cancelEditBtn.classList.add('hidden');
      });
    }

    function init() {
      initEvents();
      requestNotificationPermission();
      elements.taskDueDate.value = getNowISO();
      setupSession();
    }

    init();
  
