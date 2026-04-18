#!/usr/bin/env python3

import depthai as dai
import cv2
import json
import base64
import requests

class ApiSyncNode(dai.node.HostNode):
    def __init__(self, api_url):
        dai.node.HostNode.__init__(self)
        self.api_url = api_url
        self.sendProcessingToPipeline(True)

    def build(self, detections: dai.Node.Output, rgb: dai.Node.Output, depth: dai.Node.Output):
        # Linking all three ensures the SDK delivers them synchronized to process()
        self.link_args(detections, rgb, depth)

    def process(self, detections, rgbMsg, depthMsg):
        # Convert frames to numpy arrays
        rgb_frame = rgbMsg.getCvFrame()
        depth_frame = depthMsg.getFrame() # 16-bit depth in mm

        # Encode RGB to JPG
        _, rgb_encoded = cv2.imencode('.jpg', rgb_frame)
        
        # Normalize and colorize depth for the API (easier to view than raw 16-bit)
        depth_norm = cv2.normalize(depth_frame, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        depth_color = cv2.applyColorMap(depth_norm, cv2.COLORMAP_JET)
        _, depth_encoded = cv2.imencode('.jpg', depth_color)

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
            "depth_base64": base64.b64encode(depth_encoded).decode('utf-8')
        }

        # Send to backend
        try:
            # Note: Network requests are slow; consider a lower FPS or a separate thread for production
            requests.post(self.api_url, json=payload, timeout=0.5)
        except Exception as e:
            print(f"Sync API Error: {e}")

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
    api_node = p.create(ApiSyncNode, api_url="https://backend-3su7.onrender.com/api/camera-data")
    api_node.build(
        sdn.out, 
        sdn.passthrough,   # The RGB frame synced with the NN
        sdn.passthroughDepth # The Depth frame synced with the NN
    )

    print("Pipeline running... Sending synced data to API.")
    p.run()