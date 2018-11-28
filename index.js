let files = [];
let worker = startWorker();
let video = undefined;

function convertDataUriToBinary(dataUri) {
  var base64 = dataUri.substring(23);
  var raw = window.atob(base64);
  var rawLength = raw.length;

  var array = new Uint8Array(new ArrayBuffer(rawLength));
  for (i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function addRandomImage(index) {
  var c = document.getElementById("myCanvas");
  var ctx = c.getContext("2d");

  if (files.length === 0) {
    // https://stackoverflow.com/questions/26742180/canvas-todataurl-results-in-solid-black-image
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, c.width, c.height);
  }

  ctx.beginPath();
  let x = Math.floor(Math.random() * c.width);
  let y = Math.floor(Math.random() * c.height);
  let r = Math.floor(Math.random() * (c.height / 2) + 20);
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.clear;
  dataUri = c.toDataURL("image/jpeg");
  jpegBytes = convertDataUriToBinary(dataUri);

  if (index < 10) {
    index = "00" + String(index);
  } else if (i < 100) {
    index = "0" + String(index);
  } else {
    index = String(index);
  }

  files.push({
    data: jpegBytes,
    name: "img_" + index + ".jpg"
  });
}

function startWorker() {
  let worker = new Worker("node_modules/ffmpeg.js/ffmpeg-worker-mp4.js");
  worker.onmessage = function(e) {
    var msg = e.data;

    switch (msg.type) {
      case "ready":
        console.log("ffmpeg.js worker ready...");
        break;
      case "stdout":
        console.log(msg.data);
        break;
      case "stderr":
        console.log(msg.data);
        break;

      case "done":
        video = new Blob([msg.data.MEMFS[0].data], {
          type: "video/mp4"
        });

        // ...
        break;

      case "exit":
        console.log("Process exited with code " + msg.data);
        break;
    }
  };
  return worker;
}

// var saveBlob = (function() {
//   var a = document.createElement("a");
//   document.body.appendChild(a);
//   a.style = "display: none";
//   return function(data, fileName) {
//     let url = window.URL.createObjectURL(data);
//     a.href = url;
//     a.download = fileName;
//     a.click();
//     window.URL.revokeObjectURL(url);
//   };
// })();
function saveBlob(blob, fileName) {
  var blobUrl = URL.createObjectURL(blob);
  var link = document.createElement("a"); // Or maybe get it from the current document
  link.href = blobUrl;
  link.download = fileName;
  link.innerHTML = fileName + " ";
  document.body.appendChild(link); // Or append it whereever you want
}

document.getElementById("btnCanvas").addEventListener("click", () => {
  for (let i = 0; i < 100; ++i) {
    addRandomImage(i);
  }
});

document.getElementById("btnDownload").addEventListener("click", () => {
  saveBlob(video, "video.mp4");
});

document.getElementById("btnDownloadImage").addEventListener("click", () => {
  //   let blob = new Blob(files[0].data, { type: "image/jpeg" });
  let blob = new Blob([files[0].data], { type: "application/octet-stream" });
  saveBlob(blob, "image.jpg");
});

document.getElementById("btnPlay").addEventListener("click", () => {
  var blobUrl = URL.createObjectURL(video);
  document.getElementById("myVideo").src = blobUrl;
});

document.getElementById("btnVideo").addEventListener("click", () => {
  //   let inputFiles = files.map(file => file.name);
  //   let arguments = ["-r", "24", "-i"]
  //     .concat(inputFiles)
  //     .concat(["-v", "verbose", "output.mp4"]);

  worker.postMessage({
    type: "run",
    // https://stackoverflow.com/questions/24961127/how-to-create-a-video-from-images-with-ffmpeg
    // arguments: ["-r", "1", "-i", "img_%03d.jpg", "-v", "verbose", "output.mp4"],
    // https://stackoverflow.com/a/37478183/1010496
    arguments: [
      "-framerate",
      "30",
      "-pattern_type",
      "glob",
      "-i",
      "img_*.jpg",
      //   "-vf",
      //   "fps=25",
      "-v",
      "verbose",
      "output.mp4"
    ],

    // arguments: ["-r", "24", "-i", "img_1.jpg", "-v", "verbose", "output.mp4"],
    // files: files
    MEMFS: files
    //TOTAL_MEMORY: 268435456,
    // MEMFS: [
    //   {
    //     name: "input.jpeg",
    //     data: jpegBytes
    //   }
    // ],
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
