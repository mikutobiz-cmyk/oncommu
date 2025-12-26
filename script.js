/* --- 簡易データベース (メモリ内のみ) --- */
const db = {
    users: [
        { id: 'user1', nickname: '公式Bot', password: '123', icon: 'https://placehold.co/100x100/4CAF50/white?text=Bot', bio: 'システムです', following: 0, followers: 0 }
    ],
    threads: [
        { id: 'open_chat', title: 'オープンチャット', type: 'open', messages: [] },
        { id: 'th1', title: '初心者ギタリスト集まれ', type: 'consultation', messages: [] }
    ],
};

let currentUser = null;
let currentThreadId = null;
let viewingUserId = null; // プロフィール閲覧中のユーザID

/* --- 初期化 --- */
window.onload = function() {
    setTimeout(() => {
        switchScreen('auth-screen');
    }, 1500); // 1.5秒後にスプラッシュから遷移
};

/* --- 画面遷移管理 --- */
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goBack(targetId) {
    switchScreen(targetId);
}

// チャット画面から戻る時
function exitChat() {
    const thread = db.threads.find(t => t.id === currentThreadId);
    if(thread.type === 'open') {
        switchScreen('home-screen');
    } else {
        switchScreen('thread-list-screen');
    }
}

/* --- 認証機能 --- */
function toggleAuthMode() {
    const reg = document.getElementById('auth-mode-register');
    const log = document.getElementById('auth-mode-login');
    if (reg.style.display === 'none') {
        reg.style.display = 'block';
        log.style.display = 'none';
    } else {
        reg.style.display = 'none';
        log.style.display = 'block';
    }
}

function register() {
    const nick = document.getElementById('reg-nickname').value;
    const pass = document.getElementById('reg-password').value;
    if(!nick || !pass) return alert('入力してください');

    const newUser = {
        id: 'user_' + Date.now(),
        nickname: nick,
        password: pass,
        icon: 'https://placehold.co/100x100/orange/white?text=' + nick.charAt(0),
        following: 0,
        followers: 0,
        likedPosts: []
    };
    db.users.push(newUser);
    currentUser = newUser;
    setupHome();
    switchScreen('home-screen');
}

function login() {
    const nick = document.getElementById('login-nickname').value;
    const pass = document.getElementById('login-password').value;
    const user = db.users.find(u => u.nickname === nick && u.password === pass);
    
    if (user) {
        currentUser = user;
        setupHome();
        switchScreen('home-screen');
    } else {
        alert('ユーザが見つかりません');
    }
}

function setupHome() {
    document.getElementById('my-icon-home').style.backgroundImage = `url(${currentUser.icon})`;
}

/* --- スレッド機能 --- */
let currentCategory = '';

function openThreadList(category) {
    currentCategory = category;
    document.getElementById('thread-list-title').innerText = category === 'consultation' ? '相談室' : 'グループ結成';
    renderThreadList();
    switchScreen('thread-list-screen');
}

function renderThreadList() {
    const container = document.getElementById('thread-container');
    container.innerHTML = '';
    const targets = db.threads.filter(t => t.type === currentCategory);
    
    targets.forEach(t => {
        const div = document.createElement('div');
        div.className = 'thread-item';
        div.innerHTML = `<b>${t.title}</b><br><span style="font-size:12px; color:#888;">ID: ${t.id}</span>`;
        div.onclick = () => openChatRoom(t.id, t.title);
        container.appendChild(div);
    });
}

function createNewThread() {
    const title = prompt("スレッドのタイトルを入力してください");
    if(title) {
        const newThread = {
            id: 'th_' + Date.now(),
            title: title,
            type: currentCategory,
            messages: []
        };
        db.threads.push(newThread);
        renderThreadList();
    }
}

/* --- チャット機能 --- */
function openChatRoom(threadId, title) {
    currentThreadId = threadId;
    document.getElementById('chat-title').innerText = title;
    renderMessages();
    switchScreen('chat-screen');
}

function renderMessages() {
    const container = document.getElementById('message-container');
    container.innerHTML = '';
    const thread = db.threads.find(t => t.id === currentThreadId);
    
    thread.messages.forEach((msg, index) => {
        const isMe = msg.senderId === currentUser.id;
        const sender = db.users.find(u => u.id === msg.senderId) || { nickname: '不明', icon: '' };

        const row = document.createElement('div');
        row.className = `message-row ${isMe ? 'my-message' : ''}`;
        
        let html = ``;
        if (!isMe) {
            html += `<div class="msg-icon" style="background-image: url(${sender.icon})" onclick="openProfile('${sender.id}')"></div>`;
        }

        html += `
            <div class="msg-bubble">
                ${!isMe ? `<div class="msg-name">${sender.nickname}</div>` : ''}
                <div class="msg-text">${msg.text}</div>
                <div class="msg-actions">
                    <span class="action-btn" onclick="likeMessage('${thread.id}', ${index})">
                        ❤️ ${msg.likes || 0}
                    </span>
                    ${isMe ? `<span class="action-btn" onclick="deleteMessage('${thread.id}', ${index})">🗑️</span>` : ''}
                </div>
            </div>
        `;
        
        row.innerHTML = html;
        container.appendChild(row);
    });

    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if(!text) return;

    const thread = db.threads.find(t => t.id === currentThreadId);
    thread.messages.push({
        senderId: currentUser.id,
        text: text,
        likes: 0
    });
    
    input.value = '';
    renderMessages();
}

function likeMessage(threadId, msgIndex) {
    const thread = db.threads.find(t => t.id === threadId);
    if(thread.messages[msgIndex]) {
        thread.messages[msgIndex].likes++;
        renderMessages();
    }
}

function deleteMessage(threadId, msgIndex) {
    if(confirm("この投稿を削除しますか？")) {
        const thread = db.threads.find(t => t.id === threadId);
        thread.messages.splice(msgIndex, 1);
        renderMessages();
    }
}

/* --- プロフィール機能 --- */
function goToMyPage() {
    openProfile(currentUser.id);
}

function openProfile(userId) {
    viewingUserId = userId;
    const user = db.users.find(u => u.id === userId);
    const isMe = (currentUser.id === userId);

    document.getElementById('profile-name').innerText = user.nickname;
    document.getElementById('profile-img').style.backgroundImage = `url(${user.icon})`;
    document.getElementById('profile-following').innerText = user.following;
    document.getElementById('profile-followers').innerText = user.followers;

    const actionsDiv = document.getElementById('profile-actions');
    actionsDiv.innerHTML = '';

    if (isMe) {
        actionsDiv.innerHTML = `
            <button class="secondary-btn" style="width:auto; font-size:12px;">プロフィール編集</button>
            <button class="secondary-btn" style="width:auto; font-size:12px;">DM一覧</button>
        `;
    } else {
        actionsDiv.innerHTML = `
            <button class="primary-btn" style="width:auto; padding:5px 15px;">フォローする</button>
            <button class="secondary-btn" style="width:auto; padding:5px 15px;">DMを送る</button>
        `;
    }

    switchScreen('profile-screen');
}

function goBackProfile() {
    if(viewingUserId === currentUser.id) {
        switchScreen('home-screen');
    } else {
        switchScreen('chat-screen');
    }
}
