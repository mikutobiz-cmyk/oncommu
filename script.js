// --- 1. Firebase SDKの読み込み ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, doc, addDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, query, where, orderBy, onSnapshot, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 2. Firebase設定 (ここを書き換えてください！) ---
const firebaseConfig = {apiKey: "AIzaSyDU7ymZdVHEyIzaMjUO4tsPCklY-bcxo-M",
  authDomain: "oncommu-e9716.firebaseapp.com",
  projectId: "oncommu-e9716",
  storageBucket: "oncommu-e9716.firebasestorage.app",
  messagingSenderId: "123394025102",
  appId: "1:123394025102:web:c56c9da7a2a48ac635cbdf"
};

// --- 3. アプリの初期化 ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 状態管理変数
let currentUser = null;
let currentThreadId = null;
let viewingUserId = null;
let unsubscribeChat = null; // チャットのリアルタイム更新停止用

// --- 4. HTML側から関数を呼べるようにする設定 ---
// type="module"にするとHTMLから関数が見えなくなるため、windowに登録します
window.register = register;
window.login = login;
window.toggleAuthMode = toggleAuthMode;
window.switchScreen = switchScreen;
window.goBack = goBack;
window.exitChat = exitChat;
window.goToMyPage = goToMyPage;
window.openChatRoom = openChatRoom;
window.openThreadList = openThreadList;
window.createNewThread = createNewThread;
window.sendMessage = sendMessage;
window.likeMessage = likeMessage;
window.deleteMessage = deleteMessage;
window.openProfile = openProfile;
window.goBackProfile = goBackProfile;


/* --- 初期化処理 --- */
window.onload = function() {
    setTimeout(() => {
        switchScreen('auth-screen');
    }, 1500);
};

/* --- 画面遷移管理 --- */
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goBack(targetId) {
    switchScreen(targetId);
}

function exitChat() {
    // リアルタイム更新を停止
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }

    // 戻り先の判定（簡易的）
    if(currentThreadId === 'open_chat') {
        switchScreen('home-screen');
    } else {
        switchScreen('thread-list-screen');
    }
}

/* --- 認証機能 (Firestoreを使った簡易認証) --- */
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

async function register() {
    const nick = document.getElementById('reg-nickname').value;
    const pass = document.getElementById('reg-password').value;
    if(!nick || !pass) return alert('入力してください');

    try {
        // 同じニックネームがいないかチェック
        const q = query(collection(db, "users"), where("nickname", "==", nick));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return alert("そのニックネームは既に使用されています");
        }

        // Firestoreにユーザ保存
        const docRef = await addDoc(collection(db, "users"), {
            nickname: nick,
            password: pass, // ※実運用ではハッシュ化推奨
            icon: 'https://placehold.co/100x100/orange/white?text=' + nick.charAt(0),
            following: 0,
            followers: 0,
            createdAt: serverTimestamp()
        });

        // ログイン状態にする
        currentUser = { id: docRef.id, nickname: nick, icon: 'https://placehold.co/100x100/orange/white?text=' + nick.charAt(0) };
        setupHome();
        switchScreen('home-screen');

    } catch (e) {
        console.error("登録エラー:", e);
        alert("登録に失敗しました");
    }
}

async function login() {
    const nick = document.getElementById('login-nickname').value;
    const pass = document.getElementById('login-password').value;

    try {
        const q = query(collection(db, "users"), where("nickname", "==", nick), where("password", "==", pass));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            currentUser = { id: userDoc.id, ...userDoc.data() };
            setupHome();
            switchScreen('home-screen');
        } else {
            alert('ニックネームまたはパスワードが違います');
        }
    } catch (e) {
        console.error("ログインエラー:", e);
        alert("ログインに失敗しました");
    }
}

function setupHome() {
    document.getElementById('my-icon-home').style.backgroundImage = `url(${currentUser.icon})`;
}

/* --- スレッド機能 --- */
let currentCategory = '';

