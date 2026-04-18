#!/usr/bin/env python3

import cv2
import depthai as dai

# Create pipeline
with dai.Pipeline() as pipeline:


    # Define source and output
    # base queue for rgb frames
    cam = pipeline.create(dai.node.Camera).build()
    videoQueue = cam.requestOutput((640,400)).createOutputQueue()


    # Connect to device and start pipeline
    pipeline.start()
    while pipeline.isRunning():
        videoIn = videoQueue.get()
        assert isinstance(videoIn, dai.ImgFrame)

        videoIn.getCvFrame()        # send this to server
        cv2.imshow("video", videoIn.getCvFrame())

        # todo - stopping logic (camera turns off or ?)
        if cv2.waitKey(1) == ord("q"):
            break