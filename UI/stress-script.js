// --- FIREBASE SETUP ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, onSnapshot, orderBy, where, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from './auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyALG5rqXdMdJLVY3Sm9An4pmCCoflYUn7g",
    authDomain: "healmind-2025.firebaseapp.com",
    projectId: "healmind-2025",
    storageBucket: "healmind-2025.firebasestorage.app",
    messagingSenderId: "815736974240",
    appId: "1:815736974240:web:46d83a46fae313961612c5",
    measurementId: "G-Q113X0VYS2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

var historyChart;
var weeklyChart;
var monthlyChart;
var lastUpdateTime = null;
var stressHistory = [];

console.log("stress-script.js is loading...");

// IMPROVED: Parse all probability formats
function parseStressProbability(itemData) {
    let probValue = 0;
    
    if (!itemData.stress_probabilities) {
        return itemData.probability !== undefined ? itemData.probability : 0;
    }
    
    const probs = itemData.stress_probabilities;
    
    // Named 3-class {class_0_low, class_1_medium, class_2_high}
    if ('class_0_low' in probs) {
        const low = probs.class_0_low || 0;
        const medium = probs.class_1_medium || 0;
        const high = probs.class_2_high || 0;
        probValue = (low * 0) + (medium * 50) + (high * 100);
    }
    // Simple 3-class {low, moderate, high}
    else if ('low' in probs) {
        const low = probs.low || 0;
        const moderate = probs.moderate || 0;
        const high = probs.high || 0;
        probValue = (low * 0) + (moderate * 50) + (high * 100);
    }
    //  Old 2-class {class_0, class_1}
    else if ('class_1' in probs) {
        probValue = probs.class_1 * 100;
    }
    //  Numeric keys {0, 1}
    else if (probs['1'] !== undefined) {
        probValue = probs['1'] * 100;
    }
    
    // If value is still 0-1 range, convert to 0-100
    if (probValue > 0 && probValue <= 1) {
        probValue = probValue * 100;
    }
    
    return probValue;
}

function getStatusColor(prob) {
    if (prob < 30) {
        return { label: 'Normal', text: 'SuccessText', glass: 'BadgeBase BadgeSuccess', color: '#4ade80' };
    } else if (prob < 70) {
        return { label: 'Moderate', text: 'WarningText', glass: 'BadgeBase BadgeWarning', color: '#facc15' };
    } else {
        return { label: 'High Stress', text: 'DangerText', glass: 'BadgeBase BadgeDanger', color: '#f87171' };
    }
}

function getAdvice(prob) {
    if (prob < 30) {
        return "Stay focused, you're doing great!";
    }
    if (prob < 70) {
        return "Keep it up, you can handle this!";
    }
    return "Take a breather, you got this!";
}

async function loadWeeklyData() {
    const user = auth.currentUser;
    if (!user) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const q1 = query(
        collection(db, "stress_predictions"),
        where("userId", "==", user.uid),
        where("prediction_timestamp", ">=", Timestamp.fromDate(weekAgo)),
        orderBy("prediction_timestamp")
    );
    
    const q2 = query(
        collection(db, "stress_predictions2"),
        where("userId", "==", user.uid),
        where("prediction_timestamp", ">=", Timestamp.fromDate(weekAgo)),
        orderBy("prediction_timestamp")
    );
    
    const weeklyData = [[], [], [], [], [], [], []];
    
    const snapshot1 = await getDocs(q1);
    const snapshot2 = await getDocs(q2);
    const allDocs = [...snapshot1.docs, ...snapshot2.docs];
    
    allDocs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.prediction_timestamp?.toDate() || new Date();
        const dayIndex = timestamp.getDay();
        const realIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        
        const prob = parseStressProbability(data);
        weeklyData[realIndex].push(prob);
    });
    
    const averages = weeklyData.map(day => {
        if (day.length === 0) return 0;
        return day.reduce((a, b) => a + b, 0) / day.length;
    });
    
    weeklyChart.data.datasets[0].data = averages;
    weeklyChart.update();
}

