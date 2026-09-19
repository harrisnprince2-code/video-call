import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ==========================================
// FIREBASE
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyDUMYF3nuIKRYm84WzPm-6ZD13LKXnQ3X4",
  authDomain: "video-call-a196f.firebaseapp.com",
  projectId: "video-call-a196f",
  storageBucket: "video-call-a196f.firebasestorage.app",
  messagingSenderId: "141052708932",
  appId: "1:141052708932:web:3aac7c8d2c4934f8ad1411",
  measurementId: "G-BPDZB7DFND"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


// ==========================================
// ELEMENTS
// ==========================================

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


// ==========================================
// WEBRTC
// ==========================================

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let roomId = null;
let isCaller = false;

let unsubscribeRoom = null;
let unsubscribeCandidates = null;

let seconds = 0;
let timerInterval = null;

let micMuted = false;
let cameraOff = false;
let speakerOn = true;


// Public STUN server
const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};


// ==========================================
// AUTHENTICATE
// ==========================================

async function startFirebase() {

  try {

    await signInAnonymously(auth);

    console.log("Firebase authentication successful.");

    checkCallLink();

  } catch (error) {

    console.error("Firebase authentication error:", error);

    alert(
      "Unable to connect to the call server. Please refresh the page."
    );

  }

}


// ==========================================
// CHECK URL
// ==========================================

function checkCallLink() {

  const params = new URLSearchParams(window.location.search);

  roomId = params.get("room");

  if (roomId) {

    // Someone sent us a call link.
    isCaller = false;

    showIncomingCall();

  } else {

    // No room yet.
    isCaller = true;

    showCallerStart();

  }

}


// ==========================================
// CALLER START SCREEN
// ==========================================

function showCallerStart() {

  incomingScreen.style.display = "flex";

  incomingScreen.innerHTML = `
  
    <div class="incoming-content">

      <div class="caller-avatar">
        📹
      </div>

      <h1>Video Call</h1>

      <h2>Call Your Sister</h2>

      <p>Create a private video call</p>

      <button
        id="createCallBtn"
        style="
          margin-top:30px;
          padding:16px 30px;
          border:0;
          border-radius:30px;
          background:#ffffff;
          color:#000;
          font-size:16px;
          font-weight:600;
          cursor:pointer;
        "
      >
        Create Call
      </button>

    </div>

  `;

  document
    .getElementById("createCallBtn")
    .addEventListener("click", createCall);

}


// ==========================================
// CREATE CALL
// ==========================================

async function createCall() {

  try {

    connectingScreen.style.display = "flex";
    incomingScreen.style.display = "none";

    await startLocalCamera();

    peerConnection = createPeerConnection();

    const callDoc = doc(collection(db, "calls"));

    roomId = callDoc.id;

    const offerCandidates = collection(
      callDoc,
      "offerCandidates"
    );

    const answerCandidates = collection(
      callDoc,
      "answerCandidates"
    );


    peerConnection.onicecandidate = async event => {

      if (event.candidate) {

        await addDoc(
          offerCandidates,
          event.candidate.toJSON()
        );

      }

    };


    const offerDescription =
      await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
      offerDescription
    );


    await setDoc(callDoc, {

      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp
      },

      createdAt: Date.now()

    });


    showWaitingForAnswer();


    unsubscribeRoom = onSnapshot(
      callDoc,
      async snapshot => {

        const data = snapshot.data();

        if (!peerConnection) return;

        if (
          data &&
          data.answer &&
          !peerConnection.currentRemoteDescription
        ) {

          const answerDescription =
            new RTCSessionDescription(data.answer);

          await peerConnection.setRemoteDescription(
            answerDescription
          );

          connectingScreen.style.display = "none";

          callScreen.style.display = "block";

          startTimer();

        }

      }
    );


    onSnapshot(
      answerCandidates,
      snapshot => {

        snapshot.docChanges().forEach(change => {

          if (change.type === "added") {

            const candidate =
              new RTCIceCandidate(change.doc.data());

            peerConnection
              .addIceCandidate(candidate)
              .catch(console.error);

          }

        });

      }
    );


  } catch (error) {

    console.error(error);

    connectingScreen.style.display = "none";

    incomingScreen.style.display = "flex";

    alert(
      "Could not create the video call. Please try again."
    );

  }

}


// ==========================================
// WAITING FOR SISTER
// ==========================================

function showWaitingForAnswer() {

  connectingScreen.style.display = "flex";

  connectingScreen.innerHTML = `

    <div class="connecting-content">

      <div class="connecting-avatar">
        📞
      </div>

      <h1>Waiting...</h1>

      <p>Your sister can join using this link.</p>

      <div
        style="
          margin-top:25px;
          padding:14px;
          background:#151515;
          border-radius:12px;
          word-break:break-all;
          font-size:13px;
          color:#aaa;
        "
      >
        ${window.location.origin}${window.location.pathname}?room=${roomId}
      </div>

      <button
        id="shareBtn"
        style="
          margin-top:20px;
          padding:14px 25px;
          border:0;
          border-radius:30px;
          background:#fff;
          color:#000;
          font-weight:600;
          cursor:pointer;
        "
      >
        Share Call Link
      </button>

    </div>

  `;


  document
    .getElementById("shareBtn")
    .addEventListener("click", async () => {

      const link =
        `${window.location.origin}${window.location.pathname}?room=${roomId}`;

      try {

        await navigator.clipboard.writeText(link);

        alert("Call link copied!");

      } catch {

        prompt(
          "Copy this call link:",
          link
        );

      }

    });

}


// ==========================================
// INCOMING CALL
// ==========================================

