var static = require('node-static');
var https = require('https');
var fs = require('fs');
var options = {
    key: fs.readFileSync('ssl/musecbt.key'),
    cert: fs.readFileSync('ssl/musecbt.crt')
}
var file = new(static.Server)('./public',{cache : 'no-cache'});
var app = https.createServer(options, function (req, res) {
  file.serve(req, res);
}).listen(443);


/*
roomCount(io.sockets.adapter.rooms[room]);

function roomCount(room){
var localCount = 0;
if (room) {
for (var id in room) {
localCount ++;
}
}
return localCount;
}
*/



function occupants(roomId) {
    var res = []
    var count = 0;
    ns = io.of("/");    // the default namespace is "/"

    if (ns) {
        for (var id in ns.connected) {
            if(roomId) {
                var index = ns.connected[id].rooms.indexOf(roomId);
                console.log('Room foo index: ', index);
		console.log('Rooms: ', ns.connected[id].rooms);
                if(index !== -1) {
                    //res.push(ns.connected[id]);
		    count++;
                }
            } else {
                //res.push(ns.connected[id]);
		// count++;
            }
        }
    }
    //return res;
    return count;
}


// var numClients;

var io = require('socket.io').listen(app);



io.sockets.on('connection', function (socket){

	function log(){
		var array = [">>> Message from server: "];
	  for (var i = 0; i < arguments.length; i++) {
	  	array.push(arguments[i]);
	  }
	    socket.emit('log', array);
	}

	socket.on('message', function (message, room) {
                console.log('Got message for room ' + room + ': ', message);
		log('Got message for room ' +room+' : ', message);
	    
    // For a real app, should be room only (not broadcast)
		//socket.broadcast.emit('message', message);
                socket.to(room).emit('message', message);
	});

	socket.on('create or join', function (room) {
		//var numClients = io.sockets.clients(room).length;
	        var numClients = occupants(room);

	        console.log("New connection.  Clients in room "+room+"= ", numClients);

		log('Room ' + room + ' has ' + numClients + ' client(s)');
		log('Request to create or join room', room);

		if (numClients == 0){
			socket.join(room);
		        //numClients++;
			socket.emit('created', room);
		        log('Room created: ', room);
		} else if (numClients == 1) {
			io.sockets.in(room).emit('join', room);
			socket.join(room);
		        //numClients++;
			socket.emit('joined', room);
		} else { // max two clients
			socket.emit('full', room);
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		//socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);

	});

      socket.on('disconnect', function(room) { 
	    console.log('Client disconnected from room: ', room);
/*
            // update room client membership count
            if (numClients[room] > 0) {    // do not decrement to a negative number
	      numClients[room]--;
            }
*/
            console.log('Room '+room+' membership: ', occupants(room));
	});

    
});

