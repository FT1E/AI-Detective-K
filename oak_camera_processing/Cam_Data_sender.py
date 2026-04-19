#!/usr/bin/env python3

import depthai as dai
import cv2
import json
import base64
import requests
import datetime as dt
import threading

class ApiSyncNode(dai.node.HostNode):
    def __init__(self, api_url):
        dai.node.HostNode.__init__(self)
        self.api_url = api_url
        self.frame_buffer = [] # Renamed for clarity
        self.session = requests.Session()
        self.session.trust_env = False 
        self.sendProcessingToPipeline(True)

    def build(self, detections: dai.Node.Output, rgb: dai.Node.Output, depth: dai.Node.Output):
        self.link_args(detections, rgb, depth)

    def _send_batch(self, data_to_send):
        try:
            # We still keep a decent timeout, but smaller payloads should finish in < 5s
            response = self.session.post(self.api_url, json=data_to_send, timeout=15)
            print(f"Batch of {len(data_to_send)} frames sent. Status: {response.status_code}")
        except Exception as e:
            print(f"Upload failed: {e}")

    def process(self, detections, rgbMsg, depthMsg):
        rgb_frame = rgbMsg.getCvFrame()
        depth_frame = depthMsg.getFrame()

        # Compression: 50% quality is usually plenty for AI detection verification
        # and significantly reduces the "Write Timeout" risk.
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
        
        _, rgb_encoded = cv2.imencode('.jpg', rgb_frame, encode_param)
        depth_norm = cv2.normalize(depth_frame, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        depth_color = cv2.applyColorMap(depth_norm, cv2.COLORMAP_JET)
        _, depth_encoded = cv2.imencode('.jpg', depth_color, encode_param)

        payload = {
            "detections": [{
                "label": d.label, "conf": round(d.confidence, 2),
                "bbox": {"x1": d.xmin, "y1": d.ymin, "x2": d.xmax, "y2": d.ymax},
                "spatial": {"x": int(d.spatialCoordinates.x), "z": int(d.spatialCoordinates.z)}
            } for d in detections.detections],
            "rgb_base64": base64.b64encode(rgb_encoded).decode('utf-8'),
            "depth_base64": base64.b64encode(depth_encoded).decode('utf-8'),
            "timestamp" : dt.datetime.now().timestamp()
        }

        self.frame_buffer.append(payload)

        # TRIGGER: Send every 10 frames instead of 60.
        # This keeps each individual POST request much smaller (~1-2MB).
        if len(self.frame_buffer) >= 10:
            data_snapshot = list(self.frame_buffer)
            self.frame_buffer = [] # Clear immediately to avoid duplicates
            
            threading.Thread(target=self._send_batch, args=(data_snapshot,), daemon=True).start()

# ... (Rest of your Pipeline setup remains the same) ...
with dai.Pipeline() as p:
    fps = 20
    size = (640, 400)
    camRgb = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_A, sensorFps=fps)
    monoLeft = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_B, sensorFps=fps)
    monoRight = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_C, sensorFps=fps)
    depthSource = p.create(dai.node.StereoDepth)
    depthSource.setExtendedDisparity(True)
    monoLeft.requestOutput(size).link(depthSource.left)
    monoRight.requestOutput(size).link(depthSource.right)
    model = dai.NNModelDescription("yolov6-nano")
    sdn = p.create(dai.node.SpatialDetectionNetwork).build(camRgb, depthSource, model)

    api_node = p.create(ApiSyncNode, api_url="https://ai-detective-k-9gvw.onrender.com/api/camera-output")
    api_node.build(sdn.out, sdn.passthrough, sdn.passthroughDepth)

    print("Pipeline running... sending small batches to avoid timeouts.")
    p.run()