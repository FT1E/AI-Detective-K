import depthai as dai
import cv2

# Create pipeline
pipeline = dai.Pipeline()

# Define a color camera node
cam_rgb = pipeline.createColorCamera()
cam_rgb.setPreviewSize(640, 480)
cam_rgb.setInterleaved(False)

# Create XLinkOut node to stream video to host
xout_rgb = pipeline.createXLinkOut()
xout_rgb.setStreamName("rgb")

# Link camera to output
cam_rgb.preview.link(xout_rgb.input)

# Connect to device (auto-detects OAK camera)
with dai.Device(pipeline) as device:
    print("Connected cameras:", device.getConnectedCameraFeatures())
    # Get output queue
    q = device.getOutputQueue(name="rgb", maxSize=4, blocking=False)
    while True:
        in_rgb = q.get()
        frame = in_rgb.getCvFrame()
        cv2.imshow("OAK Camera Preview", frame)
        if cv2.waitKey(1) == ord('q'):
            break
    cv2.destroyAllWindows()
