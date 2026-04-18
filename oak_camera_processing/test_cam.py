#!/usr/bin/env python3

import cv2
import depthai as dai
import numpy as np

# Create pipeline
with dai.Pipeline() as pipeline:


    # Define source and output
    # base queue for rgb frames
    cam = pipeline.create(dai.node.Camera).build()
    videoQueue = cam.requestOutput((640,400)).createOutputQueue()

    # queues for depth perception
    monoLeft = pipeline.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_B)
    monoRight = pipeline.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_C)
    stereo = pipeline.create(dai.node.StereoDepth)

    # Linking depth
    monoLeftOut = monoLeft.requestFullResolutionOutput()
    monoRightOut = monoRight.requestFullResolutionOutput()
    monoLeftOut.link(stereo.left)
    monoRightOut.link(stereo.right)

    # stereo setting setup
    stereo.setRectification(True)
    stereo.setExtendedDisparity(True)
    stereo.setLeftRightCheck(True)

    # depth queue
    disparityQueue = stereo.disparity.createOutputQueue()

    # different color map for depth
    colorMap = cv2.applyColorMap(np.arange(256, dtype=np.uint8), cv2.COLORMAP_JET)
    colorMap[0] = [0, 0, 0]  # to make zero-disparity pixels black


    # Connect to device and start pipeline
    pipeline.start()

    # default value
    maxDisparity = 1
    while pipeline.isRunning():        
        videoIn = videoQueue.get()
        assert isinstance(videoIn, dai.ImgFrame)

        # get disparity / depth
        disparity = disparityQueue.get()
        assert isinstance(disparity, dai.ImgFrame)
        
        npDisparity = disparity.getFrame()
        maxDisparity = max(maxDisparity, np.max(npDisparity))
        colorizedDisparity = cv2.applyColorMap(((npDisparity / maxDisparity) * 255).astype(np.uint8), colorMap)
        cv2.imshow("disparity", colorizedDisparity)

        videoIn.getCvFrame()        # send this to server
        cv2.imshow("video", videoIn.getCvFrame())

        # todo - stopping logic (camera turns off or ?)
        if cv2.waitKey(1) == ord("q"):
            break