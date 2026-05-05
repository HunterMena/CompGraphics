//---------------------------Texture---------------------------//
class Texture {
    constructor(gen) {
        this.handle = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.handle);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        var c = document.createElement('canvas'); c.width = c.height = 128;
        var ctx = c.getContext('2d');
        gen(ctx, 128, 128);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.generateMipmap(gl.TEXTURE_2D);
    }
}
//---------------------------Texture---------------------------//

//---------------------------Mesh (VAO per mesh)---------------------------//
class Mesh {
    constructor(vertices, normals, uvs, indices) {
        this.indexCount = indices.length;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this._setupAttrib(new Float32Array(vertices), 'coordinates',        3);
        this._setupAttrib(new Float32Array(normals),  'normal',             3);
        this._setupAttrib(new Float32Array(uvs),      'textureCoordinates', 2);
        var ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        gl.bindVertexArray(null);
    }

    // Create a VBO, upload data, and register the attribute pointer in the current VAO
    _setupAttrib(data, name, size) {
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(myWebGL.program, name);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    draw() {
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }
}
//---------------------------Mesh (VAO per mesh)---------------------------//

//---------------------------Material---------------------------//
class Material {
    constructor(texture, ambient, specular, shininess) {
        this.texture   = texture;
        this.ambient   = ambient   !== undefined ? ambient   : 0.25;
        this.specular  = specular  !== undefined ? specular  : 0.6;
        this.shininess = shininess !== undefined ? shininess : 24;
    }
}
//---------------------------Material---------------------------//

//---------------------------Entity---------------------------//
class Entity {
    constructor(opts) {
        this.name       = opts.name;
        this.type       = opts.type;
        this.mesh       = opts.mesh;
        this.material   = opts.material;
        this.position   = opts.position   || [0,0,0];
        this.scale      = opts.scale      || [1,1,1];
        this.rotationY  = opts.rotationY  || 0;
        this.rotationZ  = opts.rotationZ  || 0;
        this.solid      = opts.solid      || false;
        this.pickable   = opts.pickable   || false;
        this.isRequired = opts.isRequired || false;
        this.collected  = false;
    }

    modelMatrix() {
        var m = Mat4.identity();
        m = Mat4.translate(m, this.position[0], this.position[1], this.position[2]);
        m = Mat4.rotateY(m, this.rotationY);
        m = Mat4.rotateZ(m, this.rotationZ);
        m = Mat4.scale(m, this.scale[0], this.scale[1], this.scale[2]);
        return m;
    }

    aabb() {
        var h = [this.scale[0]*0.5, this.scale[1]*0.5, this.scale[2]*0.5];
        return {
            min: [this.position[0]-h[0], this.position[1]-h[1], this.position[2]-h[2]],
            max: [this.position[0]+h[0], this.position[1]+h[1], this.position[2]+h[2]],
        };
    }
}
//---------------------------Entity---------------------------//

//---------------------------Particles---------------------------//
function updateParticles(dt) {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.x < -24) p.x =  24;  if (p.x >  24) p.x = -24;
        if (p.y <   0) p.y = 3.0;  if (p.y > 3.2) p.y =   0;
        if (p.z < -32) p.z =  25;  if (p.z >  25) p.z = -32;
    }
}

function drawParticles(view) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dustMat.texture.handle);
    gl.uniform1i(myWebGL.u('uTexture'),    0);
    gl.uniform1f(myWebGL.u('ambientMat'),  1.2);
    gl.uniform1f(myWebGL.u('specularMat'), 0.0);
    gl.uniform1f(myWebGL.u('shininess'),   1.0);

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var s = p.size;
        var m = new Float32Array([
            view[0]*s, view[4]*s, view[8]*s,  0,
            view[1]*s, view[5]*s, view[9]*s,  0,
            view[2]*s, view[6]*s, view[10]*s, 0,
            p.x, p.y, p.z, 1,
        ]);
        gl.uniformMatrix4fv(myWebGL.u('uModel'), false, m);
        gl.uniform1f(myWebGL.u('uAlpha'), p.alpha);
        cubeMesh.draw();
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
}
//---------------------------Particles---------------------------//

