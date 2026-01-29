// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from './auth.js';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALG5rqXdMdJLVY3Sm9An4pmCCoflYUn7g",
  authDomain: "healmind-2025.firebaseapp.com",
  projectId: "healmind-2025",
  storageBucket: "healmind-2025.firebasestorage.app",
  messagingSenderId: "815736974240",
  appId: "1:815736974240:web:46d83a46fae313961612c5",
  measurementId: "G-Q113X0VYS2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

let moodData = {};
let currentViewDate = new Date();
let selectedDateStr = "";
const emojis = ['😊', '😐', '☹️', '😡', '😴', '💪'];
let selectedEmoji = "";

async function loadMoodData() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('User not logged in');
            return;
        }

        const q = query(
            collection(db, "mood_entries"),
            where("userId", "==", user.uid)
        );
        
        const snapshot = await getDocs(q);
        moodData = {};
        
        snapshot.forEach((doc) => {
            moodData[doc.id] = doc.data();
        });
    } catch (error) {
        console.error("Error loading mood data:", error);
        }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadMoodData();
        initApp();
    }
});

function initApp() {
    initEmoji();

    // Auto-select today's date
    const today = new Date();
    selectedDateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    document.getElementById("displayDate").innerText = selectedDateStr;
    
    // Load today's data if exists
    const todayData = moodData[selectedDateStr] || {emoji:"", stress:5, note:""};
    document.getElementById("stressLevel").value = todayData.stress;
    document.getElementById("stressVal").innerText = todayData.stress;
    document.getElementById("dailyNote").value = todayData.note;

    render();
    document.getElementById("prevBtn").onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); render(); };
    document.getElementById("nextBtn").onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); render(); };

    document.getElementById("todayBtn").onclick = () => { 
        currentViewDate = new Date(); 
        const today = new Date();
        selectedDateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        document.getElementById("displayDate").innerText = selectedDateStr;
        const todayData = moodData[selectedDateStr] || {emoji:"", stress:5, note:""};
        document.getElementById("stressLevel").value = todayData.stress;
        document.getElementById("stressVal").innerText = todayData.stress;
        document.getElementById("dailyNote").value = todayData.note;
        render(); 
    };

    document.getElementById("stressLevel").oninput = (e) => document.getElementById("stressVal").innerText = e.target.value;
    document.getElementById("saveBtn").onclick = save;
}

function initEmoji() {
    const container = document.getElementById("emojiOptions");
    container.innerHTML = "";
    emojis.forEach(e => {
        const btn = document.createElement("button");
        btn.className = "bg-slate-800 p-2 rounded-lg text-xl hover:bg-slate-700 transition border-2 border-transparent";
        btn.innerText = e;
        btn.onclick = () => {
            selectedEmoji = e;
            Array.from(container.children).forEach(c => c.style.borderColor = "transparent");
            btn.style.borderColor = "#f472b6";
        };
        container.appendChild(btn);
    });
}

async function showHRStressOnCalendar() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const q1 = query(
            collection(db, "stress_predictions"),
            where("userId", "==", user.uid)
        );

        const q2 = query(
            collection(db, "stress_predictions2"),
            where("userId", "==", user.uid)
    );

        const snapshot1 = await getDocs(q1);
        const snapshot2 = await getDocs(q2);
        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        
        //const snapshot = await getDocs(q);
        const dailyStress = {};
        
        //snapshot.forEach(doc => {
        allDocs.forEach(doc => {
            const data = doc.data();
            const time = data.prediction_timestamp.toDate();
            const dateStr = `${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')}`;
            
            //const stressPercent = Math.round(data.stress_probabilities.high * 100 + data.stress_probabilities.moderate * 50);
            
            const stressPercent = Math.round(
                (data.stress_probabilities.class_0_low * 0) + 
                (data.stress_probabilities.class_1_medium * 50) + 
                (data.stress_probabilities.class_2_high * 100)
            );

            if (!dailyStress[dateStr]) dailyStress[dateStr] = [];
            dailyStress[dateStr].push(stressPercent);
        });
        
        // Calculate averages and display
        Object.keys(dailyStress).forEach(date => {
            const avg = Math.round(dailyStress[date].reduce((a,b) => a+b) / dailyStress[date].length);
            const cell = document.querySelector(`[data-date="${date}"]`);
            if (cell) {
                const stressDiv = document.createElement("div");
                stressDiv.className = "text-[10px] font-bold mt-1";
                
                let label = "";
                let color = "";
                if (avg < 30) {
                    stressDiv.style.color = "#4ade80";
                    label = "Low Stress";
                } else if (avg < 90) {
                    stressDiv.style.color = "#facc15";
                    label = "Medium Stress";
                } else {
                    stressDiv.style.color = "#f87171";
                    label = "High Stress";
                }

                // Add hover tooltip
                cell.setAttribute("data-hrv-stress", `HRV: ${label}`);
                cell.setAttribute("data-hrv-color", color);
                
                cell.addEventListener("mouseenter", function() {
                    const tooltip = document.createElement("div");
                    tooltip.className = "hrv-tooltip";
                    tooltip.innerText = this.getAttribute("data-hrv-stress");
                    tooltip.style.color = this.getAttribute("data-hrv-color");
                    this.appendChild(tooltip);
                });
                
                cell.addEventListener("mouseleave", function() {
                    const tooltip = this.querySelector(".hrv-tooltip");
                    if (tooltip) tooltip.remove();
                });
                
                //stressDiv.innerText = `HRV: ${label}`;
                cell.appendChild(stressDiv);
            }
        });
    } catch(e) { 
        console.error("Error loading stress data:", e); 
    }
}

