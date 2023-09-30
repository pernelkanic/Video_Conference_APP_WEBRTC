const express = require('express');
const http = require('http');
const{v4: uuidv4} =require('uuid');
const cors = require('cors');
const twilio = require('twilio');
const { log } = require('console');
const { connected } = require('process');

const PORT = process.env.PORT || 5002;
const app =express();
const server =  http.createServer(app);
app.use(cors());
let connectedUser=[]
let rooms=[];
const io = require('socket.io')(server, {
    cors:{
        origin:'*',
        methods:['GET' ,'POST']
    }
});

io.on('connect', (socket) => {
    console.log(`user connected ${socket.id}`);

    socket.on("create-new-room", (data) => {
        createNewRoomHandler(data,socket);
        // Handle room creation logic here
    });
    socket.on("join-room", (data) => {
        joinRoomhandler(data,socket);
        // Handle room creation logic here
    });
    socket.on("disconnect", () => {
        leaveRoomhandler(socket);
        // Handle room leave logic here
    });
    socket.on('conn-signal' ,(data)=>{
        signalingHandler(data, socket);
    })
    socket.on('conn-init' ,(data)=>{
        initializeConnectionHandler(data, socket);
    })

    
});

const createNewRoomHandler=(data,socket)=>{
    console.log("host is creating new room");
        console.log(data);
        const{identity} = data;
        const roomId = uuidv4();

        const newUser = {
            identity,
            id:uuidv4(),
            socketId:socket.id,
            roomId
        }
        
        connectedUser=[...connectedUser , newUser];
        const newRoom={
            id:roomId,
            connectedUser:[newUser]
        }
        socket.join(roomId);
        rooms = [...rooms,newRoom];
        socket.emit("room-id",{roomId});
        
        socket.emit("room-update" ,{connectedUser:newRoom.connectedUser});
}
const joinRoomhandler = (data, socket) => {
    const { roomId,identity} = data;
    const newUser = {
        identity,
        id: uuidv4(),
        socketId: socket.id,
        roomId
    }

    const room = rooms.find((room)=>room.id === roomId);

    if (room) {
        connectedUser = [...connectedUser, newUser];
        room.connectedUser = [...room.connectedUser , newUser];
        
        socket.join(roomId);
        room.connectedUser.forEach(user=>{
            if(user.socketId !== socket.id){
                const data={
                    connUserSocketId : socket.id
                }
                io.to(user.socketId).emit('conn-prepare' ,data);
            }
        })
        io.to(roomId).emit("room-update", {
            connectedUser: room.connectedUser
        });
    } else {
        console.log('room was not found')
    }
}

const leaveRoomhandler=(socket)=>{
    let user = connectedUser.find((user)=>user.socketId === socket.id);
    if(user){
        let room = rooms.find((room) => room.id === user.roomId);
       
        room.connectedUser = room.connectedUser.filter(user=>user.socketId!==socket.id)
        socket.leave(user.roomId)
        if(room.connectedUser.length > 0 ){
            io.to(room.id).emit("user-disconnected" , {socketId: socket.id});
            io.to(room.id).emit("room-update",{
                connectedUser:room.connectedUser
            })
     }
     else{
        rooms = rooms.filter((r)=>r.id !== room.id);
     }
    }

}
app.get('/api/room-exists/:roomId', (req,res)=>{
    const {roomId} = req.params;
    const room = rooms.find((room)=>room.id === roomId);
    if(room){
        if(room.connectedUser.length > 3){
            return res.send({roomExists:true , full:true});
        }
        else{
            return res.send({roomExists:true , full : false});
        }


    }
    else{
        return res.send({roomExists :false,full:false})
    }
})
const initializeConnectionHandler=(data , socket)=>{
    const{connUserSocketId} = data;
    const initData = {connUserSocketId :socket.id}
    io.to(connUserSocketId).emit("conn-init" , initData);
}
const signalingHandler=(data, socket)=>{
    const{connUserSocketId , signal } =data;
    const signalingData={signal , connUserSocketId:socket.id}
    io.to(connUserSocketId).emit("conn-signal" , signalingData);
}
server.listen(PORT , ()=>{
    console.log(`Server is listening on ${PORT}`);
})