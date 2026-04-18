#!/usr/bin/env python3

import threading
import uvicorn
import depthai as dai
import cv2
import json
import base64
import requests
from fastapi import FastAPI
from fastapi.responses import JSONResponse

global api_node


FPS = 30
SECONDS = 2
FRAMES_PER_REQUEST = FPS * SECONDS  # 60 frames


class ApiSyncNode(dai.node.HostNode):
    def __init__(self, api_url):
        dai.node.HostNode.__init__(self)
        self.api_url = api_url
        self.last_600_frames = []
        self.sendProcessingToPipeline(True)

    def build(self, detections: dai.Node.Output, rgb: dai.Node.Output, depth: dai.Node.Output):
        self.link_args(detections, rgb, depth)

    def process(self, detections, rgbMsg, depthMsg):
        rgb_frame = rgbMsg.getCvFrame()
        depth_frame = depthMsg.getFrame()

        _, rgb_encoded = cv2.imencode('.jpg', rgb_frame)

        depth_norm = cv2.normalize(depth_frame, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        depth_color = cv2.applyColorMap(depth_norm, cv2.COLORMAP_JET)
        _, depth_encoded = cv2.imencode('.jpg', depth_color)

        results = []
        for det in detections.detections:
            results.append({
                "label": det.label,
                "conf": round(det.confidence, 2),
                "bbox": {"x1": det.xmin, "y1": det.ymin, "x2": det.xmax, "y2": det.ymax},
                "spatial": {"x": int(det.spatialCoordinates.x), "z": int(det.spatialCoordinates.z)}
            })

        payload = {
            "detections": results,
            "rgb_base64": base64.b64encode(rgb_encoded).decode('utf-8'),
            "depth_base64": base64.b64encode(depth_encoded).decode('utf-8')
        }

        self.last_600_frames.append(payload)
        while len(self.last_600_frames) > 600:
            self.last_600_frames.pop(0)


# --- FastAPI setup ---

app = FastAPI()
api_node: ApiSyncNode = None  # Set before the server starts


@app.get("/camera-data")
def get_camera_data():
    if api_node is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Pipeline not initialized yet."}
        )

    # Return the last 10 seconds worth of frames (up to 200)
    # last_10s = api_node.last_600_frames[-FRAMES_PER_REQUEST:]
    last_2s = api_node.last_600_frames[-FRAMES_PER_REQUEST:]

    return JSONResponse(content={
        "fps": FPS,
        "seconds": SECONDS,
        "frame_count": len(last_2s),
        "frames": last_2s
    })


def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")


# --- Pipeline + server entrypoint ---

if __name__ == "__main__":
    size = (640, 400)

    with dai.Pipeline() as p:
        camRgb = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_A, sensorFps=FPS)
        monoLeft = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_B, sensorFps=FPS)
        monoRight = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_C, sensorFps=FPS)

        depthSource = p.create(dai.node.StereoDepth)
        depthSource.setExtendedDisparity(True)
        monoLeft.requestOutput(size).link(depthSource.left)
        monoRight.requestOutput(size).link(depthSource.right)

        model = dai.NNModelDescription("yolov6-nano")
        sdn = p.create(dai.node.SpatialDetectionNetwork).build(camRgb, depthSource, model)

        api_node_instance = p.create(ApiSyncNode, api_url="https://backend-3su7.onrender.com/api/camera-data")
        api_node_instance.build(
            sdn.out,
            sdn.passthrough,
            sdn.passthroughDepth
        )

        # Share the node instance with FastAPI before starting the server
        api_node = api_node_instance

        # Start FastAPI in a background daemon thread
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print("FastAPI server running on http://0.0.0.0:8000")
        print("Pipeline running... GET /camera-data returns the last 10 seconds.")

        p.run()