function render() {
    const cal = document.getElementById("calendar");
    cal.innerHTML = "";
    const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();
    document.getElementById("monthDisplay").innerText = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    for(let i=0; i<first; i++) cal.appendChild(document.createElement("div"));

    for(let d=1; d<=days; d++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.setAttribute("data-date", dateStr); 

        const isFuture = dateStr > todayStr;

        if (moodData[dateStr]) {
            if (isFuture) {
                cell.classList.add("future-note-cell");
            } else {
                const s = parseInt(moodData[dateStr].stress || 5);
                if (s <= 3) cell.classList.add("stress-low");
                else if (s <= 7) cell.classList.add("stress-mid");
                else cell.classList.add("stress-high");
            }
        }

        if (dateStr === selectedDateStr) cell.classList.add("active");
        if (dateStr === todayStr) cell.classList.add("today");
        
        cell.innerHTML = `<span class="day-num">${d}</span>`;
        if (moodData[dateStr] && moodData[dateStr].emoji) {
            const mDiv = document.createElement("div");
            mDiv.className = "day-mood";
            mDiv.innerText = moodData[dateStr].emoji;
            cell.appendChild(mDiv);
        }
        
        cell.onclick = () => {
            selectedDateStr = dateStr;
            updateEditorUI(dateStr);
            render();
        };
        cal.appendChild(cell);
    }
    showHRStressOnCalendar();
}

function updateEditorUI(dateStr) {
    const data = moodData[dateStr] || {emoji:"", stress:5, note:""};
    document.getElementById("displayDate").innerText = dateStr;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = dateStr > todayStr;

    document.getElementById("stressLevel").value = data.stress;
    document.getElementById("stressVal").innerText = data.stress;
    document.getElementById("dailyNote").value = data.note;

    const emojiArea = document.getElementById("emojiOptions");
    const stressArea = document.getElementById("stressLevel");

    if (isFuture) {
        emojiArea.classList.add("u-disabled");
        stressArea.disabled = true;
        stressArea.classList.add("u-disabled");
        selectedEmoji = "";
    } else {
        emojiArea.classList.remove("u-disabled");
        stressArea.disabled = false;
        stressArea.classList.remove("u-disabled");
        selectedEmoji = data.emoji;
    }

    Array.from(emojiArea.children).forEach(btn => {
        btn.style.borderColor = (btn.innerText === selectedEmoji && selectedEmoji !== "") ? "#f472b6" : "transparent";
    });
}

async function save() {
    if(!selectedDateStr) return alert("Select a date!");
    
    const user = auth.currentUser;
    if (!user) {
        alert("Please log in");
        return;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = selectedDateStr > todayStr;

    const moodEntry = {
        userId: user.uid,
        userEmail: user.email,
        emoji: isFuture ? "" : selectedEmoji,
        stress: isFuture ? 5 : document.getElementById("stressLevel").value,
        note: document.getElementById("dailyNote").value
    };
    
    try {
        await setDoc(doc(db, "mood_entries", selectedDateStr), moodEntry);
        moodData[selectedDateStr] = moodEntry;
        render();
        alert(isFuture ? "Future Note Saved!" : "Mood Saved Successfully!");
    } catch (error) {
        console.error("Error saving mood:", error);
        alert("Error saving mood.");
    }
}