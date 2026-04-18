# 🧠 AI Detective Assistant — SKILL.md (Backend)

---

## 🧭 TL;DR

- Input: Vision model → structured JSON (scene data)  
- Loop: LLM (Gemini) asks questions + suggests actions  
- Backend: manages state, validates outputs, controls flow  
- Output: investigation report + scenarios + confidence score  

👉 An **AI-assisted investigation system** that reasons over evolving evidence.

---

## 📌 Overview

This backend powers an **AI Detective Assistant** for investigation support.

### System Components

1. **Vision Model (already implemented)**
   - Input: camera feed  
   - Output: structured **scene description (JSON)**  

2. **LLM (Gemini — text-to-text)**
   - Input: scene data + case state  
   - Responsibilities:
     - ask follow-up questions  
     - suggest investigation steps  
     - generate hypotheses  
     - produce final report  

3. **Backend (YOU)**
   - manages state  
   - controls iteration flow  
   - validates LLM outputs  
   - calculates confidence score  

---

## 🏗️ System Architecture
Camera → Vision Model (Image → Text)
↓
Scene JSON Output
↓
Backend (State Manager)
↓
Gemini API (LLM)
↓
Questions → Answers → Loop
↓
Final Report + Scoring


---

## 📥 Input (Vision Model Output)

```json
{
  "location": "warehouse",
  "time": "23:40",
  "objects_detected": ["person", "broken window"],
  "environment": "dark",
  "thermal_activity": "heat trace near exit",
  "movement": "running"
}

## 🧠 Case State (Core Memory)
{
  "scene_data": {},
  "evidence": [],
  "answers": [],
  "questions_asked": [],
  "hypotheses": []
}

Rules
Never overwrite → only append
Deduplicate evidence
Track asked questions to avoid repetition


## 🔁 Execution Flow
Receive scene JSON from vision model
Initialize caseState
Send to LLM → generate questions + next steps
Return questions to user
User provides answers
Update caseState
Repeat steps 3–6 (2–5 iterations)
Trigger final analysis
Generate report + scenarios
Apply backend confidence scoring


## 🛑 Stopping Conditions

Stop iteration when:

max iterations reached (3–5)
no new useful questions
confidence ≥ threshold (e.g. 0.75)
user triggers final report
