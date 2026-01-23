import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta
import os

def findFirebaseKey():
    startPath = os.path.abspath('../../')
    for root, dirs, files in os.walk(startPath):
        if 'healmind-2025-firebase-adminsdk-fbsvc-12242dbda6.json' in files:
            return os.path.join(root, 'healmind-2025-firebase-adminsdk-fbsvc-12242dbda6.json')
    raise FileNotFoundError("Firebase key not found!")

def findFiles(filename):
    startPath = os.path.abspath('../../')
    for root, dirs, files in os.walk(startPath):
        if filename in files:
            return os.path.join(root, filename)
    raise FileNotFoundError(f"{filename} not found!")

def initialize_firebase():
    cred_path = findFirebaseKey()
    cred = credentials.Certificate(cred_path)
    
    try:
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass
    
    db = firestore.client()
    print(f"Firebase initialized! Found key at: {cred_path}")
    return db

def load_models():
    try:
        modelPath = findFiles('stress_model.pkl')
        model = joblib.load(modelPath)
        print(f"loaded model from {modelPath}")
    except Exception as e:
        print(f"error loading model: {e}")
        model = None

    try:
        scalerPath = findFiles('scaler.pkl')
        scaler = joblib.load(scalerPath)
        print(f"loaded scaler from {scalerPath}")
    except Exception as e:
        print(f"error loading scaler: {e}")
        scaler = None

    if model and scaler:
        print("Files loaded successfully.")
    else:
        print("Error: Model or scaler not loaded properly.")
    
    return model, scaler

class StressPredictor:
    def __init__(self, model, scaler, db):
        self.model = model
        self.scaler = scaler
        self.db = db
        self.feature_names = ['sdnn', 'rmssd']

    def fetch_unprocessed_data(self, hours=1):
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        query = self.db.collection('heart_rate_data') \
            .where(filter=FieldFilter('timestamp', '>=', cutoff_time)) \
            .stream()

        data_points = []
        for doc in query:
            data = doc.to_dict()
            data['doc_id'] = doc.id
            data_points.append(data)

        return pd.DataFrame(data_points) if data_points else pd.DataFrame()

    def group_by_window(self, df, window_minutes=5):
        if df.empty:
            return []

        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')

        windows = []
        for i in range(0, len(df), window_minutes * 12):
            window = df.iloc[i:i+window_minutes*12]
            if len(window) >= 3:
                windows.append(window)

        return windows

    def process_window(self, window):
        all_ibi = []
        for ibi_list in window['ibi'].dropna():
            if ibi_list:
                all_ibi.extend(ibi_list)

        if not all_ibi or len(all_ibi) < 2:
            return None

        ibi = np.array(all_ibi, dtype=float)
        sdnn = np.std(ibi)
        rmssd = np.sqrt(np.mean(np.diff(ibi) ** 2))

        X = np.array([[sdnn, rmssd]])
        X_scaled = self.scaler.transform(X)

        prediction = self.model.predict(X_scaled)[0]
        probability = self.model.predict_proba(X_scaled)[0]

        stress_labels = {0: 'low', 1: 'medium', 2: 'high'}
        
        return {
            'stress_level': int(prediction),
            'stress_label': stress_labels[int(prediction)],
            'stress_probabilities': {
                'class_0_low': float(probability[0]),
                'class_1_medium': float(probability[1]) if len(probability) > 1 else 0.0,
                'class_2_high': float(probability[2]) if len(probability) > 2 else 0.0
            },
            'sdnn': float(sdnn),
            'rmssd': float(rmssd),
            'window_start': window['timestamp'].min(),
            'window_end': window['timestamp'].max(),
            'prediction_timestamp': datetime.utcnow(),
            'num_samples': len(window)
        }

    def store_predictions(self, results):
        batch = self.db.batch()

        for result in results:
            doc_ref = self.db.collection('stress_predictions').document()
            batch.set(doc_ref, result)

        batch.commit()
        return len(results)

    def run_batch(self, hours=1):
        print(f"\n{'='*60}")
        print(f"BATCH JOB: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")

        try:
            print(f"Fetching data from last {hours} hour(s)...")
            df = self.fetch_unprocessed_data(hours=hours)

            if df.empty:
                print("No new data to process")
                return

            print(f"Loaded {len(df)} data points")

            windows = self.group_by_window(df)
            print(f"Created {len(windows)} time windows")

            results = []
            for i, window in enumerate(windows):
                result = self.process_window(window)
                if result:
                    results.append(result)

            print(f"Processed {len(results)} windows")

            if results:
                stored = self.store_predictions(results)
                print(f"Stored {stored} predictions to Firestore")

                stress_low = sum(1 for r in results if r['stress_level'] == 0)
                stress_medium = sum(1 for r in results if r['stress_level'] == 1)
                stress_high = sum(1 for r in results if r['stress_level'] == 2)
                
                avg_prob_low = np.mean([r['stress_probabilities']['class_0_low'] for r in results])
                avg_prob_medium = np.mean([r['stress_probabilities']['class_1_medium'] for r in results])
                avg_prob_high = np.mean([r['stress_probabilities']['class_2_high'] for r in results])
                
                print(f"\nSummary:")
                print(f"  Low stress:    {stress_low}/{len(results)} (avg prob: {avg_prob_low:.2%})")
                print(f"  Medium stress: {stress_medium}/{len(results)} (avg prob: {avg_prob_medium:.2%})")
                print(f"  High stress:   {stress_high}/{len(results)} (avg prob: {avg_prob_high:.2%})")

            print(f"{'='*60}\n")
            return results

        except Exception as e:
            print(f"Error: {str(e)}")
            return None