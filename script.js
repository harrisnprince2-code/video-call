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


// ======================================================
// FIREBASE
// ======================================================

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


// ======================================================
// HTML ELEMENTS
// ======================================================

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


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let roomId = null;

let seconds = 0;

let timerInterval = null;

let micMuted = false;

let cameraOff = false;

let speakerOn = true;


// ======================================================
// WEBRTC SERVERS
// ======================================================
//
// These are public STUN servers.
// They help the two devices discover a direct
// connection.
//
// TURN can be added later if a particular network
// blocks direct WebRTC connections.
//

const rtcConfiguration = {
 iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "89c30c6a909f9999d5461524",
        credential: "dD1yf75007OM26AE",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "89c30c6a909f9999d5461524",
        credential: "dD1yf75007OM26AE",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "89c30c6a909f9999d5461524",
        credential: "dD1yf75007OM26AE",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "89c30c6a909f9999d5461524",
        credential: "dD1yf75007OM26AE",
      },
  ],
});

// ======================================================
// START FIREBASE
// ======================================================

async function startFirebase() {

  try {

    await signInAnonymously(auth);

    console.log("Firebase anonymous authentication successful.");

    checkRoom();

  } catch (error) {

    console.error("Firebase authentication failed:", error);

    alert(
      "Unable to connect to the call server. Please refresh the page."
    );

  }

}


// ======================================================
// CHECK URL FOR ROOM
// ======================================================

function checkRoom() {

  const params =
    new URLSearchParams(window.location.search);

  roomId = params.get("room");


  if (roomId) {

    console.log("Incoming call room:", roomId);

    showIncomingCall();

  } else {

    console.log("No room. Showing caller screen.");

    showCallerScreen();

  }

}


// ======================================================
// CALLER SCREEN
// ======================================================

function showCallerScreen() {

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
          color:#000000;
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
    .addEventListener(
      "click",
      createCall
    );

}


// ======================================================
// CREATE CALL
// ======================================================

async function createCall() {

  try {

    console.log("Creating call...");

    incomingScreen.style.display = "none";

    connectingScreen.style.display = "flex";

    connectingScreen.innerHTML = `

      <div class="connecting-content">

        <div class="connecting-avatar">
          📞
        </div>

        <h1>Starting Call...</h1>

        <p>Please allow camera and microphone access.</p>

        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>

      </div>

    `;


    await startLocalMedia();


    // Create Firestore call document
    const callRef =
      doc(collection(db, "calls"));

    roomId = callRef.id;


    console.log("Room created:", roomId);


    // Create WebRTC connection
    peerConnection =
      createPeerConnection();


    // Candidate collection for caller
    const offerCandidates =
      collection(
        callRef,
        "offerCandidates"
      );


    // Candidate collection for receiver
    const answerCandidates =
      collection(
        callRef,
        "answerCandidates"
      );


    // --------------------------------------------------
    // SEND CALLER ICE CANDIDATES
    // --------------------------------------------------

    peerConnection.onicecandidate =
      async event => {

        if (!event.candidate) {

          console.log(
            "Caller ICE gathering complete."
          );

          return;

        }


        try {

          await addDoc(
            offerCandidates,
            event.candidate.toJSON()
          );

          console.log(
            "Caller ICE candidate saved."
          );

        } catch (error) {

          console.error(
            "Error saving caller ICE candidate:",
            error
          );

        }

      };


    // --------------------------------------------------
    // CREATE OFFER
    // --------------------------------------------------

    const offer =
      await peerConnection.createOffer({

        offerToReceiveAudio: true,

        offerToReceiveVideo: true

      });


    await peerConnection.setLocalDescription(
      offer
    );


    console.log(
      "Caller local description created."
    );


    // --------------------------------------------------
    // SAVE OFFER TO FIRESTORE
    // --------------------------------------------------

    await setDoc(
      callRef,
      {

        offer: {

          type: offer.type,

          sdp: offer.sdp

        },

        status: "waiting",

        createdAt: Date.now()

      }
    );


    console.log(
      "Offer saved to Firestore."
    );


    // --------------------------------------------------
    // SHOW SHARE SCREEN
    // --------------------------------------------------

    showWaitingScreen();


    // --------------------------------------------------
    // LISTEN FOR ANSWER
    // --------------------------------------------------

    onSnapshot(
      callRef,
      async snapshot => {

        const data =
          snapshot.data();


        if (!data) return;


        console.log(
          "Call document updated:",
          data.status
        );


        if (
          data.answer &&
          !peerConnection.currentRemoteDescription
        ) {

          console.log(
            "Answer received!"
          );


          const answer =
            new RTCSessionDescription(
              data.answer
            );


          await peerConnection.setRemoteDescription(
            answer
          );


          console.log(
            "Remote answer applied."
          );

        }

      }
    );


    // --------------------------------------------------
    // LISTEN FOR ANSWER ICE CANDIDATES
    // --------------------------------------------------

    onSnapshot(
      answerCandidates,
      snapshot => {

        snapshot.docChanges().forEach(
          async change => {

            if (
              change.type !== "added"
            ) {

              return;

            }


            const candidate =
              change.doc.data();


            console.log(
              "Received receiver ICE candidate."
            );


            try {

              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
              );

            } catch (error) {

              console.error(
                "Could not add receiver ICE candidate:",
                error
              );

            }

          }
        );

      }
    );


  } catch (error) {

    console.error(
      "CALL CREATION ERROR:",
      error
    );


    connectingScreen.style.display = "none";

    incomingScreen.style.display = "flex";


    alert(
      "Could not create the call. Check your camera, microphone and Firebase connection."
    );

  }

}