async function openThreadList(category) {
    currentCategory = category;
    document.getElementById('thread-list-title').innerText = category === 'consultation' ? '相談室' : 'グループ結成';
    
    // Firestoreからスレッド一覧を取得
    const container = document.getElementById('thread-container');
    container.innerHTML = '読み込み中...';
    
    const q = query(collection(db, "threads"), where("type", "==", category), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    container.innerHTML = '';
    querySnapshot.forEach((doc) => {
        const t = doc.data();
        const div = document.createElement('div');
        div.className = 'thread-item';
        div.innerHTML = `<b>${t.title}</b><br><span style="font-size:12px; color:#888;">作成: ${t.creatorName || '匿名'}</span>`;
        div.onclick = () => openChatRoom(doc.id, t.title);
        container.appendChild(div);
    });

    switchScreen('thread-list-screen');
}

async function createNewThread() {
    const title = prompt("スレッドのタイトルを入力してください");
    if(title) {
        try {
            await addDoc(collection(db, "threads"), {
                title: title,
                type: currentCategory,
                creatorId: currentUser.id,
                creatorName: currentUser.nickname,
                createdAt: serverTimestamp()
            });
            // リストを再読み込み
            openThreadList(currentCategory);
        } catch (e) {
            console.error(e);
            alert("スレッド作成失敗");
        }
    }
}

/* --- チャット機能（リアルタイム） --- */
async function openChatRoom(threadId, title) {
    currentThreadId = threadId;
    document.getElementById('chat-title').innerText = title;
    
    // オープンチャットの場合はドキュメントが存在するか確認し、なければ作る（初回のみ）
    if (threadId === 'open_chat') {
        const docRef = doc(db, "threads", "open_chat");
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            await setDoc(docRef, { title: "オープンチャット", type: "open" });
        }
    }

    switchScreen('chat-screen');
    startChatListener(threadId);
}

function startChatListener(threadId) {
    const container = document.getElementById('message-container');
    container.innerHTML = ''; // クリア

    // サブコレクション 'messages' を監視
    const q = query(
        collection(db, "threads", threadId, "messages"),
        orderBy("createdAt", "asc")
    );

    // リアルタイム更新 (onSnapshot)
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        // 変更があった差分だけ処理することもできますが、今回は全再描画でシンプルにします
        container.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === currentUser.id;
            
            const row = document.createElement('div');
            row.className = `message-row ${isMe ? 'my-message' : ''}`;
            
            let html = ``;
            // 他人ならアイコン表示
            if (!isMe) {
                // アイコンが保存されていなければデフォルト
                const iconUrl = msg.senderIcon || 'https://placehold.co/30x30/ccc/white';
                html += `<div class="msg-icon" style="background-image: url(${iconUrl})" onclick="openProfile('${msg.senderId}')"></div>`;
            }

            html += `
                <div class="msg-bubble">
                    ${!isMe ? `<div class="msg-name">${msg.senderName}</div>` : ''}
                    <div class="msg-text">${msg.text}</div>
                    <div class="msg-actions">
                        <span class="action-btn" onclick="likeMessage('${doc.id}', ${msg.likes || 0})">
                            ❤️ ${msg.likes || 0}
                        </span>
                        ${isMe ? `<span class="action-btn" onclick="deleteMessage('${doc.id}')">🗑️</span>` : ''}
                    </div>
                </div>
            `;
            row.innerHTML = html;
            container.appendChild(row);
        });

        // 最下部へスクロール
        container.scrollTop = container.scrollHeight;
    });
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if(!text) return;

    try {
        // メッセージを追加
        await addDoc(collection(db, "threads", currentThreadId, "messages"), {
            text: text,
            senderId: currentUser.id,
            senderName: currentUser.nickname,
            senderIcon: currentUser.icon,
            likes: 0,
            createdAt: serverTimestamp()
        });
        input.value = '';
    } catch (e) {
        console.error("送信エラー:", e);
    }
}

async function likeMessage(messageId, currentLikes) {
    try {
        const msgRef = doc(db, "threads", currentThreadId, "messages", messageId);
        await updateDoc(msgRef, {
            likes: currentLikes + 1
        });
    } catch (e) {
        console.error("いいねエラー:", e);
    }
}

async function deleteMessage(messageId) {
    if(confirm("この投稿を削除しますか？")) {
        try {
            const msgRef = doc(db, "threads", currentThreadId, "messages", messageId);
            await deleteDoc(msgRef);
        } catch (e) {
            console.error("削除エラー:", e);
        }
    }
}

/* --- プロフィール機能 --- */
async function openProfile(userId) {
    viewingUserId = userId;
    
    // Firestoreから最新のユーザ情報を取得
    const userSnap = await getDoc(doc(db, "users", userId));
    
    if (userSnap.exists()) {
        const user = userSnap.data();
        const isMe = (currentUser.id === userId);

        document.getElementById('profile-name').innerText = user.nickname;
        document.getElementById('profile-img').style.backgroundImage = `url(${user.icon})`;
        document.getElementById('profile-following').innerText = user.following || 0;
        document.getElementById('profile-followers').innerText = user.followers || 0;

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
}

function goBackProfile() {
    if(viewingUserId === currentUser.id) {
        switchScreen('home-screen');
    } else {
        switchScreen('chat-screen');
    }
}