function showIncomingCall() {

  incomingScreen.style.display = "flex";

  incomingScreen.innerHTML = `

    <div class="incoming-content">

      <div class="caller-avatar">
        👤
      </div>

      <h1>Incoming Video Call</h1>

      <h2>Video Caller</h2>

      <p>is calling you...</p>

      <div class="ring-animation">
        📹
      </div>

      <div class="incoming-buttons">

        <button
          id="newDeclineBtn"
          class="decline-btn"
        >
          ✕
          <span>Decline</span>
        </button>

        <button
          id="newAcceptBtn"
          class="accept-btn"
        >
          ✓
          <span>Accept</span>
        </button>

      </div>

    </div>

  `;


  document
    .getElementById("newAcceptBtn")
    .addEventListener(
      "click",
      answerCall
    );


  document
    .getElementById("newDeclineBtn")
    .addEventListener(
      "click",
      declineCall
    );

}


// ==========================================
// ANSWER CALL
// ==========================================

async function answerCall() {

  try {

    incomingScreen.style.display = "none";

    connectingScreen.style.display = "flex";

    await startLocalCamera();


    const callDoc =
      doc(db, "calls", roomId);

    const callSnapshot =
      await getDoc(callDoc);


    if (!callSnapshot.exists()) {

      throw new Error(
        "Call room does not exist."
      );

    }


    const callData =
      callSnapshot.data();


    peerConnection =
      createPeerConnection();


    const offerCandidates =
      collection(
        callDoc,
        "offerCandidates"
      );


    const answerCandidates =
      collection(
        callDoc,
        "answerCandidates"
      );


    peerConnection.onicecandidate =
      async event => {

        if (event.candidate) {

          await addDoc(
            answerCandidates,
            event.candidate.toJSON()
          );

        }

      };


    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(
        callData.offer
      )
    );


    const answerDescription =
      await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
      answerDescription
    );


    await updateDoc(
      callDoc,
      {
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp
        }
      }
    );


    onSnapshot(
      offerCandidates,
      snapshot => {

        snapshot.docChanges().forEach(change => {

          if (change.type === "added") {

            const candidate =
              new RTCIceCandidate(
                change.doc.data()
              );

            peerConnection
              .addIceCandidate(candidate)
              .catch(console.error);

          }

        });

      }
    );


    connectingScreen.style.display = "none";

    callScreen.style.display = "block";

    startTimer();


  } catch (error) {

    console.error(error);

    connectingScreen.style.display = "none";

    incomingScreen.style.display = "flex";

    alert(
      "Unable to answer this call."
    );

  }

}


// ==========================================
// CREATE PEER CONNECTION
// ==========================================

function createPeerConnection() {

  const pc =
    new RTCPeerConnection(servers);


  remoteStream =
    new MediaStream();


  pc.ontrack = event => {

    event.streams[0]
      .getTracks()
      .forEach(track => {

        remoteStream.addTrack(track);

      });


    let remoteVideo =
      document.getElementById("remoteVideo");


    if (!remoteVideo) {

      remoteVideo =
        document.createElement("video");

      remoteVideo.id = "remoteVideo";

      remoteVideo.autoplay = true;

      remoteVideo.playsInline = true;

      remoteVideo.style.position = "absolute";

      remoteVideo.style.inset = "0";

      remoteVideo.style.width = "100%";

      remoteVideo.style.height = "100%";

      remoteVideo.style.objectFit = "cover";

      remoteVideo.style.zIndex = "1";

      document
        .querySelector(".remote-video")
        .prepend(remoteVideo);

    }


    remoteVideo.srcObject =
      remoteStream;

  };


  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => {

        pc.addTrack(
          track,
          localStream
        );

      });

  }


  return pc;

}


// ==========================================
// CAMERA + MICROPHONE
// ==========================================

async function startLocalCamera() {

  localStream =
    await navigator.mediaDevices.getUserMedia({

      video: {
        facingMode: "user"
      },

      audio: true

    });


  localCamera.srcObject =
    localStream;

}


// ==========================================
// TIMER
// ==========================================

function startTimer() {

  clearInterval(timerInterval);

  seconds = 0;

  timer.textContent = "00:00";


  timerInterval =
    setInterval(() => {

      seconds++;

      const minutes =
        Math.floor(seconds / 60);

      const secs =
        seconds % 60;


      timer.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0");

    }, 1000);

}


// ==========================================
// MUTE
// ==========================================

muteBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const tracks =
      localStream.getAudioTracks();

    tracks.forEach(track => {

      track.enabled =
        !track.enabled;

    });


    micMuted = !micMuted;

    muteBtn.textContent =
      micMuted ? "🔇" : "🎙️";

  }
);


// ==========================================
// CAMERA
// ==========================================

cameraBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const tracks =
      localStream.getVideoTracks();

    tracks.forEach(track => {

      track.enabled =
        !track.enabled;

    });


    cameraOff = !cameraOff;

    cameraBtn.textContent =
      cameraOff ? "📷" : "🎥";

  }
);


// ==========================================
// SPEAKER
// ==========================================

speakerBtn.addEventListener(
  "click",
  () => {

    speakerOn =
      !speakerOn;

    speakerBtn.textContent =
      speakerOn ? "🔊" : "🔇";


    const remoteVideo =
      document.getElementById("remoteVideo");

    if (remoteVideo) {

      remoteVideo.muted =
        !speakerOn;

    }

  }
);


// ==========================================
// DECLINE
// ==========================================

function declineCall() {

  if (peerConnection) {

    peerConnection.close();

  }


  window.location.href =
    window.location.pathname;

}


// ==========================================
// END CALL
// ==========================================

endBtn.addEventListener(
  "click",
  () => {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });

    }


    if (peerConnection) {

      peerConnection.close();

    }


    clearInterval(timerInterval);


    window.location.href =
      window.location.pathname;

  }
);


// ==========================================
// START
// ==========================================

startFirebase();
