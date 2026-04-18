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

Frontend backend URL:
- Set `VITE_BACKEND_URL` to either the backend origin (`https://your-api.example.com`) or a mounted base path (`https://your-api.example.com/backend`).
- Values that already include `/api` also work, for example `https://your-api.example.com/api` or `https://your-api.example.com/backend/api`.
- After changing any `VITE_` env var, rebuild and redeploy the frontend. Vite bakes those values into the production bundle at build time.
  
(pip install \<library_name\>)
Python libraries to install: 
- depthai
- opencv-python

## Connecting the Camera


Update the backend (main.py) to use the DepthAI pipeline (like in camera_feed.py) and pull real frames from the OAK camera when recording is started.
Stream these frames to the frontend, for example by encoding them as JPEG or PNG (Base64) and sending them over the existing WebSocket connection.
Update the frontend to display the received frames instead of the simulated feed.