//---------------------------Collision Detection---------------------------//
function playerCollides(pos, pad) {
    if (pad === undefined) pad = player.radius;
    var pyBot = pos[1] - 0.3;
    var pyTop = pos[1] + 1.8;
    for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        if (c === monster || (c === door && doorOpened)) continue;
        var a = c.aabb();
        if (pyTop <= a.min[1] || pyBot >= a.max[1]) continue;
        var cx = Math.max(a.min[0], Math.min(pos[0], a.max[0]));
        var cz = Math.max(a.min[2], Math.min(pos[2], a.max[2]));
        var dx = pos[0]-cx, dz = pos[2]-cz;
        if (dx*dx + dz*dz < pad*pad) return true;
    }
    return false;
}

function monsterHits(pos) {
    for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        if (c === monster || (c === door && doorOpened)) continue;
        var a = c.aabb();
        if (pos[0]>a.min[0]-0.85 && pos[0]<a.max[0]+0.85 &&
            pos[2]>a.min[2]-0.85 && pos[2]<a.max[2]+0.85 &&
            pos[1]>a.min[1]-0.8  && pos[1]<a.max[1]+0.8) return true;
    }
    return false;
}
//---------------------------Collision Detection---------------------------//

//---------------------------Movement---------------------------//
function movePlayer(dt) {
    if (input.arrowleft)  player.yaw += player.turnSpeed * dt;
    if (input.arrowright) player.yaw -= player.turnSpeed * dt;

    if (player.isGrounded && input[' ']) { player.velY = JUMP_VEL; player.isGrounded = false; }
    if (!player.isGrounded) {
        player.position[1] += player.velY * dt; player.velY -= GRAVITY * dt;
        if (player.position[1] <= GROUND_Y) {
            player.position[1] = GROUND_Y; player.isGrounded = true; player.velY = 0;
        }
    }

    var fwd = [Math.sin(player.yaw), 0,  Math.cos(player.yaw)];
    var rgt = [-Math.cos(player.yaw), 0, Math.sin(player.yaw)];
    var wish = [0, 0, 0];
    if (input.w) wish = Vec3.add(wish, fwd);
    if (input.s) wish = Vec3.sub(wish, fwd);
    if (input.a) wish = Vec3.sub(wish, rgt);
    if (input.d) wish = Vec3.add(wish, rgt);
    wish = Vec3.normalize(wish);

    var moving = input.w || input.s || input.a || input.d;
    if (moving && player.isGrounded) bobPhase += 12 * dt;

    var mv = Vec3.mul(wish, player.speed * dt);
    var nx = [player.position[0]+mv[0], player.position[1], player.position[2]];
    if (!playerCollides(nx)) player.position[0] = nx[0];
    var nz = [player.position[0], player.position[1], player.position[2]+mv[2]];
    if (!playerCollides(nz)) player.position[2] = nz[2];

    player.position[0] = Math.max(-25.3, Math.min(25.3, player.position[0]));
    player.position[2] = Math.max(-33.3, Math.min(38.0, player.position[2]));
}

function moveMonster(dt) {
    var toPlayer = Vec3.sub(player.position, monster.position);
    var dist = Vec3.length(toPlayer);
    var targetPos;

    if (dist > 16) {
        var wp = PATROL_WP[patrolIndex];
        var dx = wp[0]-monster.position[0], dz = wp[2]-monster.position[2];
        if (Math.hypot(dx, dz) < 1.5) patrolIndex = (patrolIndex+1) % PATROL_WP.length;
        targetPos = wp;
    } else {
        targetPos = player.position;
    }

    var td  = [targetPos[0]-monster.position[0], 0, targetPos[2]-monster.position[2]];
    var dir = Vec3.normalize(td);
    monster.rotationY = Math.atan2(dir[0], dir[2]);

    var speed = dist>16 ? 1.4 : dist>10 ? 2.4 : dist>5 ? 3.0 : 3.6;
    var step  = Vec3.mul(dir, speed * dt);
    var cand  = [monster.position[0]+step[0], monster.position[1], monster.position[2]+step[2]];

    if (!monsterHits(cand)) {
        monster.position[0] = cand[0]; monster.position[2] = cand[2]; monsterStuckTime = 0;
    } else {
        monsterStuckTime += dt;
        if (monsterStuckTime > 1.2) { monsterSideBias = -monsterSideBias; monsterStuckTime = 0; }
        var angles = [0.5*monsterSideBias, -0.5*monsterSideBias, 1.05*monsterSideBias, -1.05*monsterSideBias, 1.57, -1.57];
        for (var i = 0; i < angles.length; i++) {
            var ang = angles[i];
            var c = Math.cos(ang), s = Math.sin(ang);
            var ad  = [dir[0]*c-dir[2]*s, 0, dir[0]*s+dir[2]*c];
            var alt = Vec3.add(monster.position, Vec3.mul(ad, speed*dt));
            alt[1]  = monster.position[1];
            if (!monsterHits(alt)) { monster.position[0]=alt[0]; monster.position[2]=alt[2]; break; }
        }
    }

    var cosY = Math.cos(monster.rotationY), sinY = Math.sin(monster.rotationY);
    var ARM_SIDE = 1.35;
    monsterArmL.position[0] = monster.position[0] - cosY * ARM_SIDE;
    monsterArmL.position[1] = monster.position[1] + 0.35;
    monsterArmL.position[2] = monster.position[2] + sinY * ARM_SIDE;
    monsterArmR.position[0] = monster.position[0] + cosY * ARM_SIDE;
    monsterArmR.position[1] = monster.position[1] + 0.35;
    monsterArmR.position[2] = monster.position[2] - sinY * ARM_SIDE;
    monsterArmL.rotationY   = monster.rotationY;
    monsterArmR.rotationY   = monster.rotationY;

    if (dist < 1.4 && !gameOver && !victory) {
        gameOver  = true;
        finalTime = (performance.now() - startTime) / 1000;
        gameOverTimeEl.textContent = 'Time survived: ' + finalTime.toFixed(1) + 's';
        gameOverOverlay.classList.add('visible');
        document.exitPointerLock();
    }
}
//---------------------------Movement---------------------------//

