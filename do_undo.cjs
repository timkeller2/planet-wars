const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

const replacementStr = `  canvas.addEventListener('mousedown', (event) => {
    const cPos = getCanvasPos(event.clientX, event.clientY);
    const posX = cPos.x;
    const posY = cPos.y;
    if (event.button === 1) { // Middle click = pan only
      if (mouseTimeout) {
        clearTimeout(mouseTimeout);
        mouseTimeout = null;
      }
      lasso.active = false;
      isDraggingCamera = true;
      lastCameraDragX = event.clientX;
      lastCameraDragY = event.clientY;
      return;
    }

    if (event.button !== 0 && event.button !== 2) return;

    mouseDownStartX = posX;
    mouseDownStartY = posY;
    lastCameraDragX = event.clientX;
    lastCameraDragY = event.clientY;
    isDraggingCamera = false; // Reset stale drag state

    handlePointerDown(posX, posY, event.shiftKey, false, event.button);

    if (event.button === 0) {
      if (event.shiftKey) {
        // Shift + Left Click = Lasso
        isDraggingCamera = false;
        const serverPos = getMouseServerPos(posX, posY);
        lasso.active = true;
        lasso.startX = serverPos.x;
        lasso.startY = serverPos.y;
        lasso.endX = serverPos.x;
        lasso.endY = serverPos.y;
      } else {
        // Left click = pan
        isDraggingCamera = true;
      }
    }
  });

  document.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const cPos = getCanvasPos(event.clientX, event.clientY);
    const mouseX = cPos.x;
    const mouseY = cPos.y;

    const oldServerPos = getMouseServerPos(mouseX, mouseY);

    const zoomFactor = 1.1;
    if (event.deltaY < 0) {
      cameraZoom *= zoomFactor;
    } else {
      cameraZoom /= zoomFactor;
    }
    cameraZoom = Math.max(0.2, Math.min(cameraZoom, 5.0));

    const newServerPos = getMouseServerPos(mouseX, mouseY);
    cameraPanX += (newServerPos.x - oldServerPos.x);
    cameraPanY += (newServerPos.y - oldServerPos.y);
  }, { passive: false });

  let lastMouseEmitTime = 0;

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;

    if (isDraggingCamera) {
      const dx = event.clientX - lastCameraDragX;
      const dy = event.clientY - lastCameraDragY;
      lastCameraDragX = event.clientX;
      lastCameraDragY = event.clientY;

      const mapWidth = serverState ? (serverState.width || 1920) : 1920;
      const mapHeight = serverState ? (serverState.height || 1620) : 1620;
      const scaleX = canvas.width / mapWidth;
      const scaleY = canvas.height / mapHeight;
      const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

      cameraPanX += (dx * cssToCanvasX) / finalScale;
      cameraPanY += (dy * cssToCanvasY) / finalScale;
    }

    // Always update hover state and lasso
    const cPos = getCanvasPos(event.clientX, event.clientY);
    handlePointerMove(cPos.x, cPos.y);

    const now = Date.now();
    if (now - lastMouseEmitTime > 5000) {
      lastMouseEmitTime = now;
      socket.emit('resetAFK');
      if (afkWarningOverlay && !afkWarningOverlay.classList.contains('hidden')) {
        afkWarningOverlay.classList.add('hidden');
      }
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (mouseTimeout) {
      clearTimeout(mouseTimeout);
      mouseTimeout = null;
    }
    isDraggingCamera = false;
    if (event.button === 1 || event.button === 2) {
      lasso.active = false;
      return;
    }
    handlePointerUp(event);
  });

  let touchTimeout = null;
  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Prevent double-firing with simulated mouse events
    const rect = canvas.getBoundingClientRect();
    if (event.touches.length === 2) {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
      initialPinchDistance = getPinchDistance(event.touches);
      initialPinchZoom = cameraZoom;
      const mid = getPinchMidpoint(event.touches);
      lastPinchMidX = mid.x;
      lastPinchMidY = mid.y;

      // Cancel any lasso when pinching starts
      lasso.active = false;
      return;
    }

    if (event.touches.length === 1) {
      const tx = event.touches[0].clientX;
      const ty = event.touches[0].clientY;
      lastCameraDragX = tx;
      lastCameraDragY = ty;
      const cPos = getCanvasPos(tx, ty);
      handlePointerDown(cPos.x, cPos.y, event.shiftKey, true);

      if (isDraggingCamera) {
        touchTimeout = setTimeout(() => {
          isDraggingCamera = false;
          const cPosHold = getCanvasPos(tx, ty);
          const serverPos = getMouseServerPos(cPosHold.x, cPosHold.y);
          lasso.active = true;
          lasso.startX = serverPos.x;
          lasso.startY = serverPos.y;
          lasso.endX = serverPos.x;
          lasso.endY = serverPos.y;

          floatingAnimations.push({
            x: serverPos.x,
            y: serverPos.y,
            text: "Lasso Mode",
            color: "#0ff",
            alpha: 1,
            life: 1.0
          });
        }, 800); // 800ms hold to start lasso
      }
    }
  });

  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;

    if (event.touches.length === 2 && initialPinchDistance) {
      const currentDistance = getPinchDistance(event.touches);
      const mid = getPinchMidpoint(event.touches);

      const zoomFactor = currentDistance / initialPinchDistance;
      const targetZoom = initialPinchZoom * zoomFactor;

      const oldServerPos = getMouseServerPos(mid.x, mid.y);
      cameraZoom = Math.max(0.2, Math.min(targetZoom, 5.0));

      const newServerPos = getMouseServerPos(mid.x, mid.y);
      cameraPanX += (newServerPos.x - oldServerPos.x);
      cameraPanY += (newServerPos.y - oldServerPos.y);

      // Calculate Pan based on mid-point movement
      const dx = mid.x - lastPinchMidX;
      const dy = mid.y - lastPinchMidY;
      lastPinchMidX = mid.x;
      lastPinchMidY = mid.y;

      const mapWidth = serverState ? (serverState.width || 1920) : 1920;
      const mapHeight = serverState ? (serverState.height || 1620) : 1620;
      const scaleX = canvas.width / mapWidth;
      const scaleY = canvas.height / mapHeight;
      const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

      cameraPanX += dx / finalScale;
      cameraPanY += dy / finalScale;

      return;
    }

    if (event.touches.length === 1 && !initialPinchDistance) {
      if (touchTimeout) {
        const dx = event.touches[0].clientX - lastCameraDragX;
        const dy = event.touches[0].clientY - lastCameraDragY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(touchTimeout);
          touchTimeout = null;
        }
      }

      if (isDraggingCamera) {
        const dx = event.touches[0].clientX - lastCameraDragX;
        const dy = event.touches[0].clientY - lastCameraDragY;
        lastCameraDragX = event.touches[0].clientX;
        lastCameraDragY = event.touches[0].clientY;

        const mapWidth = serverState ? (serverState.width || 1920) : 1920;
        const mapHeight = serverState ? (serverState.height || 1620) : 1620;
        const scaleX = canvas.width / mapWidth;
        const scaleY = canvas.height / mapHeight;
        const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

        cameraPanX += (dx * cssToCanvasX) / finalScale;
        cameraPanY += (dy * cssToCanvasY) / finalScale;
      } else if (lasso.active) {
        const cPos = getCanvasPos(event.touches[0].clientX, event.touches[0].clientY);
        handlePointerMove(cPos.x, cPos.y);
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    if (event.touches.length < 2) {
      initialPinchDistance = null;
    }
    if (event.touches.length === 0) {
      if (lasso.active) {
        handlePointerUp();
      }
    }
  });

  window.addEventListener('touchcancel', (event) => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    initialPinchDistance = null;
    if (lasso.active) {
      handlePointerUp();
    }
  });`;

