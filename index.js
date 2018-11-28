let worker = startWorker();

const targetDurationSec = 3.0;
const targetFps = 24;

const fileCount = targetDurationSec * targetFps;
const frameDuration = 1000 / targetFps;
let cameraFacingFront = true;

const btnCamera = document.getElementById("btnCamera");
const btnCapture = document.getElementById("btnCapture");
const btnVideo = document.getElementById("btnVideo");
const btnPlay = document.getElementById("btnPlay");
const btnDownloadImage = document.getElementById("btnDownloadImage");
const btnDownload = document.getElementById("btnDownload");
const btnDebug = document.getElementById("btnDebug");

const camVideo = document.getElementById("camVideo");
const camCanvas = document.getElementById("camCanvas");

btnDebug.addEventListener("click", () => {});

btnCamera.addEventListener("click", () => {
  // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  const constraints = {
    audio: false, // video: true
    video: {
      // width: { min: 1024, ideal: 1280, max: 1920 },
      // height: { min: 776, ideal: 720, max: 1080 },
      facingMode: cameraFacingFront ? "user" : "environment"
    }
  };

  cameraFacingFront = !cameraFacingFront;

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(handleSuccess)
    .catch(handleError);
});

camVideo.addEventListener("play", () => {
  console.log("Streaming from camera");

  let videoW = camVideo.videoWidth;
  let videoH = camVideo.videoHeight;
  let canvasW = videoW / 2;
  let canvasH = videoH / 2;
  camCanvas.width = canvasW;
  camCanvas.height = canvasH;

  console.log(`Video dimensions = ${videoW}x${videoH}`);
  console.log(`Canvas dimensions = ${canvasW}x${canvasH}`);
});

function handleSuccess(stream) {
  console.log("Got access to user media");
  //window.stream = stream; // make stream available to browser console
  camVideo.srcObject = stream;
  btnCapture.disabled = false;
}

function handleError(error) {
  console.log("navigator.getUserMedia error: ", error);
}

btnCapture.addEventListener("click", () => {
  images = [];
  files = [];
  captureSingleImage(0);
});

function captureSingleImage(index) {
  let start = Date.now();
  const jpegQuality = 0.9;
  camCanvas
    .getContext("2d")
    .drawImage(
      camVideo,
      0,
      0,
      camVideo.videoWidth,
      camVideo.videoHeight,
      0,
      0,
      camCanvas.width,
      camCanvas.height
    );

  dataUri = camCanvas.toDataURL("image/jpeg", jpegQuality);

  // could be done later, but profiling yields no advantages
  files.push({
    data: convertDataUriToBinary(dataUri),
    name: getFilename(index)
  });
  console.log(`Image #${index} captured`);

  let elapsed = Date.now() - start;
  console.log(`elapsed = ${elapsed}ms`);

  let wait = frameDuration - elapsed;
  wait = wait < 0 ? 0 : wait;
  console.log(`wait = ${wait}ms`);

  if (index < fileCount) {
    setTimeout(captureSingleImage, wait, index + 1);
  } else {
    console.log("Capture complete");
    btnDownloadImage.disabled = false;
    btnVideo.disabled = false;
  }
}

function getFilename(index) {
  if (index < 10) {
    index = "000" + String(index);
  } else if (index < 100) {
    index = "00" + String(index);
  } else if (index < 1000) {
    index = "0" + String(index);
  } else {
    index = String(index);
  }

  return "img_" + index + ".jpg";
}

function convertImagesToFiles(images) {
  return images.map((base64imageData, index) => {
    return {
      data: convertDataUriToBinary(base64imageData),
      name: getFilename(index)
    };
  });
}

function convertDataUriToBinary(dataUri) {
  // skip 23 characters dataUri prefix
  // data:image/jpeg;base64,
  var base64 = dataUri.substring(23);
  var raw = window.atob(base64);
  var rawLength = raw.length;

  var array = new Uint8Array(new ArrayBuffer(rawLength));
  for (i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function startWorker() {
  let worker = new Worker("node_modules/ffmpeg.js/ffmpeg-worker-mp4.js");
  worker.onmessage = function(e) {
    var msg = e.data;

    switch (msg.type) {
      case "ready":
        console.log("ffmpeg.js > ready");
        break;

      case "stdout":
        console.log("ffmpeg.js > " + msg.data);
        break;

      case "stderr":
        console.log("ffmpeg.js > " + msg.data);
        break;

      case "done":
        console.log("ffmpeg.js > done");
        if (msg.data.MEMFS.length > 0) {
          video = new Blob([msg.data.MEMFS[0].data], {
            type: "video/mp4"
          });

          btnDownload.disabled = false;
          btnPlay.disabled = false;
        } else {
          console.log("ffmpeg.js > no output file generated");
        }
        break;

      case "exit":
        console.log("ffmpeg.js > exited with code " + msg.data);
        break;
    }
  };
  return worker;
}

function saveBlob(blob, fileName) {
  var blobUrl = URL.createObjectURL(blob);
  var link = document.createElement("a"); // Or maybe get it from the current document
  link.href = blobUrl;
  link.download = fileName;
  link.innerHTML = fileName + " ";
  document.body.appendChild(link); // Or append it whereever you want
}

btnDownload.addEventListener("click", () => {
  saveBlob(video, "video.mp4");
});

btnDownloadImage.addEventListener("click", () => {
  let blob = new Blob([files[0].data], { type: "application/octet-stream" });
  saveBlob(blob, "image.jpg");
});

btnPlay.addEventListener("click", () => {
  var blobUrl = URL.createObjectURL(video);
  document.getElementById("myVideo").src = blobUrl;
});

btnDebugFiles.addEventListener("click", () => {
  for (let i = 0; i < files.length; ++i) {
    let blob = new Blob([files[i].data], { type: "application/octet-stream" });
    var blobUrl = URL.createObjectURL(blob);
    var image = document.createElement("img");
    image.src = blobUrl;
    document.body.appendChild(image);
  }
});

btnVideo.addEventListener("click", () => {
  worker.postMessage({
    TOTAL_MEMORY: 268435456,
    type: "run",
    // https://stackoverflow.com/a/37478183/1010496
    arguments: [
      "-framerate",
      String(targetFps),
      "-pattern_type",
      "glob",
      "-i",
      "img_*.jpg",
      "-v",
      "verbose",
      "output.mp4"
    ],

    MEMFS: files
    // arguments: [
    //   "-r",
    //   "60",
    //   "-i",
    //   "input.jpeg",
    //   "-aspect",
    //   "16/9",
    //   "-c:v",
    //   "libx264",
    //   "-crf",
    //   "1",
    //   "-vf",
    //   "scale=1280:720",
    //   "-pix_fmt",
    //   "yuv420p",
    //   "-vb",
    //   "20M",
    //   "out.mp4"
    // ]
  });
});
