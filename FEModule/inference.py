import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array
import mediapipe as mp
import os

# --- 1. SETUP PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'healmind_model.h5')

# Global variables
classifier = None
mp_face_detection = None

# Ensure these match your folder names alphabetically!
# 0: fatigue, 1: happy, 2: sad, 3: stress
EMOTION_LABELS = ['Fatigue', 'Happy', 'Sad', 'Stress']

def load_ai_resources():
    """Loads the AI models into memory."""
    global classifier, mp_face_detection
    print("Loading AI models (MediaPipe Mode)...")
    try:
        # 1. Load MediaPipe Face Detector (High Accuracy)
        mp_face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=0, # 0 = Close range (Webcam)
            min_detection_confidence=0.5
        )
        
        # 2. Load Brain
        classifier = load_model(MODEL_PATH)
        print(f"AI Models Loaded! Logic set for: {EMOTION_LABELS}")
    except Exception as e:
        print(f"Error loading models: {e}")

def predict_emotion(image):
    """Detects face using MediaPipe and predicts emotion."""
    global classifier, mp_face_detection

    if image is None: return {"error": "No image"}

    # MediaPipe needs RGB
    img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = mp_face_detection.process(img_rgb)

    if not results.detections:
        return {"emotion": "No Face", "stress_level": "Low"}

    # --- PROCESS THE DETECTED FACE ---
    detection = results.detections[0]
    bboxC = detection.location_data.relative_bounding_box
    
    ih, iw, _ = image.shape
    x = int(bboxC.xmin * iw)
    y = int(bboxC.ymin * ih)
    w = int(bboxC.width * iw)
    h = int(bboxC.height * ih)

    # Safety: Ensure box is inside image
    x, y = max(0, x), max(0, y)

    try:
        # 1. Crop Face
        face_roi = image[y:y+h, x:x+w]

        # 2. Preprocess (Gray -> 48x48)
        roi_gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        roi_gray = cv2.resize(roi_gray, (48, 48), interpolation=cv2.INTER_AREA)
        
        roi = roi_gray.astype('float') / 255.0
        roi = img_to_array(roi)
        roi = np.expand_dims(roi, axis=0)

        # 3. Predict
        prediction = classifier.predict(roi, verbose=0)[0]
        max_index = prediction.argmax()
        detected_emotion = EMOTION_LABELS[max_index]

        # 4. Stress Logic
        if detected_emotion in ['Stress', 'Sad']:
            stress_status = "High"
        elif detected_emotion == 'Fatigue':
            stress_status = "Medium"
        else:
            stress_status = "Low"

        return {
            "emotion": detected_emotion,
            "stress_level": stress_status,
            "face_box": [x, y, w, h] 
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        # Return box even if prediction fails so UI doesn't freeze
        return {"emotion": "Analyzing...", "stress_level": "Low", "face_box": [x, y, w, h]}