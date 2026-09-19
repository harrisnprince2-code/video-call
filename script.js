const localCamera = document.getElementById("localCamera");
const timer = document.getElementById("timer");

const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const speakerBtn = document.getElementById("speakerBtn");
const endBtn = document.getElementById("endBtn");

let stream = null;
let seconds = 0;
let timerInterval = null;
let micMuted = false;
let cameraOff = false;
let speakerOn = true;

// Start camera
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localCamera.srcObject = stream;

    startTimer();

  } catch (error) {
    console.error("Camera error:", error);

    alert(
      "Camera access was blocked. Please allow camera and microphone permissions and try again."
    );
  }
}

// Timer
function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    timer.textContent =
      String(minutes).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0");
  }, 1000);
}

// Mute microphone
muteBtn.addEventListener("click", () => {
  if (!stream) return;

  const audioTracks = stream.getAudioTracks();

  audioTracks.forEach(track => {
    track.enabled = !track.enabled;
  });

  micMuted = !micMuted;

  muteBtn.textContent = micMuted ? "🔇" : "🎙️";
});

// Turn camera on/off
cameraBtn.addEventListener("click", () => {
  if (!stream) return;

  const videoTracks = stream.getVideoTracks();

  videoTracks.forEach(track => {
    track.enabled = !track.enabled;
  });

  cameraOff = !cameraOff;

  cameraBtn.textContent = cameraOff ? "📷" : "🎥";
});

// Speaker button
speakerBtn.addEventListener("click", () => {
  speakerOn = !speakerOn;

  speakerBtn.textContent = speakerOn ? "🔊" : "🔇";
});

// End call
endBtn.addEventListener("click", () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  clearInterval(timerInterval);

  localCamera.srcObject = null;

  timer.textContent = "Call ended";

  endBtn.textContent = "✓";
  endBtn.disabled = true;
});

// Start everything
startCamera();
