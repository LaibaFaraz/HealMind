from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import base64
import cv2
import numpy as np
import sys
import os
import time
import threading

# --- 1. SETUP & IMPORTS ---
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from inference import predict_emotion, load_ai_resources
template_dir = os.path.abspath('../UI')

app = Flask(__name__, 
            template_folder=template_dir,
            static_folder=template_dir,
            static_url_path='')
CORS(app)

# frame throttling
last_process_time = 0
PROCESS_INTERVAL = 0.2  # process max 1 frame every 500ms
processing_lock = threading.Lock()

# --- 2. INITIALIZATION ---
print(" Starting HealMind Server...")
load_ai_resources()

# --- 3. API ROUTES ---

@app.route("/", methods=["GET"])
def home():
    """Serves the main website HTML."""
    return render_template("index.html")

@app.route("/stress")
def stress():
    return render_template("stress.html")

@app.route("/migrate-data")
def migrate_data():
    return render_template("migrate-data.html")

@app.route("/mood")
def mood():
    return render_template("mood.html")

@app.route("/camera")
def camera():
    return render_template("camera.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Receives an image from frontend, analyzes it, and returns emotion."""
    global last_process_time
    
    try:
        # check if enough time has passed
        current_time = time.time()
        if current_time - last_process_time < PROCESS_INTERVAL:
            # return last result or skip
            return jsonify({"emotion": "No Face", "stress_level": "Low"}), 200
        
        # use lock to prevent concurrent processing
        if not processing_lock.acquire(blocking=False):
            return jsonify({"emotion": "No Face", "stress_level": "Low"}), 200
        
        try:
            # 1. Get the data from the frontend
            data = request.json
            if 'image' not in data:
                return jsonify({"error": "No image provided"}), 400
                
            image_base64 = data["image"]

            # 2. Decode the Base64 image
            try:
                image_data = image_base64.split(",")[1]
                image_bytes = base64.b64decode(image_data)
                
                # validate image size
                if len(image_bytes) == 0:
                    return jsonify({"error": "Empty image"}), 400
                
                np_arr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                # validate decoded frame
                if frame is None or frame.size == 0:
                    return jsonify({"error": "Invalid frame"}), 400
                    
            except Exception as e:
                print(f" Image Decoding Error: {e}")
                return jsonify({"error": "Invalid image format"}), 400

            # 3. Pass the image to our 'Brain' (inference.py)
            result = predict_emotion(frame)
            
            # update last process time
            last_process_time = current_time
            
            # 4. Return the result as JSON
            return jsonify(result)
            
        finally:
            processing_lock.release()
        
    except Exception as e:
        print(f" Server Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal processing error"}), 500

if __name__ == "__main__":
    # Run the server on Port 5000
    print(" Server is ready at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)