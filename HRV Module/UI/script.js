// --- FIREBASE SETUP ---
// settings from firebase console
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyALG5rqXdMdJLVY3Sm9An4pmCCoflYUn7g",
    authDomain: "healmind-2025.firebaseapp.com",
    projectId: "healmind-2025",
    storageBucket: "healmind-2025.firebasestorage.app",
    messagingSenderId: "815736974240",
    appId: "1:815736974240:web:46d83a46fae313961612c5",
    measurementId: "G-Q113X0VYS2"
};

// initialize app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// chart variables
var historyChart;
var weeklyChart;

// colors based on stress level 
function getStatusColor(prob) {
    if (prob < 30) {
        return { label: 'Normal', text: 'SuccessText', glass: 'BadgeBase BadgeSuccess' };
    } else if (prob < 70) {
        return { label: 'Moderate', text: 'WarningText', glass: 'BadgeBase BadgeWarning' };
    } else {
        return { label: 'High Stress', text: 'DangerText', glass: 'BadgeBase BadgeDanger' };
    }
}

// advice messages
function getAdvice(prob) {
    if (prob < 30) {
        return "Stay focused, you're doing great!";
    }
    if (prob < 70) {
        return "Keep it up, you can handle this!";
    }
    return "Take a breather, you got this!";
}

// create charts on load
function initCharts() {
    // 24h timeline
    var ctxHistory = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctxHistory, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Stress %',
                data: [],
                borderColor: '#60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0 } },
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // weekly breakdown
    var ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
    weeklyChart = new Chart(ctxWeekly, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Avg Stress %',
                data: [20, 35, 15, 45, 60, 40, 30], // sample data
                borderColor: function (context) {
                    var chart = context.chart;
                    var ctx = chart.ctx;
                    var chartArea = chart.chartArea;
                    if (!chartArea) return null;

                    // line color based on height
                    var gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, '#4ade80'); // green good
                    gradient.addColorStop(0.5, '#facc15'); // yellow okay
                    gradient.addColorStop(1, '#f87171'); // red stressed
                    return gradient;
                },
                backgroundColor: 'rgba(255,255,255,0.02)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHitRadius: 10,
                pointHoverBackgroundColor: '#60a5fa',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#60a5fa',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            var status = getStatusColor(context.raw);
                            return 'Stress: ' + Math.round(context.raw) + '% - ' + status.label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// update screen text and charts
function updateUI(items) {
    if (items.length === 0) return;

    // get latest
    var currentItem = items[items.length - 1];
    var statusInfo = getStatusColor(currentItem.prob);

    // update main cards 
    var labelElement = document.getElementById('status-label');
    labelElement.textContent = statusInfo.label;
    labelElement.className = 'StatusLarge ' + statusInfo.text;

    document.getElementById('prob-value').textContent = Math.round(currentItem.prob) + '%';
    var probStatus = document.getElementById('prob-status');
    probStatus.textContent = currentItem.prob > 70 ? 'CRITICAL' : 'STABLE';
    probStatus.className = statusInfo.glass;

    // find the highest stress recorded today
    var peakStress = Math.max.apply(Math, items.map(function (item) { return item.prob; }));
    document.getElementById('avg-value').textContent = Math.round(peakStress) + '%';

    document.getElementById('time-subtext').textContent = 'Live feed analysis: ' + currentItem.time.toLocaleTimeString();

    // update advice
    document.getElementById('advice-text').textContent = getAdvice(currentItem.prob);

    // update history graph
    historyChart.data.labels = items.map(function (d) {
        return d.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    historyChart.data.datasets[0].data = items.map(function (d) {
        return d.prob;
    });
    historyChart.update('none');

    // update current day on weekly graph
    var today = new Date();
    var dayIndex = today.getDay(); // sunday zero
    var realIndex = dayIndex === 0 ? 6 : dayIndex - 1; // mon-sun
    weeklyChart.data.datasets[0].data[realIndex] = currentItem.prob;
    weeklyChart.update();
}

// start logic
initCharts();

// firebase listener
const q = query(collection(db, "stress_predictions"));
onSnapshot(q, (snapshot) => {
    console.log("firebase found data: ", snapshot.size);
    var items = [];

    snapshot.forEach((doc) => {
        var itemData = doc.data();

        // get time
        var timeValue = itemData.prediction_timestamp || itemData.timestamp || new Date();
        if (timeValue && typeof timeValue.toDate === 'function') {
            timeValue = timeValue.toDate();
        } else {
            timeValue = new Date(timeValue);
        }

        // get stress percentage
        var probValue = itemData.stress_probabilities?.class_1 ||
            itemData.stress_probabilities?.['1'] ||
            itemData.probability || 0;

        if (probValue === undefined) {
            probValue = 0;
        }
        // convert 0-1 to 0-100
        if (probValue <= 1 && probValue > 0) {
            probValue = probValue * 100;
        }

        items.push({
            id: doc.id,
            time: timeValue,
            prob: probValue
        });
    });

    if (items.length > 0) {
        // sort by time
        items.sort(function (a, b) {
            return a.time - b.time;
        });
        updateUI(items);
    } else {
        console.warn("no data...");
    }
}, (error) => {
    console.error("firebase error: ", error);
    var statusEl = document.getElementById('status-label');
    if (statusEl) {
        statusEl.textContent = "Sync Error";
        statusEl.classList.add('DangerText');
    }
});
