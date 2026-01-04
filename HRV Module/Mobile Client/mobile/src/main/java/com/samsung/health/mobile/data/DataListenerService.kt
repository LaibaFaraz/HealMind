/*
 * Copyright 2023 Samsung Electronics Co., Ltd. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.samsung.health.mobile.data

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.google.firebase.Firebase
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.firestore
import com.samsung.health.data.TrackedData
import com.samsung.health.mobile.presentation.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

private const val TAG = "DataListenerService"
private const val MESSAGE_PATH = "/msg"

class DataListenerService : WearableListenerService() {

    private val db = Firebase.firestore

    override fun onMessageReceived(messageEvent: MessageEvent) {
        super.onMessageReceived(messageEvent)

        val value = messageEvent.data.decodeToString()
        Log.i(TAG, "onMessageReceived(): $value")
        when (messageEvent.path) {
            MESSAGE_PATH -> {
                Log.i(TAG, "Service: message (/msg) received: $value")

                if (value.isNotEmpty()) {
                    // Launch on a background thread with a delay to ensure Firestore is initialized
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            // Wait for Firestore to be ready - increased delay for safety
                            delay(1000)

                            val trackedDataList = Json.decodeFromString<List<TrackedData>>(value)

                            for (data in trackedDataList) {
                                val dataMap = hashMapOf(
                                    "hr" to data.hr,
                                    "ibi" to data.ibi,
                                    "timestamp" to FieldValue.serverTimestamp()
                                )

                                try {
                                    db.collection("heart_rate_data")
                                        .add(dataMap)
                                        .addOnSuccessListener { documentReference ->
                                            Log.d(TAG, "DocumentSnapshot added with ID: ${documentReference.id}")
                                        }
                                        .addOnFailureListener { e ->
                                            Log.w(TAG, "Error adding document", e)
                                        }
                                } catch (e: Exception) {
                                    Log.w(TAG, "Exception during Firestore write: ${e.message}")
                                }
                            }

                            // Optional: Keep opening the activity if needed, or remove if only background data required.
                            startActivity(
                                Intent(this@DataListenerService, MainActivity::class.java)
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    .putExtra("message", value)
                            )

                        } catch (e: Exception) {
                            Log.e(TAG, "Error parsing data: ${e.message}")
                        }
                    }
                } else {
                    Log.i(TAG, "value is an empty string")
                }
            }
        }
    }
}