async function loadMonthlyData() {
    if (!monthlyChart) return;
    
    const user = auth.currentUser;
    if (!user) return;

    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const q1 = query(
        collection(db, "stress_predictions"),
        where("userId", "==", user.uid),
        where("prediction_timestamp", ">=", Timestamp.fromDate(monthAgo)),
        orderBy("prediction_timestamp")
    );
    
    const q2 = query(
        collection(db, "stress_predictions2"),
        where("userId", "==", user.uid),
        where("prediction_timestamp", ">=", Timestamp.fromDate(monthAgo)),
        orderBy("prediction_timestamp")
    );
    
    const dailyData = {};
    
    const snapshot1 = await getDocs(q1);
    const snapshot2 = await getDocs(q2);
    const allDocs = [...snapshot1.docs, ...snapshot2.docs];
    
    allDocs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.prediction_timestamp?.toDate() || new Date();
        const dateStr = `${timestamp.getMonth()+1}/${timestamp.getDate()}`;
        
        const prob = parseStressProbability(data);
        
        if (!dailyData[dateStr]) dailyData[dateStr] = [];
        dailyData[dateStr].push(prob);
    });
    
    const labels = [];
    const values = [];
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
        labels.push(dateStr);
        
        if (dailyData[dateStr] && dailyData[dateStr].length > 0) {
            const avg = dailyData[dateStr].reduce((a, b) => a + b, 0) / dailyData[dateStr].length;
            values.push(avg);
        } else {
            values.push(null);
        }
    }
    
    monthlyChart.data.labels = labels;
    monthlyChart.data.datasets[0].data = values;
    monthlyChart.update();
}

