// -- Firebase Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// -- Camera and Emotion Detection Setup
const video = document.getElementById("video");
const overlay = document.getElementById("overlay"); 
const ctxOverlay = overlay.getContext("2d");        
const resultText = document.getElementById("result-text");

let lastSaveTime = 0;
const SAVE_INTERVAL = 3000;

// 1. Start Camera
navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(stream => {
        video.srcObject = stream;
        
        // Wait for video to load to set overlay size accurately
        video.onloadedmetadata = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            
            // Check every 200ms
            setInterval(captureAndSend, 500); 
        };
    })
    .catch(err => {
        console.error("Camera Error:", err);
        resultText.innerText = "Error: Camera access denied";
        resultText.style.color = "red";
    });

function captureAndSend() {
    // 2. Capture Frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.7);

    // 3. Send to Backend (Using relative path is safer for deployment)
    // Change this line to point to the Python server, not the Live Server
    // Inside camera.js
    fetch("/analyze", {  // Change this to just "/analyze"
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData })
    })

    .then(res => res.json())
    .then(data => {
        // 4. CLEAR the previous box
        ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);

        if (data.error) return;

        if (data.emotion === "No Face") {
            resultText.innerText = "No face detected";
            resultText.style.color = "gray";
        } else {
            resultText.innerText = `Emotion: ${data.emotion} | Stress: ${data.stress_level}`;
            
            // 5. DRAW THE BOX
            if (data.face_box) {
                const [x, y, w, h] = data.face_box;
                
                ctxOverlay.beginPath();
                ctxOverlay.lineWidth = 4; 

                // --- COLOR LOGIC ---
                if (data.stress_level === "High") {
                    ctxOverlay.strokeStyle = "#e74c3c"; // Red
                    resultText.style.color = "#e74c3c";
                } 
                else if (data.stress_level === "Medium") {
                    ctxOverlay.strokeStyle = "#f39c12"; // Orange
                    resultText.style.color = "#f39c12";
                } 
                else {
                    ctxOverlay.strokeStyle = "#2ecc71"; // Green
                    resultText.style.color = "#2ecc71";
                }

                ctxOverlay.rect(x, y, w, h);
                ctxOverlay.stroke();
            }
            const now = Date.now();
            if (now - lastSaveTime > SAVE_INTERVAL) {
                saveToFirebase(data.emotion, data.stress_level);
                lastSaveTime = now;
            }
        }
    })
    .catch(err => {
        // console.log("Backend offline"); // Optional: Comment out to reduce noise
    });
}

// firbase SAVE FUNCTION
async function saveToFirebase(emotion, stress_level) {
    try {
        const user = auth.currentUser;  
        if (!user) {                   
            console.warn('User not logged in, skipping save');  
            return;                   
        }                               

        const docRef = await addDoc(collection(db, "face_logs"), {
            userId: user.uid,
            userEmail: user.email, 
            emotion: emotion,
            stress_level: stress_level,
            timestamp: serverTimestamp(),
            source: "web_camera" // Useful to know this came from the camera
        });
        console.log("Document written with ID: ", user.email, docRef.id);
    }
    catch (e) {
        console.error("Error adding document: ", e);
    }
}
