//Variables to tweek

var gravity = [0 , -10];

var fps = 64;
var tickrate = 20;


//Important code (NO TOUHCHY)
fps = 1000/fps;
tickrate = 1000/tickrate;


//Physics
var p2 = require('p2');

var world = new p2.World({
    gravity: gravity
});

world.sleepMode = p2.World.ISLAND_SLEEPING;
world.islandSplit = false;

var room = new p2.Body();
for(var i = 0; i < 4; ++i) {
    var planeShape = new p2.Plane();
    var angle = (i * Math.PI)/2;
    room.addShape(planeShape, [16*Math.sin(angle), -9*Math.cos(angle)], angle);
}
world.addBody(room);

var boxes = [];
for(var i = 0; i < 5; ++i) {
    var boxShape = new p2.Box({ width: 4, height: 2 });
    boxes[i] = new p2.Body({
        mass: 1,
        position: [-(i-2)*3, 7],
        angularVelocity: 0,
        angle: 0
    });
    boxes[i].addShape(boxShape);
    world.addBody(boxes[i]);
}

setInterval(function() {
    for(i in boxes)
        if(i != 2)
            boxes[i].angularVelocity = (i-2);

    world.step(fps/1000);
}, fps);

//Express and WebSocket Server
var socketserver = require("child_process").fork("./server", [tickrate]);

var last_step = {};

setInterval(function() {
    var world_data = {
        room: [],
        boxes: []
    };

    if(world.gravity != last_step.gravity) {
        world_data.gravity = world.gravity;
    }

    if(world.sleepMode != last_step.sleepMode) {
        world_data.sleepMode = world.sleepMode;
    }

    for(var i in boxes) {
        if(boxes[i].sleepState != p2.Body.SLEEPING) {
            world_data.boxes[i] = {};
            world_data.boxes[i].position = boxes[i].position;
            world_data.boxes[i].angle = boxes[i].angle;
            world_data.boxes[i].velocity = boxes[i].velocity;
            world_data.boxes[i].angularVelocity = boxes[i].angularVelocity;
        }
    }

    for(var i in room.shapes) {
        if(room.sleepState != p2.Body.SLEEPING) {
            world_data.room[i] = {};
            world_data.room[i].position = room.shapes[i].position;
            world_data.room[i].angle = room.shapes[i].angle;
        }
    }
    
    socketserver.send(world_data);

    last_step = world_data;
}, tickrate);

var mice = {};
var constraints = {};

socketserver.on('message', function(data){
    if(data.msg == 'init') {
        mice[data.socket] = new p2.Body();
        world.addBody(mice[data.socket]);
    }

    if(data.msg == 'pdown') {
        world.removeConstraint(constraints[data.socket]);
        delete constraints[data.socket];
        
        mice[data.socket].position = data.pos;

        var hitBodies = world.hitTest(data.pos, boxes);

        if(hitBodies.length) {
            constraints[data.socket] = new p2.RevoluteConstraint(mice[data.socket], hitBodies[0], {
                worldPivot: mice[data.socket].position,
                collideConnected: false
            });
            world.addConstraint(constraints[data.socket]);
        }
    }

    if(data.msg == 'pmove') {
        mice[data.socket].position = data.pos;
    }

    if(data.msg == 'pup') {
        world.removeConstraint(constraints[data.socket]);
        delete constraints[data.socket];
    }

    if(data.msg == 'disc') {
        world.removeConstraint(constraints[data.socket]);
        delete constraints[data.socket];
        world.removeBody(mice[data.socket]);
        delete mice[data.socket];
    }
});
