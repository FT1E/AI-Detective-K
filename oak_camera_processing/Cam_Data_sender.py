#!/usr/bin/env python3

import depthai as dai
import cv2
import json
import base64
import requests
import datetime as dt
import threading

MAX_FRAMES = 30 

class ApiSyncNode(dai.node.HostNode):
    def __init__(self, api_url):
        dai.node.HostNode.__init__(self)
        self.api_url = api_url
        self.last_x_frames = []
        self.last_time_stamp = dt.datetime.now().timestamp()
        
        # Use a Session for connection pooling (faster)
        self.session = requests.Session()
        self.sendProcessingToPipeline(True)

    def build(self, detections: dai.Node.Output, rgb: dai.Node.Output, depth: dai.Node.Output):
        # Linking ensures the SDK delivers them synchronized to process()
        self.link_args(detections, rgb, depth)

    def _send_batch(self, data_to_send):
        """ Internal helper to send data in the background """
        try:
            # Increased timeout to 20s. Render Free Tier can be slow to respond.
            response = self.session.post(self.api_url, json=data_to_send, timeout=20)
            print(f"Batch sent successfully. Status: {response.status_code}")
        except Exception as e:
            print(f"Background Upload Error: {e}")

    def process(self, detections, rgbMsg, depthMsg):
        # Convert frames to numpy arrays
        rgb_frame = rgbMsg.getCvFrame()
        depth_frame = depthMsg.getFrame() # 16-bit depth in mm

        # Encode RGB to JPG with 70% quality to reduce bandwidth/SSL buffer errors
        _, rgb_encoded = cv2.imencode('.jpg', rgb_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        
        # Normalize and colorize depth
        depth_norm = cv2.normalize(depth_frame, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        depth_color = cv2.applyColorMap(depth_norm, cv2.COLORMAP_JET)
        _, depth_encoded = cv2.imencode('.jpg', depth_color, [int(cv2.IMWRITE_JPEG_QUALITY), 70])

        # Prepare JSON payload
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
            "depth_base64": base64.b64encode(depth_encoded).decode('utf-8'),
            "timestamp" : dt.datetime.now().timestamp()
        }

        # Add current frame to buffer
        self.last_x_frames.append(payload)
        
        # Keep buffer at most MAX_FRAMES frames at most
        if len(self.last_x_frames) > MAX_FRAMES:
            self.last_x_frames[-MAX_FRAMES:]

        # Send batch every 2 seconds
        current_time = dt.datetime.now().timestamp()
        if (current_time - self.last_time_stamp) > 2:
            if self.last_x_frames:
                # Create a snapshot of current buffer to send in background
                data_snapshot = list(self.last_x_frames)
                
                # Run the POST request in a separate thread so camera doesn't lag
                upload_thread = threading.Thread(
                    target=self._send_batch, 
                    args=(data_snapshot,), 
                    daemon=True
                )
                upload_thread.start()

with dai.Pipeline() as p:
    fps = 20
    size = (640, 400)
    
    # Setup Sources (as per test_spatial_detection.py)
    camRgb = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_A, sensorFps=fps)
    monoLeft = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_B, sensorFps=fps)
    monoRight = p.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_C, sensorFps=fps)

    # Setup Stereo Depth (as per test_depth.py logic but following SDK syntax)
    depthSource = p.create(dai.node.StereoDepth)
    depthSource.setExtendedDisparity(True)
    monoLeft.requestOutput(size).link(depthSource.left)
    monoRight.requestOutput(size).link(depthSource.right)

    # Spatial Detection Network
    model = dai.NNModelDescription("yolov6-nano")
    sdn = p.create(dai.node.SpatialDetectionNetwork).build(camRgb, depthSource, model)

    # Output Node
    api_node = p.create(ApiSyncNode, api_url="https://ai-detective-k-9gvw.onrender.com/api/camera-output")
    api_node.build(
        sdn.out, 
        sdn.passthrough,   # The RGB frame synced with the NN
        sdn.passthroughDepth # The Depth frame synced with the NN
    )

    print("Pipeline running... Sending synced data to API.")
    p.run()