// We'll normalize both strings to have LF line endings to find the match exactly.
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedRep = replacementStr.replace(/\r\n/g, '\n');

const idx = normalizedContent.indexOf(normalizedRep);
if (idx !== -1) {
  // Let's remove it! We can do it on normalized content, then reconstruct CRLF if needed.
  // Wait, does the original file use CRLF? Yes. Let's write the normalized content back using CRLF
  // or just replace it directly in the original content!
  // To replace it directly in original content, let's find the exact byte range.
  // Actually, we can just split content by \n, and join back with \r\n!
  const contentLines = normalizedContent.split('\n');
  const repLines = normalizedRep.split('\n');
  
  // Find which line index normalizedRep starts at
  let matchLineIdx = -1;
  for (let i = 0; i <= contentLines.length - repLines.length; i++) {
    let match = true;
    for (let j = 0; j < repLines.length; j++) {
      if (contentLines[i + j] !== repLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      matchLineIdx = i;
      break;
    }
  }
  
  if (matchLineIdx !== -1) {
    console.log(`Found match at line index ${matchLineIdx}`);
    contentLines.splice(matchLineIdx, repLines.length);
    fs.writeFileSync('src/main.js', contentLines.join('\r\n'), 'utf8');
    console.log('Successfully reverted the insertion!');
  } else {
    console.log('Could not find match line index!');
  }
} else {
  console.log('Could not find normalizedRep in content!');
}