// ======================================================
// WAITING SCREEN
// ======================================================

function showWaitingScreen() {

  connectingScreen.style.display = "flex";


  const link =
    `${window.location.origin}${window.location.pathname}?room=${roomId}`;


  connectingScreen.innerHTML = `

    <div class="connecting-content">

      <div class="connecting-avatar">
        📞
      </div>

      <h1>Waiting...</h1>

      <p>
        Send this link to the person you want to call.
      </p>

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
        ${link}
      </div>

      <button
        id="shareCallBtn"
        style="
          margin-top:20px;
          padding:14px 25px;
          border:0;
          border-radius:30px;
          background:#ffffff;
          color:#000000;
          font-weight:600;
          cursor:pointer;
        "
      >
        Share Call Link
      </button>

    </div>

  `;


  document
    .getElementById("shareCallBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          if (navigator.share) {

            await navigator.share({

              title: "Video Call",

              text: "Join my video call",

              url: link

            });

          } else {

            await navigator.clipboard.writeText(
              link
            );

            alert(
              "Call link copied!"
            );

          }

        } catch (error) {

          console.log(
            "Share cancelled."
          );

        }

      }
    );

}


// ======================================================
// INCOMING CALL SCREEN
// ======================================================

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
          id="declineIncomingBtn"
          class="decline-btn"
        >

          ✕

          <span>
            Decline
          </span>

        </button>


        <button
          id="acceptIncomingBtn"
          class="accept-btn"
        >

          ✓

          <span>
            Accept
          </span>

        </button>

      </div>

    </div>

  `;


  document
    .getElementById("acceptIncomingBtn")
    .addEventListener(
      "click",
      answerCall
    );


  document
    .getElementById("declineIncomingBtn")
    .addEventListener(
      "click",
      declineCall
    );

}


// ======================================================
// ANSWER CALL
// ======================================================

async function answerCall() {

  try {

    console.log(
      "Answering room:",
      roomId
    );


    incomingScreen.style.display = "none";

    connectingScreen.style.display = "flex";


    connectingScreen.innerHTML = `

      <div class="connecting-content">

        <div class="connecting-avatar">
          📹
        </div>

        <h1>Connecting...</h1>

        <p>
          Connecting your camera and microphone.
        </p>

        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>

      </div>

    `;


    // --------------------------------------------------
    // GET CAMERA + MICROPHONE
    // --------------------------------------------------

    await startLocalMedia();


    // --------------------------------------------------
    // GET CALL DOCUMENT
    // --------------------------------------------------

    const callRef =
      doc(
        db,
        "calls",
        roomId
      );


    const callSnapshot =
      await getDoc(callRef);


    if (!callSnapshot.exists()) {

      throw new Error(
        "This call room does not exist."
      );

    }


    const callData =
      callSnapshot.data();


    if (!callData.offer) {

      throw new Error(
        "The caller offer is missing."
      );

    }


    // --------------------------------------------------
    // CREATE PEER CONNECTION
    // --------------------------------------------------

    peerConnection =
      createPeerConnection();


    // --------------------------------------------------
    // FIRESTORE CANDIDATES
    // --------------------------------------------------

    const offerCandidates =
      collection(
        callRef,
        "offerCandidates"
      );


    const answerCandidates =
      collection(
        callRef,
        "answerCandidates"
      );


    // --------------------------------------------------
    // SEND RECEIVER ICE CANDIDATES
    // --------------------------------------------------

    peerConnection.onicecandidate =
      async event => {

        if (!event.candidate) {

          console.log(
            "Receiver ICE gathering complete."
          );

          return;

        }


        try {

          await addDoc(
            answerCandidates,
            event.candidate.toJSON()
          );

          console.log(
            "Receiver ICE candidate saved."
          );

        } catch (error) {

          console.error(
            "Error saving receiver candidate:",
            error
          );

        }

      };


    // --------------------------------------------------
    // APPLY CALLER OFFER
    // --------------------------------------------------

    await peerConnection.setRemoteDescription(

      new RTCSessionDescription(
        callData.offer
      )

    );


    console.log(
      "Caller offer applied."
    );


    // --------------------------------------------------
    // CREATE ANSWER
    // --------------------------------------------------

    const answer =
      await peerConnection.createAnswer({

        offerToReceiveAudio: true,

        offerToReceiveVideo: true

      });


    await peerConnection.setLocalDescription(
      answer
    );


    console.log(
      "Receiver answer created."
    );


    // --------------------------------------------------
    // SAVE ANSWER
    // --------------------------------------------------

    await updateDoc(
      callRef,
      {

        answer: {

          type: answer.type,

          sdp: answer.sdp

        },

        status: "answered"

      }
    );


    console.log(
      "Answer saved to Firestore."
    );


    // --------------------------------------------------
    // LISTEN FOR CALLER ICE
    // --------------------------------------------------

    onSnapshot(
      offerCandidates,
      snapshot => {

        snapshot.docChanges().forEach(
          async change => {

            if (
              change.type !== "added"
            ) {

              return;

            }


            const candidate =
              change.doc.data();


            console.log(
              "Received caller ICE candidate."
            );


            try {

              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
              );

            } catch (error) {

              console.error(
                "Could not add caller ICE candidate:",
                error
              );

            }

          }
        );

      }
    );


  } catch (error) {

    console.error(
      "ANSWER CALL ERROR:",
      error
    );


    if (localStream) {

      localStream
        .getTracks()
        .forEach(track => {
          track.stop();
        });

    }


    connectingScreen.style.display = "none";

    incomingScreen.style.display = "flex";


    alert(
      "Unable to answer this call. Please try again."
    );

  }

}


// ======================================================
// CREATE WEBRTC PEER CONNECTION
// ======================================================

function createPeerConnection() {

  const pc =
    new RTCPeerConnection(
      rtcConfiguration
    );


  // ----------------------------------------------------
  // REMOTE STREAM
  // ----------------------------------------------------

  remoteStream =
    new MediaStream();


  pc.ontrack = event => {

    console.log(
      "Remote track received."
    );


    event.streams[0]
      .getTracks()
      .forEach(track => {

        remoteStream.addTrack(
          track
        );

      });


    showRemoteVideo();

  };


  // ----------------------------------------------------
  // CONNECTION STATE
  // ----------------------------------------------------

  pc.onconnectionstatechange = () => {

    console.log(
      "Connection state:",
      pc.connectionState
    );


    if (
      pc.connectionState === "connected"
    ) {

      console.log(
        "VIDEO CALL CONNECTED!"
      );


      connectingScreen.style.display =
        "none";

      callScreen.style.display =
        "block";


      startTimer();

    }


    if (
      pc.connectionState === "failed"
    ) {

      console.error(
        "WebRTC connection failed."
      );


      alert(
        "The devices could not establish a direct video connection. We may need to add a TURN server."
      );

    }


    if (
      pc.connectionState === "disconnected"
    ) {

      console.log(
        "WebRTC disconnected."
      );

    }

  };


  // ----------------------------------------------------
  // ICE CONNECTION STATE
  // ----------------------------------------------------

 pc.oniceconnectionstatechange = async () => {
  console.log("ICE state:", pc.iceConnectionState);

  try {
    const stats = await pc.getStats();

    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        console.log("✅ Successful ICE candidate pair:", report);

        if (report.localCandidateId) {
          const localCandidate = stats.get(report.localCandidateId);

          if (localCandidate) {
            console.log(
              "🌐 Local candidate type:",
              localCandidate.candidateType
            );
          }
        }

        if (report.remoteCandidateId) {
          const remoteCandidate = stats.get(report.remoteCandidateId);

          if (remoteCandidate) {
            console.log(
              "🌐 Remote candidate type:",
              remoteCandidate.candidateType
            );
          }
        }
      }
    });
  } catch (error) {
    console.error("Could not read WebRTC stats:", error);
  }
};


  // ----------------------------------------------------
  // ADD LOCAL TRACKS
  // ----------------------------------------------------

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


// ======================================================
// SHOW REMOTE VIDEO
// ======================================================

function showRemoteVideo() {

  let remoteVideo =
    document.getElementById(
      "remoteVideo"
    );


  if (!remoteVideo) {

    remoteVideo =
      document.createElement(
        "video"
      );


    remoteVideo.id =
      "remoteVideo";


    remoteVideo.autoplay =
      true;


    remoteVideo.playsInline =
      true;


    remoteVideo.setAttribute(
      "playsinline",
      ""
    );


    remoteVideo.style.position =
      "absolute";


    remoteVideo.style.inset =
      "0";


    remoteVideo.style.width =
      "100%";


    remoteVideo.style.height =
      "100%";


    remoteVideo.style.objectFit =
      "cover";


    remoteVideo.style.zIndex =
      "1";


    const remoteContainer =
      document.querySelector(
        ".remote-video"
      );


    remoteContainer.prepend(
      remoteVideo
    );

  }


  remoteVideo.srcObject =
    remoteStream;


  remoteVideo.muted =
    !speakerOn;


  remoteVideo.play()
    .catch(error => {

      console.log(
        "Remote video play waiting for user interaction:",
        error
      );

    });

}


// ======================================================
// LOCAL CAMERA + MICROPHONE
// ======================================================

async function startLocalMedia() {

  console.log(
    "Requesting camera and microphone..."
  );


  localStream =
    await navigator.mediaDevices.getUserMedia({

      video: {

        width: {
          ideal: 1280
        },

        height: {
          ideal: 720
        },

        facingMode: "user"

      },

      audio: {

        echoCancellation: true,

        noiseSuppression: true,

        autoGainControl: true

      }

    });


  localCamera.srcObject =
    localStream;


  console.log(
    "Camera and microphone ready."
  );

}


// ======================================================
// TIMER
// ======================================================

function startTimer() {

  clearInterval(
    timerInterval
  );


  seconds = 0;

  timer.textContent =
    "00:00";


  timerInterval =
    setInterval(() => {

      seconds++;


      const minutes =
        Math.floor(
          seconds / 60
        );


      const secs =
        seconds % 60;


      timer.textContent =
        String(minutes).padStart(
          2,
          "0"
        )
        +
        ":"
        +
        String(secs).padStart(
          2,
          "0"
        );


    }, 1000);

}


// ======================================================
// MUTE
// ======================================================

muteBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;


    const audioTracks =
      localStream.getAudioTracks();


    audioTracks.forEach(
      track => {

        track.enabled =
          !track.enabled;

      }
    );


    micMuted =
      !micMuted;


    muteBtn.textContent =
      micMuted
        ? "🔇"
        : "🎙️";

  }
);


// ======================================================
// CAMERA
// ======================================================

cameraBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;


    const videoTracks =
      localStream.getVideoTracks();


    videoTracks.forEach(
      track => {

        track.enabled =
          !track.enabled;

      }
    );


    cameraOff =
      !cameraOff;


    cameraBtn.textContent =
      cameraOff
        ? "📷"
        : "🎥";

  }
);


// ======================================================
// SPEAKER
// ======================================================

speakerBtn.addEventListener(
  "click",
  () => {

    speakerOn =
      !speakerOn;


    speakerBtn.textContent =
      speakerOn
        ? "🔊"
        : "🔇";


    const remoteVideo =
      document.getElementById(
        "remoteVideo"
      );


    if (remoteVideo) {

      remoteVideo.muted =
        !speakerOn;

    }

  }
);


// ======================================================
// DECLINE CALL
// ======================================================

function declineCall() {

  if (peerConnection) {

    peerConnection.close();

    peerConnection =
      null;

  }


  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    localStream =
      null;

  }


  window.location.href =
    window.location.pathname;

}


// ======================================================
// END CALL
// ======================================================

endBtn.addEventListener(
  "click",
  () => {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });

      localStream =
        null;

    }


    if (peerConnection) {

      peerConnection.close();

      peerConnection =
        null;

    }


    clearInterval(
      timerInterval
    );


    window.location.href =
      window.location.pathname;

  }
);


// ======================================================
// START APPLICATION
// ======================================================

startFirebase();
