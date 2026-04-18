import cv2
import depthai as dai

# 1. Create the pipeline (the blueprint for the camera)
pipeline = dai.Pipeline()

# 2. Define the source: Color Camera
camRgb = pipeline.create(dai.node.ColorCamera)
camRgb.setPreviewSize(1280, 720)  # High-definition preview
camRgb.setInterleaved(False)
camRgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)

# 3. Define the output: Sending data to your computer
xoutRgb = pipeline.create(dai.node.XLinkOut)
xoutRgb.setStreamName("video")

# 4. Link the camera to the output
camRgb.preview.link(xoutRgb.input)

# 5. Connect to device and start pipeline
with dai.Device(pipeline) as device:
    
    # --- PRO TIP: Turn on the IR Flood Light for "Night Vision" ---
    # This is great for forensic analysis in dark environments.
    # Set brightness between 0 and 1500 (mA)
    device.setIrFloodLightBrightness(500) 
    
    # Output queue to get the frames from the 'video' stream
    qRgb = device.getOutputQueue(name="video", maxSize=4, blocking=False)

    print("Camera feed started. Press 'q' to exit.")

    while True:
        # Get the frame from the camera
        inRgb = qRgb.get()
        frame = inRgb.getCvFrame()

        # Display the live feed
        cv2.imshow("OAK-D Pro W Live Feed", frame)

        # Break loop on 'q' key press
        if cv2.waitKey(1) == ord('q'):
            break

cv2.destroyAllWindows()