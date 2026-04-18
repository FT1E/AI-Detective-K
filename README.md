# AI-Detective-K
 
## Quick Start
 Backend:
- cd backend
- pip install -r requirements.txt
 - uvicorn main:app --reload --port 8000

Frontend:
- cd frontend
- npm install
- npm run dev
  
(pip install \<library_name\>)
Python libraries to install: 
- depthai
- opencv-python

## Connecting the Camera


Update the backend (main.py) to use the DepthAI pipeline (like in camera_feed.py) and pull real frames from the OAK camera when recording is started.
Stream these frames to the frontend, for example by encoding them as JPEG or PNG (Base64) and sending them over the existing WebSocket connection.
Update the frontend to display the received frames instead of the simulated feed.