function initCharts() {
    var ctxHistory = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctxHistory, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Stress %',
                data: [],
                borderColor:function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return '#60a5fa';
                    
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, '#4ade80');
                    gradient.addColorStop(0.3, '#facc15');
                    gradient.addColorStop(1, '#f87171');
                    return gradient;
                },
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#60a5fa',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#60a5fa',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const status = getStatusColor(context.raw);
                            return `Stress: ${Math.round(context.raw)}% - ${status.label}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0, maxTicksLimit: 8 } },
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    var ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
    weeklyChart = new Chart(ctxWeekly, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Avg Stress %',
                borderColor: function (context) {
                    var chart = context.chart;
                    var ctx = chart.ctx;
                    var chartArea = chart.chartArea;
                    if (!chartArea) return null;

                    var gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, '#4ade80');
                    gradient.addColorStop(0.5, '#facc15');
                    gradient.addColorStop(1, '#f87171');
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

    const monthlyCanvas = document.getElementById('monthlyChart');
    if (monthlyCanvas) {
        var ctxMonthly = monthlyCanvas.getContext('2d');
        monthlyChart = new Chart(ctxMonthly, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Avg Stress %',
                    borderColor: function (context) {
                        var chart = context.chart;
                        var ctx = chart.ctx;
                        var chartArea = chart.chartArea;
                        if (!chartArea) return null;

                        var gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, '#4ade80');
                        gradient.addColorStop(0.5, '#facc15');
                        gradient.addColorStop(1, '#f87171');
                        return gradient;
                    },
                    backgroundColor: 'rgba(96, 165, 250, 0.05)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#60a5fa',
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                                if (context.parsed.y === null) return 'No data';
                                var status = getStatusColor(context.parsed.y);
                                return 'Stress: ' + Math.round(context.parsed.y) + '% - ' + status.label;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { display: false }, 
                        ticks: { 
                            color: '#94a3b8',
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: 10
                        } 
                    },
                    y: { 
                        beginAtZero: true, 
                        max: 100, 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8' } 
                    }
                }
            }
        });
    }
}

function updateUI(items) {
    console.log("updateUI called with items:", items.length);
    if (items.length === 0) return;

    var currentItem = items[items.length - 1];
    console.log("Current item prob:", currentItem.prob);
    var statusInfo = getStatusColor(currentItem.prob);

    var labelElement = document.getElementById('status-label');
    labelElement.textContent = statusInfo.label;
    labelElement.className = 'StatusLarge ' + statusInfo.text;

    document.getElementById('prob-value').textContent = Math.round(currentItem.prob) + '%';
    var probStatus = document.getElementById('prob-status');
    probStatus.textContent = currentItem.prob > 70 ? 'CRITICAL' : 'STABLE';
    probStatus.className = statusInfo.glass;

    var peakStress = Math.max.apply(Math, items.map(function (item) { return item.prob; }));
    document.getElementById('avg-value').textContent = Math.round(peakStress) + '%';

    var avgStress = items.reduce((a, b) => a + b.prob, 0) / items.length;

    let trendArrow = '→';
    let trendColor = '#94a3b8';
    if (items.length >= 5) {
        const recent = items.slice(-5);
        const firstHalf = recent.slice(0, 2).reduce((a, b) => a + b.prob, 0) / 2;
        const secondHalf = recent.slice(-2).reduce((a, b) => a + b.prob, 0) / 2;
        
        if (secondHalf > firstHalf + 10) {
            trendArrow = '↑';
            trendColor = '#f87171';
        } else if (secondHalf < firstHalf - 10) {
            trendArrow = '↓';
            trendColor = '#4ade80';
        }
    }

    document.getElementById('time-subtext').innerHTML = 
        `Live: ${currentItem.time.toLocaleTimeString()} | Avg: ${Math.round(avgStress)}% <span style="color:${trendColor}; font-weight:bold; font-size:1.2em;">${trendArrow}</span>`;
    
    document.getElementById('advice-text').textContent = getAdvice(currentItem.prob);

    const displayItems = items.slice(-50);
    historyChart.data.labels = displayItems.map(function (d) {
        return d.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    historyChart.data.datasets[0].data = displayItems.map(function (d) {
        return d.prob;
    });

    console.log("Chart data:", historyChart.data.datasets[0].data.slice(-5));
    historyChart.update('none');
    
    stressHistory = items;
    lastUpdateTime = new Date();
    console.log("UI updated successfully");
}

initCharts();

auth.onAuthStateChanged((user) => {
    if (!user) {
        console.warn('User not logged in');
        return;
    }

    loadWeeklyData();
    loadMonthlyData();

    const q1 = query(
        collection(db, "stress_predictions"),
        where("userId", "==", user.uid),
        orderBy("prediction_timestamp")
    );

    const q2 = query(
        collection(db, "stress_predictions2"),
        where("userId", "==", user.uid),
        orderBy("prediction_timestamp")
    );

    const unsubscribe1 = onSnapshot(q1, () => combineAndUpdate());
    const unsubscribe2 = onSnapshot(q2, () => combineAndUpdate());

    async function combineAndUpdate() {
        const snapshot1 = await getDocs(q1);
        const snapshot2 = await getDocs(q2);
        
        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        
        console.log("Firebase found data:", allDocs.length, "documents");
        
        var items = [];

        allDocs.forEach((doc) => {
            var itemData = doc.data();

            // Parse timestamp
            var timeValue = new Date();
            if (itemData.prediction_timestamp) {
                if (typeof itemData.prediction_timestamp.toDate === 'function') {
                    timeValue = itemData.prediction_timestamp.toDate();
                } else if (typeof itemData.prediction_timestamp === 'string') {
                    timeValue = new Date(itemData.prediction_timestamp);
                } else if (typeof itemData.prediction_timestamp === 'number') {
                    timeValue = new Date(itemData.prediction_timestamp > 10000000000 
                        ? itemData.prediction_timestamp 
                        : itemData.prediction_timestamp * 1000);
                }
            } else if (itemData.timestamp) {
                if (typeof itemData.timestamp.toDate === 'function') {
                    timeValue = itemData.timestamp.toDate();
                } else {
                    timeValue = new Date(itemData.timestamp);
                }
            }

            // Parse probability using new function
            const probValue = parseStressProbability(itemData);

            items.push({
                id: doc.id,
                time: timeValue,
                prob: probValue
            });
        });

        console.log(" Processed:", items.length, "items");
        
        if (items.length > 0) {
            // Sort by time
            items.sort(function (a, b) {
                return a.time - b.time;
            });
            
            // Date range debugging
            const firstDate = items[0].time;
            const lastDate = items[items.length - 1].time;
            console.log("Date Range:", 
                firstDate.toLocaleDateString(), "-", lastDate.toLocaleDateString());
            console.log("Time Range:", 
                firstDate.toLocaleTimeString(), "-", lastDate.toLocaleTimeString());
            
            // Show first 3 items
            console.log("First 3 predictions:");
            items.slice(0, 3).forEach(item => {
                console.log(`  ${item.time.toLocaleString()} → ${Math.round(item.prob)}%`);
            });
            
            // Show last 3 items
            console.log("Last 3 predictions:");
            items.slice(-3).forEach(item => {
                console.log(`  ${item.time.toLocaleString()} → ${Math.round(item.prob)}%`);
            });
            
            // Show daily distribution
            const dailyCounts = {};
            items.forEach(item => {
                const dateKey = item.time.toLocaleDateString();
                dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
            });
            console.log("Predictions per day:", dailyCounts);
            
            updateUI(items);
        } else {
            console.warn("No data found");
        }
    }
});

console.log("stress-script.js loaded successfully");