//---------------------------HUD---------------------------//
function updateListUI() {
    hudList.innerHTML = '';
    var required = entities.filter(function(e) { return e.pickable && e.isRequired; });
    var decoys   = entities.filter(function(e) { return e.pickable && !e.isRequired && e.collected; });
    for (var i = 0; i < required.length; i++) {
        var li = document.createElement('li');
        li.textContent = required[i].name;
        if (required[i].collected) li.classList.add('done');
        hudList.appendChild(li);
    }
    if (decoys.length > 0) {
        var hdr = document.createElement('li');
        hdr.textContent = 'Extra (not needed):';
        hdr.style.cssText = 'margin-top:8px;font-size:0.72em;color:#777;list-style:none;border-top:1px solid #333;padding-top:5px;';
        hudList.appendChild(hdr);
        for (var j = 0; j < decoys.length; j++) {
            var dl = document.createElement('li');
            dl.textContent = decoys[j].name;
            dl.style.cssText = 'color:#666;font-size:0.8em;text-decoration:line-through;';
            hudList.appendChild(dl);
        }
    }
}

function setStatus(t) { statusLabel.textContent = t; }

function allItemsCollected() {
    return entities.filter(function(e) { return e.pickable && e.isRequired; }).every(function(e) { return e.collected; });
}
//---------------------------HUD---------------------------//

//---------------------------Pickup---------------------------//
var pickupNotifTimer = 0;

function getNearbyItem(range) {
    if (range === undefined) range = 3.5;
    var fwd = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
    var best = null, bestDist = range;
    for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (!e.pickable || e.collected) continue;
        var dx = e.position[0]-player.position[0], dz = e.position[2]-player.position[2];
        var d  = Math.hypot(dx, dz);
        if (d < bestDist) {
            var dot = (dx/d)*fwd[0] + (dz/d)*fwd[2];
            if (dot > 0.2) { bestDist = d; best = e; }
        }
    }
    return best;
}

function showPickupNotif(name) {
    pickupNotifEl.textContent = '+ ' + name;
    pickupNotifEl.classList.add('visible');
    pickupNotifTimer = 1.6;
}

function handlePickup() {
    if (gameOver || victory || !gameStarted) return;
    var best = getNearbyItem(3.5);
    if (best) {
        best.collected = true; updateListUI(); showPickupNotif(best.name);
        if (best.isRequired) setStatus(allItemsCollected() ? 'All items found! Get to the exit.' : '');
    }
}
//---------------------------Pickup---------------------------//

