// Firestore Database Helper
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// ==================== WEARABLE DATA ====================

// Save wearable/stress data for current user
export async function saveWearableData(data) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const docRef = await addDoc(collection(db, 'wearable_data'), {
            userId: user.uid,
            userEmail: user.email,
            heartRate: data.heartRate || null,
            temperature: data.temperature || null,
            stressLevel: data.stressLevel || null,
            prediction: data.prediction || null,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        });

        console.log('Wearable data saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving wearable data:', error);
        throw error;
    }
}

// Get all wearable data for current user
export async function getUserWearableData(limitCount = 50) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const q = query(
            collection(db, 'wearable_data'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const data = [];
        
        querySnapshot.forEach((doc) => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Retrieved ${data.length} wearable records`);
        return data;
    } catch (error) {
        console.error('Error getting wearable data:', error);
        throw error;
    }
}

// ==================== FACE DETECTION DATA ====================

// Save face detection/emotion data for current user
export async function saveFaceData(data) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const docRef = await addDoc(collection(db, 'face_data'), {
            userId: user.uid,
            userEmail: user.email,
            emotion: data.emotion || null,
            confidence: data.confidence || null,
            stressLevel: data.stressLevel || null,
            faceDetected: data.faceDetected || false,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        });

        console.log('Face data saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving face data:', error);
        throw error;
    }
}

// Get all face detection data for current user
export async function getUserFaceData(limitCount = 50) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const q = query(
            collection(db, 'face_data'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const data = [];
        
        querySnapshot.forEach((doc) => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Retrieved ${data.length} face detection records`);
        return data;
    } catch (error) {
        console.error('Error getting face data:', error);
        throw error;
    }
}

// ==================== MOOD DATA ====================

// Save mood entry for current user
export async function saveMoodEntry(data) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const docRef = await addDoc(collection(db, 'mood_data'), {
            userId: user.uid,
            userEmail: user.email,
            mood: data.mood || null,
            note: data.note || '',
            date: data.date || new Date().toISOString().split('T')[0],
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        });

        console.log('Mood entry saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving mood entry:', error);
        throw error;
    }
}

// Get all mood entries for current user
export async function getUserMoodData(limitCount = 100) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const q = query(
            collection(db, 'mood_data'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const data = [];
        
        querySnapshot.forEach((doc) => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Retrieved ${data.length} mood entries`);
        return data;
    } catch (error) {
        console.error('Error getting mood data:', error);
        throw error;
    }
}

// ==================== DELETE DATA ====================

// Delete a specific record (works for any collection)
export async function deleteRecord(collectionName, docId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        await deleteDoc(doc(db, collectionName, docId));
        console.log('Record deleted:', docId);
        return true;
    } catch (error) {
        console.error('Error deleting record:', error);
        throw error;
    }
}

export { db };