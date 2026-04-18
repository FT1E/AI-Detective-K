import cv2
import depthai as dai

pipeline = dai.Pipeline()

# Initialize the camera and build it
cam = pipeline.create(dai.node.Camera).build()

# FIX: Use the size and type directly. 
# This avoids 'dai.Capability' which is likely causing your current error.
video_out = cam.requestOutput(size=(1920, 1080), type=dai.ImgFrame.Type.NV12)

# Create the queue
video_queue = video_out.createOutputQueue()

# Start the pipeline
pipeline.start()

print("Camera started. Press 'q' to exit.")

while True:
    # Retrieve the frame
    frame = video_queue.get()
    
    if frame is not None:
        # Convert and show
        cv2.imshow("AI Detective K - Feed", frame.getCvFrame())

    if cv2.waitKey(1) == ord('q'):
        break