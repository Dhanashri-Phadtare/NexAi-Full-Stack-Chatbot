document.addEventListener('DOMContentLoaded', () => { 
    
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.reload();
        }
    });

    const chatArea = document.getElementById('chatArea');
    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');

    const appContainer = document.getElementById('appContainer');
    const menuBtn = document.getElementById('menuBtn');
    const toolBtn = document.getElementById('toolBtn');

    const newChatBtn = document.getElementById('newChatBtn');
    const chatHistoryList = document.getElementById('chatHistoryList');
    const historyEmptyState = document.getElementById('historyEmptyState');
    const historyNavLink = document.getElementById('historyNavLink');

    const graphToolBtn = document.getElementById('graphToolBtn');
    const usageChartPanel = document.getElementById('usageChartPanel');
    const usageChartCanvas = document.getElementById('usageChart');

    const profileBtn = document.getElementById('profileBtn');
    const profileBtnName = document.getElementById('profileBtnName');
    const profileModalOverlay = document.getElementById('profileModalOverlay');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileModalName = document.getElementById('profileModalName');
    const profileModalEmail = document.getElementById('profileModalEmail');
    const profileModalJoined = document.getElementById('profileModalJoined');
    const profileModalPlan = document.getElementById('profileModalPlan');
    const profileModalChatCount = document.getElementById('profileModalChatCount');

    // --- Settings ---
    const settingsNavLink = document.getElementById('settingsNavLink');
    const settingsModalOverlay = document.getElementById('settingsModalOverlay');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const themeToggle = document.getElementById('themeToggle');
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    const soundToggle = document.getElementById('soundToggle');
    const settingsNameInput = document.getElementById('settingsNameInput');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const nameFeedback = document.getElementById('nameFeedback');
    const settingsEmailInput = document.getElementById('settingsEmailInput');
    const emailPasswordInput = document.getElementById('emailPasswordInput');
    const saveEmailBtn = document.getElementById('saveEmailBtn');
    const emailFeedback = document.getElementById('emailFeedback');
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    const passwordFeedback = document.getElementById('passwordFeedback');

    // --- Projects ---
    const projectsList = document.getElementById('projectsList');
    const projectsEmptyState = document.getElementById('projectsEmptyState');
    const newProjectBtn = document.getElementById('newProjectBtn');
    const projectModalOverlay = document.getElementById('projectModalOverlay');
    const closeProjectModal = document.getElementById('closeProjectModal');
    const projectModalTitle = document.getElementById('projectModalTitle');
    const projectChatList = document.getElementById('projectChatList');

    let isFirstMessage = true;
    let currentSettings = { theme: 'dark', font_size: 'medium', sound_enabled: true };
    let currentProfile = { name: 'Guest User', email: 'guest@nexai.dev', joined: '—', plan: 'Free' };
    let savedChats = [];
    let projects = [];
    let actionItems = [];

    // ================================================================
    // Chat
    // ================================================================

    async function sendMessage() {
    const text = userInput.value.trim();
    if (text === "") return;

    if (isFirstMessage) {
        chatArea.classList.add("bottom-mode");
        chatArea.classList.add('active-chat');
        isFirstMessage = false;
    }

    appendMessage('user', 'User', text);
    logUserMessage(text);
    playBeep(520);
    userInput.value = '';

    sendBtn.disabled = true;
    userInput.disabled = true;

    showTyping();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await response.json();

        removeTyping();
        playBeep(380);

        const botMsg = createBotMessage();
        await typeMessage(botMsg, data.response);

        const bubble = botMsg.querySelector('.bubble');
        bubble.innerHTML = marked.parse(data.response);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (data.new_action_items && data.new_action_items.length > 0) {
            await loadActionItems();
            renderActionItemsList();
        }
    } catch (error) {
        removeTyping();
        appendMessage('bot', 'System Error', 'Failed to reach backend services.', false);
    } finally {
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

    function appendMessage(sender, name, text, isHTML = false) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        msgDiv.innerHTML = `
            <div class="message-wrapper">
                <div class="meta">${name}</div>
                <div class="bubble"></div>
            </div>
        `;
        const bubble = msgDiv.querySelector('.bubble');
        if (isHTML) bubble.innerHTML = text; else bubble.textContent = text;

        chatMessages.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showTyping() {
        if (document.getElementById('typingIndicator')) return;
        const typing = document.createElement("div");
        typing.className = "message bot";
        typing.id = "typingIndicator";
        typing.innerHTML = `
            <div class="message-wrapper">
                <div class="meta">NexAi</div>
                <div class="bubble" style="display: flex; gap: 6px;">
                    <span>•</span><span>•</span><span>•</span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typing);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function removeTyping() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Create an empty bot message
function createBotMessage() {

    const message = document.createElement("div");
    message.className = "message bot";

    message.innerHTML = `
        <div class="message-wrapper">
            <div class="meta">NexAi</div>
            <div class="bubble">
                <span class="typing-text"></span><span class="cursor">▋</span>
            </div>
        </div>
    `;

    chatMessages.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return message;
}


// Typewriter animation
async function typeMessage(messageElement, text) {

    const typingText = messageElement.querySelector(".typing-text");
    const cursor = messageElement.querySelector(".cursor");

    typingText.textContent = "";

    for (let i = 0; i < text.length; i++) {

        typingText.textContent += text.charAt(i);

        chatContainer.scrollTop = chatContainer.scrollHeight;

        await new Promise(resolve => setTimeout(resolve, 20));
    }

    cursor.remove();
}

    // ================================================================
    // Sidebar / Toolkit toggle (UI-only preference)
    // ================================================================

    const PANEL_STATE_KEY = 'nexai_panel_state';

    function applyPanelState(state) {
        appContainer.classList.toggle('hide-sidebar', !!state.hideSidebar);
        appContainer.classList.toggle('hide-tool', !!state.hideTool);
    }
    function getPanelState() {
        return {
            hideSidebar: appContainer.classList.contains('hide-sidebar'),
            hideTool: appContainer.classList.contains('hide-tool'),
        };
    }
    function savePanelState() {
        try { localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(getPanelState())); }
        catch (e) { console.warn('Could not save panel state', e); }
    }
    try {
        const saved = JSON.parse(localStorage.getItem(PANEL_STATE_KEY) || 'null');
        if (saved) applyPanelState(saved);
    } catch (e) { console.warn('Could not restore panel state', e); }

    menuBtn.addEventListener('click', () => { appContainer.classList.toggle('hide-sidebar'); savePanelState(); });
    toolBtn.addEventListener('click', () => { appContainer.classList.toggle('hide-tool'); savePanelState(); });

    // ================================================================
    // Saved chat history (backed by the database, per logged-in user)
    // ================================================================

    async function loadSavedChats() {
        try {
            const res = await fetch('/api/chats');
            savedChats = await res.json();
        } catch (e) {
            console.warn('Could not load saved chats', e);
            savedChats = [];
        }
    }

    async function saveCurrentChatIfNotEmpty() {
        if (chatMessages.children.length === 0) return;
        try {
            await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: deriveChatTitle(), html: chatMessages.innerHTML })
            });
            await loadSavedChats();
        } catch (e) {
            console.warn('Could not save chat', e);
        }
    }

    let historySearchTerm = '';

    function renderHistoryList() {
        chatHistoryList.querySelectorAll('.history-item').forEach(n => n.remove());

        const filteredChats = historySearchTerm
            ? savedChats.filter(c => c.title.toLowerCase().includes(historySearchTerm))
            : savedChats;

        const noneFound = filteredChats.length === 0;
        historyEmptyState.style.display = noneFound ? 'block' : 'none';
        historyEmptyState.textContent = savedChats.length === 0
            ? 'No saved chats yet.'
            : 'No chats match your search.';

        filteredChats.forEach(chat => {
            const item = document.createElement('button');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="history-item-label"></span>
                <select class="history-item-project-select" title="Move to project"></select>
                <i class="fa-solid fa-trash history-item-delete"></i>
            `;
            item.querySelector('.history-item-label').textContent = chat.title;

            const select = item.querySelector('.history-item-project-select');
            const noneOpt = document.createElement('option');
            noneOpt.value = '';
            noneOpt.textContent = 'No folder';
            select.appendChild(noneOpt);
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                if (chat.project_id === p.id) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('click', (e) => e.stopPropagation());
            select.addEventListener('change', async (e) => {
                e.stopPropagation();
                const value = select.value ? parseInt(select.value) : null;
                await fetch(`/api/chats/${chat.id}/project`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: value })
                });
                await loadProjects();
                renderProjectsList();
            });

            item.addEventListener('click', async (e) => {
                if (e.target.closest('.history-item-delete') || e.target.closest('.history-item-project-select')) return;
                await openSavedChat(chat.id);
            });
            item.querySelector('.history-item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/chats/${chat.id}`, { method: 'DELETE' });
                await loadSavedChats();
                renderHistoryList();
            });

            chatHistoryList.appendChild(item);
        });
    }

    const historySearchInput = document.getElementById('historySearchInput');
    historySearchInput.addEventListener('input', () => {
        historySearchTerm = historySearchInput.value.trim().toLowerCase();
        renderHistoryList();
    });

    let isHistoryOpen = false;

    async function setHistoryOpen(open) {
        isHistoryOpen = open;
        historyNavLink.classList.toggle('active', open);
        chatHistoryList.style.display = open ? 'flex' : 'none';
        if (open) {
            historySearchTerm = '';
            historySearchInput.value = '';
            await Promise.all([loadSavedChats(), loadProjects()]);
            renderHistoryList();
        }
    }

    historyNavLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await setHistoryOpen(!isHistoryOpen);
    });

    function deriveChatTitle() {
        const firstUserBubble = chatMessages.querySelector('.message.user .bubble');
        if (firstUserBubble && firstUserBubble.textContent.trim()) {
            return firstUserBubble.textContent.trim().slice(0, 32);
        }
        return 'Untitled chat';
    }

    function clearChatToLandingState() {
        chatMessages.innerHTML = '';
        chatArea.classList.remove('active-chat', 'bottom-mode');
        isFirstMessage = true;
        userInput.value = '';
        userInput.focus();
    }

    async function openSavedChat(id) {
        const chat = savedChats.find(c => c.id === id);
        if (!chat) return;

        await saveCurrentChatIfNotEmpty();

        chatMessages.innerHTML = chat.html;
        chatArea.classList.add('active-chat', 'bottom-mode');
        isFirstMessage = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;

        await fetch(`/api/chats/${id}`, { method: 'DELETE' });
        await loadSavedChats();
        await setHistoryOpen(false);
    }

    newChatBtn.addEventListener('click', async () => {
        await saveCurrentChatIfNotEmpty();
        clearChatToLandingState();
        await setHistoryOpen(false);
    });

    setHistoryOpen(false);

    // ================================================================
    // Projects (folders that group saved chats)
    // ================================================================

    async function loadProjects() {
        try {
            const res = await fetch('/api/projects');
            projects = await res.json();
        } catch (e) {
            console.warn('Could not load projects', e);
            projects = [];
        }
    }

    function renderProjectsList() {
        projectsList.querySelectorAll('.project-item').forEach(n => n.remove());
        projectsEmptyState.style.display = projects.length === 0 ? 'block' : 'none';

        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.innerHTML = `
                <i class="fa-solid fa-folder" style="color: var(--accent-blue);"></i>
                <span class="project-item-label"></span>
                <span class="project-chat-count"></span>
                <i class="fa-solid fa-trash project-delete" title="Delete project"></i>
            `;
            item.querySelector('.project-item-label').textContent = project.name;
            item.querySelector('.project-chat-count').textContent = project.chat_count;

            item.addEventListener('click', async (e) => {
                if (e.target.closest('.project-delete')) return;
                await openProjectModal(project);
            });
            item.querySelector('.project-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
                await loadProjects();
                renderProjectsList();
                if (isHistoryOpen) renderHistoryList();
            });

            projectsList.appendChild(item);
        });
    }

    newProjectBtn.addEventListener('click', () => {
        if (document.getElementById('newProjectInputRow')) return;

        const row = document.createElement('div');
        row.className = 'new-project-input-row';
        row.id = 'newProjectInputRow';
        row.innerHTML = `<input type="text" placeholder="Project name" id="newProjectInput"><button id="confirmNewProjectBtn">Add</button>`;
        newProjectBtn.parentNode.insertBefore(row, newProjectBtn);

        const input = row.querySelector('#newProjectInput');
        input.focus();

        async function submit() {
            const name = input.value.trim();
            row.remove();
            if (!name) return;
            await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            await loadProjects();
            renderProjectsList();
        }

        row.querySelector('#confirmNewProjectBtn').addEventListener('click', submit);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
        input.addEventListener('blur', () => { if (document.getElementById('newProjectInputRow')) submit(); });
    });

    async function openProjectModal(project) {
        projectModalTitle.textContent = project.name;
        projectChatList.innerHTML = '';

        let chats = [];
        try {
            const res = await fetch(`/api/chats?project_id=${project.id}`);
            chats = await res.json();
        } catch (e) {
            console.warn('Could not load project chats', e);
        }

        if (chats.length === 0) {
            projectChatList.innerHTML = '<p class="history-empty">No chats here yet. Assign one from History using its folder dropdown.</p>';
        }

        chats.forEach(chat => {
            const item = document.createElement('button');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="history-item-label"></span>
                <i class="fa-solid fa-xmark history-item-delete" title="Remove from project"></i>
            `;
            item.querySelector('.history-item-label').textContent = chat.title;

            item.addEventListener('click', async (e) => {
                if (e.target.closest('.history-item-delete')) return;
                projectModalOverlay.classList.remove('open');
                await openSavedChat(chat.id);
            });
            item.querySelector('.history-item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/chats/${chat.id}/project`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: null })
                });
                await loadProjects();
                renderProjectsList();
                await openProjectModal(project);
            });

            projectChatList.appendChild(item);
        });

        projectModalOverlay.classList.add('open');
    }

    closeProjectModal.addEventListener('click', () => projectModalOverlay.classList.remove('open'));
    projectModalOverlay.addEventListener('click', (e) => { if (e.target === projectModalOverlay) projectModalOverlay.classList.remove('open'); });

    // ================================================================
    // Action items (detected from phrases like "remind me to...",
    // "I need to...", "follow up on..." — see extract_action_items()
    // server-side in app.py)
    // ================================================================

    const actionItemsList = document.getElementById('actionItemsList');
    const actionItemsEmptyState = document.getElementById('actionItemsEmptyState');

    async function loadActionItems() {
        try {
            const res = await fetch('/api/action-items');
            actionItems = await res.json();
        } catch (e) {
            console.warn('Could not load action items', e);
            actionItems = [];
        }
    }

    function labelClass(label) {
        return 'label-' + label.toLowerCase().replace(/\s+/g, '-');
    }

    function renderActionItemsList() {
        actionItemsList.querySelectorAll('.action-item').forEach(n => n.remove());
        actionItemsEmptyState.style.display = actionItems.length === 0 ? 'block' : 'none';

        actionItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'action-item' + (item.completed ? ' completed' : '');
            row.innerHTML = `
                <input type="checkbox" class="action-item-checkbox" ${item.completed ? 'checked' : ''}>
                <div class="action-item-body">
                    <span class="action-item-label ${labelClass(item.label)}"></span>
                    <div class="action-item-text"></div>
                </div>
                <i class="fa-solid fa-xmark action-item-delete" title="Remove"></i>
            `;
            row.querySelector('.action-item-label').textContent = item.label;
            row.querySelector('.action-item-text').textContent = item.text;

            row.querySelector('.action-item-checkbox').addEventListener('change', async (e) => {
                await fetch(`/api/action-items/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: e.target.checked })
                });
                await loadActionItems();
                renderActionItemsList();
            });

            row.querySelector('.action-item-delete').addEventListener('click', async () => {
                await fetch(`/api/action-items/${item.id}`, { method: 'DELETE' });
                await loadActionItems();
                renderActionItemsList();
            });

            actionItemsList.appendChild(row);
        });
    }

    // ================================================================
    // User profile button + modal
    // ================================================================

    async function fetchProfile() {
        try {
            const res = await fetch('/api/profile');
            if (!res.ok) return;
            const data = await res.json();
            currentProfile = { ...currentProfile, ...data };
            profileBtnName.textContent = currentProfile.name;
        } catch (e) { /* keep placeholder */ }
    }

    async function openProfileModal() {
        await loadSavedChats();
        profileModalName.textContent = currentProfile.name;
        profileModalEmail.textContent = currentProfile.email;
        profileModalJoined.textContent = currentProfile.joined;
        profileModalPlan.textContent = currentProfile.plan;
        profileModalChatCount.textContent = savedChats.length;
        profileModalOverlay.classList.add('open');
    }
    function closeProfileModalFn() { profileModalOverlay.classList.remove('open'); }

    profileBtn.addEventListener('click', openProfileModal);
    closeProfileModal.addEventListener('click', closeProfileModalFn);
    profileModalOverlay.addEventListener('click', (e) => { if (e.target === profileModalOverlay) closeProfileModalFn(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProfileModalFn();
            settingsModalOverlay.classList.remove('open');
            projectModalOverlay.classList.remove('open');
        }
    });

    // ================================================================
    // Settings: theme, font size, sound, account
    // ================================================================

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    }
    function applyFontSize(size) {
        const map = { small: '13px', medium: '14px', large: '16px' };
        document.documentElement.style.setProperty('--chat-font-size', map[size] || map.medium);
    }
    function applyFontFamily(family) {
        const map = {
            sans: "'Inter', sans-serif",
            serif: "Georgia, 'Times New Roman', serif",
            mono: "'Courier New', Consolas, monospace",
        };
        document.documentElement.style.setProperty('--chat-font-family', map[family] || map.sans);
    }
    function applySettingsToUI(settings) {
        applyTheme(settings.theme);
        applyFontSize(settings.font_size);
        applyFontFamily(settings.font_family);
        themeToggle.querySelectorAll('.toggle-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === settings.theme);
        });
        fontSizeSelect.value = settings.font_size;
        fontFamilySelect.value = settings.font_family || 'sans';
        soundToggle.checked = !!settings.sound_enabled;
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            currentSettings = await res.json();
        } catch (e) { console.warn('Could not load settings', e); }
        applySettingsToUI(currentSettings);
    }

    async function saveSettingsPatch(patch) {
        currentSettings = { ...currentSettings, ...patch };
        applySettingsToUI(currentSettings);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            });
        } catch (e) { console.warn('Could not save settings', e); }
    }

    themeToggle.addEventListener('click', (e) => {
        const opt = e.target.closest('.toggle-option');
        if (!opt) return;
        saveSettingsPatch({ theme: opt.dataset.value });
    });
    fontSizeSelect.addEventListener('change', () => saveSettingsPatch({ font_size: fontSizeSelect.value }));
    fontFamilySelect.addEventListener('change', () => saveSettingsPatch({ font_family: fontFamilySelect.value }));
    soundToggle.addEventListener('change', () => saveSettingsPatch({ sound_enabled: soundToggle.checked }));

    settingsNavLink.addEventListener('click', (e) => {
        e.preventDefault();
        settingsNameInput.value = currentProfile.name || '';
        settingsEmailInput.value = currentProfile.email || '';
        nameFeedback.textContent = '';
        emailFeedback.textContent = '';
        passwordFeedback.textContent = '';
        settingsModalOverlay.classList.add('open');
    });
    closeSettingsModal.addEventListener('click', () => settingsModalOverlay.classList.remove('open'));
    settingsModalOverlay.addEventListener('click', (e) => { if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('open'); });

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.settings-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
        });
    });

    saveNameBtn.addEventListener('click', async () => {
        const name = settingsNameInput.value.trim();
        nameFeedback.textContent = '';
        nameFeedback.className = 'settings-feedback';
        try {
            const res = await fetch('/api/account/name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update name');
            currentProfile.name = data.name;
            profileBtnName.textContent = data.name;
            nameFeedback.textContent = 'Name updated.';
            nameFeedback.classList.add('success');
        } catch (e) {
            nameFeedback.textContent = e.message;
            nameFeedback.classList.add('error');
        }
    });

    saveEmailBtn.addEventListener('click', async () => {
        const email = settingsEmailInput.value.trim();
        emailFeedback.textContent = '';
        emailFeedback.className = 'settings-feedback';
        try {
            const res = await fetch('/api/account/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: emailPasswordInput.value })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update email');
            currentProfile.email = data.email;
            emailFeedback.textContent = 'Email updated.';
            emailFeedback.classList.add('success');
            emailPasswordInput.value = '';
        } catch (e) {
            emailFeedback.textContent = e.message;
            emailFeedback.classList.add('error');
        }
    });

    savePasswordBtn.addEventListener('click', async () => {
        passwordFeedback.textContent = '';
        passwordFeedback.className = 'settings-feedback';
        try {
            const res = await fetch('/api/account/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPasswordInput.value,
                    new_password: newPasswordInput.value
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not change password');
            passwordFeedback.textContent = 'Password changed.';
            passwordFeedback.classList.add('success');
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
        } catch (e) {
            passwordFeedback.textContent = e.message;
            passwordFeedback.classList.add('error');
        }
    });

    // ---- Sound effect (Web Audio API — no external audio file needed) ----
    let audioCtx = null;
    function playBeep(freq = 440, duration = 0.08) {
        if (!currentSettings.sound_enabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            oscillator.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) { /* audio not available, ignore */ }
    }

    // ================================================================
    // Usage graph
    // ================================================================

    function scoreDifficulty(text) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const complexKeywords = [
            'explain', 'why', 'compare', 'difference', 'algorithm', 'debug',
            'optimize', 'architecture', 'design', 'implement', 'analyze',
            'because', 'how does', 'proof', 'derive'
        ];
        const lower = text.toLowerCase();
        const keywordHits = complexKeywords.filter(k => lower.includes(k)).length;
        let score = 1;
        if (wordCount > 6) score = 2;
        if (wordCount > 16 || keywordHits >= 1) score = 3;
        return score;
    }

    async function logUserMessage(text) {
        try {
            await fetch('/api/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ts: Date.now(), difficulty: scoreDifficulty(text) })
            });
        } catch (e) { console.warn('Could not log usage', e); }
    }

    async function buildWeeklyStats() {
        let log = [];
        try {
            const res = await fetch('/api/usage');
            log = await res.json();
        } catch (e) { console.warn('Could not load usage log', e); }

        const now = new Date();
        const dayIndex = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() - dayIndex);

        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const counts = new Array(7).fill(0);
        const difficultyTotals = new Array(7).fill(0);
        const difficultyCounts = new Array(7).fill(0);

        log.forEach(entry => {
            const entryDate = new Date(entry.ts);
            const diffDays = Math.floor((entryDate - monday) / (24 * 60 * 60 * 1000));
            if (diffDays >= 0 && diffDays < 7) {
                counts[diffDays] += 1;
                difficultyTotals[diffDays] += entry.difficulty;
                difficultyCounts[diffDays] += 1;
            }
        });

        const avgDifficulty = difficultyTotals.map((total, i) =>
            difficultyCounts[i] ? +(total / difficultyCounts[i]).toFixed(1) : 0
        );

        return { labels, counts, avgDifficulty };
    }

    let usageChartInstance = null;

    async function renderUsageChart() {
        const { labels, counts, avgDifficulty } = await buildWeeklyStats();

        if (usageChartInstance) {
            usageChartInstance.data.labels = labels;
            usageChartInstance.data.datasets[0].data = counts;
            usageChartInstance.data.datasets[1].data = avgDifficulty;
            usageChartInstance.update();
            return;
        }

        usageChartInstance = new Chart(usageChartCanvas.getContext('2d'), {
            data: {
                labels,
                datasets: [
                    { type: 'bar', label: 'Questions asked', data: counts,
                      backgroundColor: 'rgba(0, 229, 255, 0.35)', borderColor: 'rgba(0, 229, 255, 0.9)',
                      borderWidth: 1, borderRadius: 6, yAxisID: 'yCount' },
                    { type: 'line', label: 'Avg. difficulty', data: avgDifficulty,
                      borderColor: '#ff8a65', backgroundColor: '#ff8a65', tension: 0.35,
                      pointRadius: 3, yAxisID: 'yDifficulty' },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#78909c', font: { size: 11 } }, grid: { display: false } },
                    yCount: { position: 'left', beginAtZero: true, ticks: { color: '#78909c', stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    yDifficulty: { position: 'right', beginAtZero: true, max: 3, ticks: { color: '#78909c', stepSize: 1, font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
    }

    graphToolBtn.addEventListener('click', async () => {
        const willOpen = !usageChartPanel.classList.contains('open');
        usageChartPanel.classList.toggle('open', willOpen);
        if (willOpen) await renderUsageChart();
    });

    // ================================================================
    // Initial load
    // ================================================================

    fetchProfile();
    loadSettings();
    loadProjects().then(renderProjectsList);
    loadActionItems().then(renderActionItemsList);
});
