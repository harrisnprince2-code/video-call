const incomingScreen = document.getElementById("incomingScreen");
const connectingScreen = document.getElementById("connectingScreen");
const callScreen = document.getElementById("callScreen");

const acceptBtn = document.getElementById("acceptBtn");
const declineBtn = document.getElementById("declineBtn");

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


// ==========================
// ACCEPT CALL
// ==========================

acceptBtn.addEventListener("click", async () => {

  incomingScreen.style.display = "none";
  connectingScreen.style.display = "flex";

  try {

    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localCamera.srcObject = stream;

    setTimeout(() => {

      connectingScreen.style.display = "none";
      callScreen.style.display = "block";

      startTimer();

    }, 1800);

  } catch (error) {

    connectingScreen.style.display = "none";
    incomingScreen.style.display = "flex";

    alert(
      "Camera and microphone permission is required. Please allow access and try again."
    );

    console.error(error);
  }
});


// ==========================
// DECLINE CALL
// ==========================

declineBtn.addEventListener("click", () => {

  incomingScreen.innerHTML = `
    <div class="incoming-content">
      <div class="caller-avatar">
        📵
      </div>

      <h1>Call Declined</h1>

      <p>The call has ended.</p>

      <button
        onclick="location.reload()"
        style="
          margin-top:30px;
          padding:14px 25px;
          border:0;
          border-radius:30px;
          background:#ffffff;
          color:#000;
          font-size:15px;
          cursor:pointer;
        "
      >
        Call Again
      </button>
    </div>
  `;

});


// ==========================
// TIMER
// ==========================

function startTimer() {

  seconds = 0;

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


// ==========================
// MUTE
// ==========================

muteBtn.addEventListener("click", () => {

  if (!stream) return;

  const audioTracks = stream.getAudioTracks();

  audioTracks.forEach(track => {
    track.enabled = !track.enabled;
  });

  micMuted = !micMuted;

  muteBtn.textContent = micMuted ? "🔇" : "🎙️";

});


// ==========================
// CAMERA
// ==========================

cameraBtn.addEventListener("click", () => {

  if (!stream) return;

  const videoTracks = stream.getVideoTracks();

  videoTracks.forEach(track => {
    track.enabled = !track.enabled;
  });

  cameraOff = !cameraOff;

  cameraBtn.textContent = cameraOff ? "📷" : "🎥";

});


// ==========================
// SPEAKER
// ==========================

speakerBtn.addEventListener("click", () => {

  speakerOn = !speakerOn;

  speakerBtn.textContent = speakerOn ? "🔊" : "🔇";

});


// ==========================
// END CALL
// ==========================

endBtn.addEventListener("click", () => {

  if (stream) {

    stream.getTracks().forEach(track => {
      track.stop();
    });

  }

  clearInterval(timerInterval);

  localCamera.srcObject = null;

  callScreen.innerHTML = `
    <div style="
      width:100%;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      background:#050505;
    ">
      <div>
        <div style="font-size:60px;margin-bottom:20px;">
          ☎
        </div>

        <h2 style="margin-bottom:10px;">
          Call Ended
        </h2>

        <p style="color:#888;margin-bottom:25px;">
          The video call has ended.
        </p>

        <button
          onclick="location.reload()"
          style="
            padding:14px 28px;
            border:0;
            border-radius:30px;
            background:#fff;
            color:#000;
            font-size:15px;
            cursor:pointer;
          "
        >
          Start Again
        </button>
      </div>
    </div>
  `;

});
