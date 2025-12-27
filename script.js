// --- 1. Firebase SDKの読み込み ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, doc, addDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, query, where, orderBy, onSnapshot, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ========================================================
// 【重要】ここをご自身のFirebaseのConfigに書き換えてください
// ========================================================
const firebaseConfig = {
    apiKey: "ご自身のapiKey",
    authDomain: "ご自身のauthDomain",
    projectId: "ご自身のprojectId",
    storageBucket: "ご自身のstorageBucket",
    messagingSenderId: "ご自身のmessagingSenderId",
    appId: "ご自身のappId"
};
// ========================================================


// --- 3. アプリの初期化 ---
// ここでエラーが出る場合、上のConfigの書き方に間違いがあります
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 状態管理変数
let currentUser = null;
let currentThreadId = null;
let viewingUserId = null;
let unsubscribeChat = null; 

// --- 4. HTML側から関数を呼べるようにする設定 (必須) ---
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
    // 画面が止まる場合、ここが動いていません（コンソールを確認してください）
    console.log("アプリ起動...");
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
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
    if(currentThreadId === 'open_chat') {
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

async function register() {
    const nick = document.getElementById('reg-nickname').value;
    const pass = document.getElementById('reg-password').value;
    if(!nick || !pass) return alert('入力してください');

    try {
        const q = query(collection(db, "users"), where("nickname", "==", nick));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return alert("そのニックネームは既に使用されています");
        }

        const docRef = await addDoc(collection(db, "users"), {
            nickname: nick,
            password: pass,
            icon: 'https://placehold.co/100x100/orange/white?text=' + nick.charAt(0),
            following: 0,
            followers: 0,
            createdAt: serverTimestamp()
        });

        currentUser = { id: docRef.id, nickname: nick, icon: 'https://placehold.co/100x100/orange/white?text=' + nick.charAt(0) };
        setupHome();
        switchScreen('home-screen');

    } catch (e) {
        console.error("登録エラー:", e);
        alert("登録に失敗しました。コンソールを確認してください。");
    }
}

async function login() {
    const nick = document.getElementById('login-nickname').value;
    const pass = document.getElementById('login-password').value;

    try {
        const q = query(collection(db, "users"), where("nickname", "==", nick), where("password", "==", pass));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot
