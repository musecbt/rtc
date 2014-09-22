'use strict';

var isChannelReady;
var isInitiator = false;
var isStarted = false;
var hasAudio = false;
var hasVideo = false;
var localStream;
var pc;
var remoteStream;
var turnReady;


var pc_config = {'iceServers': [
    {'url': 'turn:test@54.218.114.170:3478?transport=tcp','credential':'musecbt'},
    {'url': 'stun:stun.l.google.com:19302'}
]};


/*
var pc_config = {'iceServers': [
    {'url': 'turn:test@blairkennedy.dlinkddns.com','credential':'test'},
    {'url': 'stun:stun.l.google.com:19302'}]};
*/

/*
var pc_config = {'iceServers': [
    {'url': 'turn:test@blairkennedy.dlinkddns.com:3487','credential':'test'}
]};
*/

var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};


/////////////////////////////////////////////

// find audio and video sources - this method only works in Chrome versions 30+

/*
function gotSources(sourceInfos) {
    for (var i=0; i != sourceInfos.length; i++) {
	var sourceInfo = sourceInfos[i];
	console.log(sourceInfo);
	if (sourceInfo.kind === 'audio') {
	    hasAudio = true;
	}
	if (sourceInfo.kind === 'video') {
	    hasVideo = true;
	}
    }
}

if (typeof MediaStreamTrack === 'undefined') {
    alert('Your browser is not compatible');
} else {
    MediaStreamTrack.getSources(gotSources);
}
*/



function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}




/////////////////////////////////////////////


// var room = location.pathname.substring(1);
var room = getQueryVariable('room');
console.log("Room from URL: ", room);
if (room === '' || room === null || typeof room === 'undefined' ) {
//  room = prompt('Enter room name:');
  room = 'hold';
  document.getElementById('notice').innerHTML = "<h2>ERROR: No room selected</h2>";
  // window.location = "http://www.google.com";
  stop();
  throw new Error('Aborting: no room provided.');
} else {
  //
}

var socket = io.connect();

if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join', room);
}

socket.on('created', function (room){
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
  displayWarning('- Busy - The call is full. Click <a onclick="rejoin();">here</a> to try and join the call.');

  stop();

  // terminate the socket if you are not allowed in the room. 
  //pc = null;
  //if (socket !== null && typeof socket !== 'undefined') {
  //  socket.disconnect();
  //  console.log("socket disconnected");
 // }

});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function (room){
  console.log('This peer has joined room ' + room);
  isChannelReady = true;
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

////////////////////////////////////////////////

socket.on('message', function (message){
  console.log('Client received message : ', message);
  if (message === 'got user media') {
  	maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    console.log("processing bye message");
    handleRemoteHangup();
  } else if (message === 'audio muted') {
    handleRemoteAudioMute();
  } else if (message === 'audio unmuted') {
    handleRemoteAudioUnMute();
  }
});


function sendMessage(message){
	console.log('Client sending message: ', message);
  // if (typeof message === 'object') {
  //   message = JSON.stringify(message);
  // }
  
  // socket.emit('message', message);
  socket.emit('message', message, room);
}

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
//var remoteVideo = null;


// define constraints for getUserMedia
var constraints = {audio: true, video: true};

function handleUserMedia(stream) {
  console.log('Adding local video stream.');
  hasVideo = true;
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}


function handleUserMediaError(error){
  console.log('getUserMedia error: ', error);
  if (!constraints['video']) {
      console.log('Unable to get video or audio');
      //sendMessage('got user media');
  } else {
      constraints['video'] = false;
      console.log('Cannot enable a camera stream...trying audio only');
      getUserMedia(constraints, handleUserMedia, handleUserMediaError);

      // disable the toggle video button
      document.getElementById("toggleVideo").disabled=true;
  }

}

getLocalMedia();

function getLocalMedia() {


  //console.log ("Create constraints variable: ", constraints);


  console.log("Trying contraints of: ", constraints);
  getUserMedia(constraints, handleUserMedia, handleUserMediaError);


  // enable audio
  //getUserMedia({audio: true}, handleUserMediaAudio, handleUserMediaAudioError);
} 


/*
if (location.hostname != "localhost") {
    console.log('Requesing a TURN server');
///requestTurn('https://computeengineondemand.appspot.com/turn?username=70969438&:key=4080218913');
  requestTurn('http://blairkennedy.dlinkddns.com:3478/turn?username=test&key=test');
}
*/

function maybeStart() {
  // only start if not already started, a local stream has been established as well as an open socket channel 
  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {

    createPeerConnection();
    if (typeof localStream != 'undefined') {
	pc.addStream(localStream);
    }
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function(e){
	// sendMessage('bye');
        // socket.disconnect();
    alert("Reloading, stoping call and disconnecting...");
    ///hangup();
    stop();
}


/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    //pc = new RTCPeerConnection(null);
    pc = new RTCPeerConnection(pc_config);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');

    console.log('ICE Connection State: ', pc.iceConnectionState);

    // setup listener for ice state change to detect dropped connections
    pc.oniceconnectionstatechange = function() {
      if (pc !== null) {
        console.log("New ICE connection state detected: ",pc.iceConnectionState);
      } else {
        console.log("null peer connection detected");
      }
      if (pc !== null && pc.iceConnectionState == 'disconnected') {
        console.log('Detected remote client disconnected');
	handleIceDisconnect();
      }
    }


  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }
}



function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}


function handleCreateOfferError(event){
  console.log('createOffer() error: ', e);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, errorAnswer, sdpConstraints);
}


function errorAnswer(error) {
    console.log('doAnswer Error: ', error);
}


function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message' , sessionDescription);
  sendMessage(sessionDescription);
}


/*
function requestTurn(turn_url) {
  var turnExists = false;
  console.log('Requsting TURN server: ');
  sendMessage('Requesting TURN server: ');
  for (var i in pc_config.iceServers) {
    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
      console.log('Found TURN server: ', pc_config.iceServers[i]);
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turn_url);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
      	console.log('Got TURN server: ', turnServer);
        pc_config.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      } else {
        console.log('Failed to get TURN server: ');
      };
    };
    xhr.open('GET', turn_url, true);
    xhr.send();
  }
}
*/



function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  //localVideo.style.display = "none";
  
  // create remoteVideo element
  //remoteVideo = document.createElement("video");
  //remoteVideo.setAttribute("id","remoteVideo");
  //remoteVideo.autoplay=true;
  //remoteVideo.setAttribute("class","videoFrame");
  //document.getElementById("videos").appendChild(remoteVideo);

  //remoteVideo.style.zIndex=-1;

  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;

  // resize localVideo
  //localVideo.style.width = "100px";
  //localVideo.style.position = "relative";

  //localVideo.style.top = "95px";
  //localVideo.style.left = "auto";
  
  // bring localVideo back after being hidden for resize
  //localVideo.style.display = "inline";
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  remoteVideo.src = "";
}


function handleRemoteAudioMute() {
  console.log("Remote audio has been muted.");
  // displayInfo("Remote audio has been muted.");
  document.getElementById("remoteMuteSignal").style.display = "inline";

}

function handleRemoteAudioUnMute() {
  console.log("Remote audio has been unmuted.");
  document.getElementById("remoteMuteSignal").style.display = "none";

}

function hangup() {
  console.log('Hanging up.');
  sendMessage('bye');
  stop();
  displayAlert('You ended the call. Click <a onclick="rejoin();">here</a> to rejoin the call.');

}

function handleRemoteHangup() {
  console.log('handling remote hangup.');
  stop();
  // isInitiator = false;
  isStarted = false;
  
  //pc.close();
  //pc = null;
  //maybeStart();
  displayAlert('Call ended by the other party. Click <a onclick="rejoin();">here</a> to rejoin the call.');
  
}


function handleIceDisconnect() {
  console.log('handling Ice disconnect');
  stop();
  isStarted = false;
  displayAlert('Lost contact with the other party.  Call is disconnected. Click <a onclick="rejoin();">here</a> to try to rejoin the call.');
}


function displayAlert(msg) {

  var notice = document.getElementById('notice');
  notice.className = notice.className + " alert alert-danger";
  notice.innerHTML=msg;

}

function displayWarning(msg) {
  var notice = document.getElementById('notice');
  notice.className = notice.className + " alert alert-warning";
  notice.innerHTML = msg;
}

function displayInfo(msg) {
  var notice = document.getElementById('notice');
  notice.className = notice.className + " alert alert-info";
  notice.innerHTML=msg;
  setTimeout(function() { 
    notice.innerHTML="";
    notice.className = "" }, 4000);

}


function stop() {

  console.log("processing stop");
  isStarted = false;
  // isAudioMuted = false;
  // isVideoMuted = false;


  // test for a valid peer connection before trying to close
  //document.getElementById("videos").style.display = "none";
  if (localVideo != null && typeof localStream != 'undefined') {

    console.log('Stopping local stream');
    // turn off the camera and microphone
    localStream.stop();
    localVideo.src="";
  }

  if (remoteVideo != null) {
    remoteVideo.src="";
    // document.getElementById("videos").removeChild(remoteVideo);
  }

  if (typeof(pc) != 'undefined' && pc !== null) {
    console.log('Closing peer connection');
    pc.close();
  }
  pc = null;
  if (socket !== null && typeof socket !== 'undefined') {
    socket.disconnect();
    console.log("socket disconnected");
  }


  // enable rejoin button
  // console.log("enabling the reJoin button");
  // document.getElementById("rejoinButton").style.display="block";

  // disable the button group
  document.getElementById("buttonGroup").style.display="none";

  //document.getElementById("rejoinButton").style.display="inline";

}


function rejoin() {

    location.reload(true);
}


function toggleAudio() {

    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
    console.log('Audio toggle button selected: ', localStream.getAudioTracks()[0]);
    var buttonId = document.querySelector('#toggleAudio');
    if (localStream.getAudioTracks()[0].enabled) {
        sendMessage("audio unmuted");
        buttonId.title = "Mute Microphone";
	buttonId.innerHTML = '<span class="fa fa-microphone-slash fa-3x"></span>';
    } else {
        sendMessage("audio muted")
        buttonId.title = "Unmute Microphone";
	buttonId.innerHTML = '<span class="fa fa-microphone fa-3x"></span>';
    }

}


function toggleVideo() {

    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
    console.log('Video toggle button selected: ', localStream.getVideoTracks()[0]);
    var buttonId = document.querySelector('#toggleVideo');
    if (localStream.getVideoTracks()[0].enabled) {
        buttonId.title = "Pause Video";
	buttonId.innerHTML = '<span class="fa fa-eye-slash fa-3x"></span>';
    } else {
        buttonId.title = "Resume Video";
	buttonId.innerHTML = '<span class="fa fa-eye fa-3x"></span>';
    }

}


///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