//---------------------------Events---------------------------//
function updateEvents(nowMs) {
    var now = nowMs/1000, px = player.position[0], pz = player.position[2];
    if (Math.abs(px)<2.5 && Math.abs(pz)<2.5 && !scareCenter) {
        scareCenter=true; flickerUntil=now+4.5; setStatus('Lights flicker... something is hunting you.');
    }
    if (pz>5 && pz<8 && !scareCrossAisle) {
        scareCrossAisle=true; flickerUntil=now+3.5; setStatus('A shadow darts across the aisle...');
    }
    if (pz<-26 && !scareStorage) {
        scareStorage=true; flickerUntil=now+5.0; setStatus('The storage room plunges into darkness...');
    }
    if (allItemsCollected() && !doorOpened) {
        doorOpened=true; doorOpening=true;
        door.solid=false;
        var idx=colliders.indexOf(door); if (idx>=0) colliders.splice(idx,1);
        setStatus('');
        escapeMsgEl.classList.add('visible');
    }
    if (doorOpened && pz>30.0 && Math.abs(px)<2.5 && !victory) {
        victory=true;
        finalTime=(nowMs-startTime)/1000;
        escapeMsgEl.classList.remove('visible');
        victoryTimeEl.textContent = 'Time survived: ' + finalTime.toFixed(1) + 's';
        victoryOverlay.classList.add('visible');
        document.exitPointerLock();
    }
}

function worldFlicker(nowMs) {
    var t = nowMs / 1000;
    return t < flickerUntil ? 0.35 + 0.65*Math.abs(Math.sin(t*19.0)) : 1.0;
}

function updateVignette() {
    var dx   = player.position[0] - monster.position[0];
    var dz   = player.position[2] - monster.position[2];
    var dist  = Math.hypot(dx, dz);
    var alpha = dist < 9 ? Math.min(0.55, (9-dist)/(9-1.5)*0.55) : 0;
    vignetteEl.style.boxShadow = alpha > 0.005 ? 'inset 0 0 80px rgba(180,0,0,' + alpha.toFixed(3) + ')' : '';
}

function checkPickupPrompt() {
    if (gameOver || victory || !gameStarted) { pickupPromptEl.textContent = ''; return; }
    var best = getNearbyItem(3.5);
    pickupPromptEl.textContent = best ? '[E]  ' + best.name : '';
}

function resetGame() {
    player.position = [0, GROUND_Y, 22]; player.yaw = Math.PI; player.pitch = 0;
    player.velY = 0; player.isGrounded = true; player.flashlightOn = true;
    monster.position = [0, 1.0, -2];
    gameOver=false; victory=false; finalTime=0;
    escapeMsgEl.classList.remove('visible');
    victoryOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');
    doorOpened=false; doorOpening=false; doorAngle=0;
    door.position[0]=0; door.position[1]=1.6; door.position[2]=25.3;
    door.rotationY=0; door.solid=true;
    if (!colliders.includes(door)) colliders.push(door);
    scareCenter=false; scareCrossAisle=false; scareStorage=false; flickerUntil=0;
    monsterStuckTime=0; monsterSideBias=1; patrolIndex=0; bobPhase=0;
    vignetteEl.style.boxShadow = '';
    startTime = performance.now();
    setStatus('Collect the full list. Stay away from the monster.');
    entities.filter(function(e) { return e.pickable; }).forEach(function(e) { e.collected = false; });
    updateListUI();
    if (gameStarted) instructionsOverlay.classList.remove('visible');
}
//---------------------------Events---------------------------//

//---------------------------Input---------------------------//
function setupInput() {
    document.addEventListener('keydown', function(e) {
        var k = e.key.toLowerCase();
        if (k in input) input[k] = true;
        if (k==='arrowleft' || k==='arrowright' || k===' ') e.preventDefault();
        if (k==='e') handlePickup();
        if (k==='f') { player.flashlightOn=!player.flashlightOn; setStatus(player.flashlightOn?'Flashlight ON':'Flashlight OFF'); }
        if (k==='r') resetGame();
    });
    document.addEventListener('keyup', function(e) {
        var k = e.key.toLowerCase();
        if (k in input) input[k] = false;
    });
    document.addEventListener('mousemove', function(e) {
        if (document.pointerLockElement !== canvas) return;
        player.yaw  -= e.movementX * 0.002;
        player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - e.movementY * 0.002));
    });
    canvas.addEventListener('click', function() { if (gameStarted) canvas.requestPointerLock(); });
    startBtn.addEventListener('click', function() {
        gameStarted=true; instructionsOverlay.classList.remove('visible'); canvas.requestPointerLock();
    });
    playAgainBtn.addEventListener('click', function() { resetGame(); canvas.requestPointerLock(); });
    document.getElementById('restartBtn').addEventListener('click', function() { resetGame(); canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', function() {
        if (document.pointerLockElement===canvas && !gameOver && !victory)
            instructionsOverlay.classList.remove('visible');
    });
}
//---------------------------Input---------------------------//
