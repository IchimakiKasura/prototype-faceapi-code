@echo off
title openCam

:main
cls
echo ***********************
echo * openCam by Ichimaki *
echo ***********************
echo.
echo Created for F.I.S.T (Facial Integrated System Technology) prototype.
echo.
echo NOTE: Make sure the raspberry pi server is running!
echo.
echo STEPS:
echo    Please try these steps if you don't know what to do.
echo.
echo    Set up the raspberry pi camera video feed by typing these commands:
echo.
echo        "rpicam-vid -t 0 --inline -o --listen tcp://0.0.0.0:1234"
echo.
echo       NOTE: the "1234" in the end of the TCP is a port, you can customize it whatever you want.
echo             as long as its 4 digits
echo.
echo    After setting the raspberry pi, find its ip address by using "ifconfig" and place it here.
echo.
echo note that port should be the same as the one placed on the raspberry pi
echo example: 192.168.1.1:1234 ^| ^<ip address^>:^<port^>
echo.
set /p %ip%=Input the I.P. Address of the Raspberry PI: 

if exist ffplay.exe (
    rem found
    echo starting camera, please wait...
    ffplay tcp://%ip% -vf "setpts=N/30" -fflags nobuffer -flags low_delay -framedrop
    exit
) else (
    rem not found
    cls
    echo "ffplay.exe" was not found, Please retry again.
    call :sleep 5
    goto main
)

:sleep
ping localhost -n %~1 >nul