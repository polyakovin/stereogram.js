(() => {
  const createCanvasImage = (width, height) => {
    const canvas = document.createElement('CANVAS');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  const getImageData = (image) => {
    const imageCtx = image.getContext('2d');
    return imageCtx.getImageData(0, 0, image.width, image.height);
  };

  const resizeImage = (image, width, height) => {
    const newCanvas = createCanvasImage(width, height);
    const newCanvasCtx = newCanvas.getContext('2d');
    newCanvasCtx.drawImage(image, 0, 0, width, height);
    return newCanvas;
  }

  const resizeTexturePattern = (image, maxSeparation) => {
    const newHeight = (image.height * maxSeparation) / image.width;
    return resizeImage(image, maxSeparation, newHeight);
  }

  const generateTextDepthMap = (
    text,
    fontSize,
    width,
    height,
  ) => {
    const textCanvas = createCanvasImage(width, height);
    const textCanvasCtx = textCanvas.getContext('2d');
    textCanvasCtx.font = `bold ${fontSize}pt Arial`;
    textCanvasCtx.textAlign = 'center';
    textCanvasCtx.fillStyle = '#000000';
    textCanvasCtx.fillRect(0, 0, width, height);
    textCanvasCtx.fillStyle = '#888888';
    textCanvasCtx.fillText(text, width / 2, (height + fontSize) / 2);
    return textCanvas;
  }

  const getMinDepth = (
    separationFactor,
    maxDepth,
    observationDistance,
    suppliedMinDepth
  ) => {
    const computedMinDepth = Math.floor(
      (separationFactor * maxDepth * observationDistance) /
      (((1 - separationFactor) * maxDepth) + observationDistance)
    );
    return Math.min(
      Math.max(computedMinDepth, suppliedMinDepth),
      maxDepth,
    );
  }

  const getMaxDepth = (
    suppliedMaxDepth,
    observationDistance,
  ) => Math.max(
    Math.min(suppliedMaxDepth, observationDistance),
    0,
  );

  const convertToPixels = (
    valueInches,
    ppi,
  ) => Math.floor(valueInches * ppi);

  const getDepth = (
    depth,
    maxDepth,
    minDepth,
  ) => Math.floor(maxDepth - (depth * (maxDepth - minDepth) / 255));

  const getSeparation = (
    observationDistance,
    eyeSeparation,
    depth,
  ) => Math.floor((eyeSeparation * depth) / (depth + observationDistance));

  const generateStereogram = (depthMap, texturePattern, {
    width = 800,
    height = 600,
    observationDistanceInches = 14,
    eyeSeparationInches = 3,
    maxDepthInches = 12,
    minDepthInches = 0,
    horizontalPPI = 72,
    verticalPPI = 72,
    separationFactor = 0.55,
  } = {}) => {
    const observationDistance = convertToPixels(
      observationDistanceInches,
      horizontalPPI,
    );
    const eyeSeparation = convertToPixels(
      eyeSeparationInches,
      horizontalPPI,
    );
    const maxDepth = getMaxDepth(
      convertToPixels(maxDepthInches, horizontalPPI),
      observationDistance,
    );
    const minDepth = getMinDepth(
      separationFactor,
      maxDepth,
      observationDistance,
      convertToPixels(minDepthInches, horizontalPPI),
    );
    const verticalShift = Math.floor(verticalPPI / 16);
    const maxSeparation = getSeparation(
      observationDistance,
      eyeSeparation,
      maxDepth,
    );

    depthMap = resizeImage(depthMap, width, height);
    const depthMapData = getImageData(depthMap);

    texturePattern = resizeTexturePattern(texturePattern, maxSeparation);
    const texturePatternData = getImageData(texturePattern);

    const stereogram = createCanvasImage(width, height);
    const stereogramCtx = stereogram.getContext('2d');
    const stereogramData = getImageData(stereogram);
    stereogramCtx.drawImage(texturePattern, 0, 0);

    const linksL = [];
    const linksR = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        linksL[x] = x;
        linksR[x] = x;
      }

      for (let x = 0; x < width; x++) {
        const depth = getDepth(
          depthMapData.data[4 * (x + y * width)],
          maxDepth,
          minDepth,
        );
        const separation = getSeparation(
          observationDistance,
          eyeSeparation,
          depth,
        );
        const left = Math.floor(x - (separation / 2));
        const right = Math.floor(left + separation);

        if (left >= 0 && right < width) {
          let visible = true;

          if (linksL[right] != right) {
            if (linksL[right] < left) {
              linksR[linksL[right]] = linksL[right];
              linksL[right] = right;
            } else {
              visible = false;
            }
          }

          if (linksR[left] != left) {
            if (linksR[left] > right) {
              linksL[linksR[left]] = linksR[left];
              linksR[left] = left;
            } else {
              visible = false;
            }
          }

          if (visible) {
            linksL[right] = left;
            linksR[left] = right;
          }
        }
      }

      let lastLinked = -10;
      for (let x = 0; x < width; x++) {
        const idx = 4 * (x + y * width);
        const updateStereogramPixel = (fromIdx, from = stereogramData) => {
          stereogramData.data[idx] = from.data[fromIdx];
          stereogramData.data[idx + 1] = from.data[fromIdx + 1];
          stereogramData.data[idx + 2] = from.data[fromIdx + 2];
          stereogramData.data[idx + 3] = from.data[fromIdx + 3];
        };

        if (linksL[x] == x) {
          if (lastLinked == x - 1) {
            updateStereogramPixel(idx - 4);
          } else {
            const { width, height } = texturePattern;
            updateStereogramPixel(
              4 * ((x % maxSeparation) + width * (
                Math.floor(y + ((x / maxSeparation) * verticalShift)) % height
              )),
              texturePatternData,
            );
          }
        } else {
          updateStereogramPixel(4 * (linksL[x] + y * width));
          lastLinked = x;
        }
      }
    }

    stereogramCtx.putImageData(stereogramData, 0, 0);
    return stereogram;
  }

  window.generateTextDepthMap = generateTextDepthMap;
  window.generateStereogram = generateStereogram;
})();
