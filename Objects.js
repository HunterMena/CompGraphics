//---------------------------Constants---------------------------//
var GRAVITY = 16, JUMP_VEL = 6.5, GROUND_Y = 1.0;

var PATROL_WP = [
    [0, 1.0, 18], [-5, 1.0, 6], [5, 1.0, 6],
    [-5, 1.0, -4], [5, 1.0, -4], [0, 1.0, -19],
];

var CEILING_LIGHTS = [
    { pos: [-5.0, 3.0,  15.0], color: [0.65, 0.95, 0.65], phase: 0.0 },
    { pos: [  0,  3.0,   0.0], color: [0.65, 0.95, 0.65], phase: 2.1 },
    { pos: [ 5.0, 3.0, -15.0], color: [0.65, 0.95, 0.65], phase: 4.4 },
];

var FLASHLIGHT_COLOR = [1.0, 0.88, 0.65];
//---------------------------Constants---------------------------//

//---------------------------Geometry---------------------------//
function createCubeMesh() {
    var p = [
        -0.5,-0.5,0.5,  0.5,-0.5,0.5,  0.5,0.5,0.5,  -0.5,0.5,0.5,
         0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,  0.5,0.5,-0.5,
        -0.5,0.5,0.5,   0.5,0.5,0.5,   0.5,0.5,-0.5, -0.5,0.5,-0.5,
        -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
         0.5,-0.5,0.5,  0.5,-0.5,-0.5, 0.5,0.5,-0.5,  0.5,0.5,0.5,
        -0.5,-0.5,-0.5,-0.5,-0.5,0.5, -0.5,0.5,0.5,  -0.5,0.5,-0.5,
    ];
    var n = [
        0,0,1,  0,0,1,  0,0,1,  0,0,1,
        0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
        0,1,0,  0,1,0,  0,1,0,  0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
        1,0,0,  1,0,0,  1,0,0,  1,0,0,
        -1,0,0,-1,0,0,  -1,0,0, -1,0,0,
    ];
    var uv = [];
    for (var f = 0; f < 6; f++) uv = uv.concat([0,0, 1,0, 1,1, 0,1]);
    var idx = [];
    for (var i = 0; i < 6; i++) { var o=i*4; idx.push(o,o+1,o+2, o,o+2,o+3); }
    return new Mesh(p, n, uv, idx);
}

function createCylinderMesh() {
    var p=[], n=[], uv=[], idx=[], base=0;
    for (var i = 0; i < 10; i++) {
        var a0=(i/10)*Math.PI*2, a1=((i+1)/10)*Math.PI*2;
        var c0=Math.cos(a0), s0=Math.sin(a0), c1=Math.cos(a1), s1=Math.sin(a1);
        p.push(c0*0.5,-0.5,s0*0.5); n.push(c0,0,s0); uv.push(i/10,0);
        p.push(c1*0.5,-0.5,s1*0.5); n.push(c1,0,s1); uv.push((i+1)/10,0);
        p.push(c0*0.5, 0.5,s0*0.5); n.push(c0,0,s0); uv.push(i/10,1);
        p.push(c1*0.5, 0.5,s1*0.5); n.push(c1,0,s1); uv.push((i+1)/10,1);
        idx.push(base,base+1,base+2, base+1,base+3,base+2); base+=4;
        p.push(0,0.5,0); n.push(0,1,0); uv.push(0.5,0.5);
        p.push(c0*0.5,0.5,s0*0.5); n.push(0,1,0); uv.push((c0+1)*0.25,(s0+1)*0.25);
        p.push(c1*0.5,0.5,s1*0.5); n.push(0,1,0); uv.push((c1+1)*0.25,(s1+1)*0.25);
        idx.push(base,base+1,base+2); base+=3;
        p.push(0,-0.5,0); n.push(0,-1,0); uv.push(0.5,0.5);
        p.push(c0*0.5,-0.5,s0*0.5); n.push(0,-1,0); uv.push((c0+1)*0.25,(s0+1)*0.25);
        p.push(c1*0.5,-0.5,s1*0.5); n.push(0,-1,0); uv.push((c1+1)*0.25,(s1+1)*0.25);
        idx.push(base,base+2,base+1); base+=3;
    }
    return new Mesh(p, n, uv, idx);
}

var cubeMesh;
var cylinderMesh;
//---------------------------Geometry---------------------------//

//---------------------------Entity System---------------------------//
var entities  = [];
var colliders = [];

function addEntity(opts) {
    var e = new Entity(Object.assign({ mesh: cubeMesh }, opts));
    entities.push(e);
    if (e.solid) colliders.push(e);
    return e;
}
//---------------------------Entity System---------------------------//

//---------------------------Player State---------------------------//
var player = {
    position:[0,GROUND_Y,22], velocity:[0,0,0], yaw:Math.PI, pitch:0,
    radius:0.42, speed:5.5, turnSpeed:2.2, flashlightOn:true, velY:0, isGrounded:true,
};
//---------------------------Player State---------------------------//

//---------------------------Assets---------------------------//
var ASSET_KEYS = [
    'bandages','bread','canofsoup','cereal','coffee','meat','milk','soap',
    'sausage','flour','candy','chicken','butter','ketchup','mustard','cheese','cream','pasta','peas','icecream','venue',
];
var loadedImgs = {};

function makeItemTexture(name, bandColor) {
    return new Texture(function(ctx, w, h) {
        ctx.fillStyle='#e8e4d4'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,w,22);
        ctx.fillStyle=bandColor; ctx.fillRect(8,34,w-16,30);
        ctx.fillStyle='#111'; ctx.font='bold 12px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(name.toUpperCase(), w/2, 49);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        ctx.fillStyle='#bbb'; ctx.font='9px sans-serif';
        ctx.fillText('HAUNTED GROCERY', 10, 14);
    });
}

function imgTex(key) {
    return new Texture(function(ctx, w, h) { ctx.drawImage(loadedImgs[key], 0, 0, w, h); });
}

function itemMat(key, name, color) {
    return key && loadedImgs[key]
        ? new Material(imgTex(key), 0.35, 0.60, 32)
        : new Material(makeItemTexture(name, color), 0.30, 0.55, 28);
}
//---------------------------Assets---------------------------//

//---------------------------Scene Objects---------------------------//
var monster, monsterArmL, monsterArmR, door;
var textures, materials;
var dustMat, particles;

function buildScene() {
    cubeMesh     = createCubeMesh();
    cylinderMesh = createCylinderMesh();

    // Dust particles
    var dustTex = new Texture(function(ctx, w, h) {
        var grd = ctx.createRadialGradient(w/2,h/2,0, w/2,h/2,w/2);
        grd.addColorStop(0,   'rgba(210,200,190,1)');
        grd.addColorStop(0.6, 'rgba(200,190,180,0.6)');
        grd.addColorStop(1,   'rgba(190,180,170,0)');
        ctx.fillStyle = grd; ctx.fillRect(0,0,w,h);
    });
    dustMat  = new Material(dustTex, 1.2, 0.0, 1);
    particles = [];
    for (var i = 0; i < 200; i++) {
        particles.push({
            x:(Math.random()-0.5)*48, y:Math.random()*3.0,   z:Math.random()*58-32,
            vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.06, vz:(Math.random()-0.5)*0.35,
            alpha:0.22+Math.random()*0.28, size:0.12+Math.random()*0.13,
        });
    }

    // Textures
    textures = {
        floor: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#6f6f6f'; ctx.fillRect(0,0,w,h);
            for(var y=0;y<8;y++) for(var x=0;x<8;x++){
                ctx.fillStyle=(x+y)%2===0?'#878787':'#5d5d5d';
                ctx.fillRect(x*16,y*16,16,16);
            }
        }),
        shelf: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#8b633f'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle='#6b4729';
            for(var i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,i*10+(i%2?2:0));ctx.lineTo(w,i*10+6);ctx.stroke();}
        }),
        wall: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#55606c'; ctx.fillRect(0,0,w,h);
            for(var i=0;i<450;i++){var x=Math.random()*w,y=Math.random()*h,c=70+Math.random()*80;
                ctx.fillStyle='rgba('+c+','+c+','+c+',0.2)';ctx.fillRect(x,y,3,3);}
        }),
        concrete: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#6e6a60'; ctx.fillRect(0,0,w,h);
            for(var i=0;i<700;i++){var x=Math.random()*w,y=Math.random()*h,c=Math.floor(80+Math.random()*55);
                ctx.fillStyle='rgba('+c+','+(c-5)+','+(c-12)+',0.28)';ctx.fillRect(x,y,2+Math.random()*3,2+Math.random()*3);}
            ctx.strokeStyle='rgba(40,36,30,0.35)';ctx.lineWidth=1;
            for(var j=0;j<10;j++){ctx.beginPath();ctx.moveTo(Math.random()*w,Math.random()*h);ctx.lineTo(Math.random()*w,Math.random()*h);ctx.stroke();}
        }),
        freezer: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#cdd1ce'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle='#9aada3'; ctx.lineWidth=2; ctx.strokeRect(6,6,w-12,h-12);
            ctx.lineWidth=1; ctx.strokeRect(6,h*0.48,w-12,h*0.04);
            ctx.fillStyle='rgba(180,210,200,0.3)'; ctx.fillRect(10,10,w-20,h*0.44);
        }),
        monster: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#4f6f54'; ctx.fillRect(0,0,w,h);
            for(var i=0;i<160;i++){var x=Math.random()*w,y=Math.random()*h;
                ctx.fillStyle=i%3===0?'#a53333':'#38553f';ctx.fillRect(x,y,6,6);}
        }),
        checkout: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#353535'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#777';ctx.fillRect(0,h*0.35,w,10);ctx.fillRect(0,h*0.65,w,10);
        }),
        door: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#40472e'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#a8b377'; ctx.fillRect(w*0.75,h*0.45,10,10);
        }),
        ceiling: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#383838'; ctx.fillRect(0,0,w,h);
            for(var i=0;i<220;i++){var x=Math.random()*w,y=Math.random()*h,c=45+Math.floor(Math.random()*30);
                ctx.fillStyle='rgba('+c+','+c+','+c+',0.35)';ctx.fillRect(x,y,4,4);}
        }),
        ceilingLight: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#b8dfb0'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='rgba(240,255,220,0.85)'; ctx.fillRect(6,6,w-12,h-12);
            ctx.strokeStyle='#7aaa72'; ctx.lineWidth=2; ctx.strokeRect(4,4,w-8,h-8);
        }),
        deadFixture: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#252520'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle='#3a3a35'; ctx.lineWidth=2; ctx.strokeRect(4,4,w-8,h-8);
            for(var i=0;i<6;i++){var rx=8+Math.random()*(w-24),ry=8+Math.random()*(h-24);
                ctx.fillStyle='rgba(5,3,0,0.7)';ctx.fillRect(rx,ry,14+Math.random()*10,5+Math.random()*5);}
        }),
        exitLight: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
        }),
        register: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#1a3a5c'; ctx.fillRect(8,8,w-16,h*0.45);
            ctx.fillStyle='#4a9cdb'; ctx.fillRect(12,12,w-24,h*0.35);
            ctx.fillStyle='#333'; ctx.fillRect(4,h*0.56,w-8,10);
            ctx.fillStyle='#555'; ctx.fillRect(4,h*0.68,w-8,12);
            ctx.fillStyle='#444'; ctx.fillRect(4,h*0.82,w-8,14);
        }),
        signPharmacy: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#dceeff'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#1a4fa8'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 17px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('PHARMACY',w/2,17);
            ctx.fillStyle='#1a4fa8'; ctx.font='12px sans-serif'; ctx.fillText('Health & First Aid',w/2,76);
        }),
        signBaking: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#fef8ea'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#8b5e1a'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#8b5e1a'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 20px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('BAKING',w/2,17);
            ctx.fillStyle='#8b5e1a'; ctx.font='12px sans-serif'; ctx.fillText('Bread & Pantry',w/2,76);
        }),
        signCleaning: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#e8f5e9'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#2e7d32'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#2e7d32'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 17px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CLEANING',w/2,17);
            ctx.fillStyle='#2e7d32'; ctx.font='12px sans-serif'; ctx.fillText('Household & Soap',w/2,76);
        }),
        signBreakfast: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#fff8e1'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#e65100'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#e65100'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('BREAKFAST',w/2,17);
            ctx.fillStyle='#e65100'; ctx.font='12px sans-serif'; ctx.fillText('Cereal & More',w/2,76);
        }),
        signCondiments: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#fffde7'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#f57f17'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#f57f17'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 14px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CONDIMENTS',w/2,17);
            ctx.fillStyle='#f57f17'; ctx.font='12px sans-serif'; ctx.fillText('Sauces & Spreads',w/2,76);
        }),
        signBeverages: new Texture(function(ctx,w,h) {
            ctx.fillStyle='#e8eaf6'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle='#4527a0'; ctx.fillRect(0,0,w,34);
            ctx.strokeStyle='#4527a0'; ctx.lineWidth=3; ctx.strokeRect(2,2,w-4,h-4);
            ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('BEVERAGES',w/2,17);
            ctx.fillStyle='#4527a0'; ctx.font='12px sans-serif'; ctx.fillText('Coffee & Drinks',w/2,76);
        }),
    };

    // Materials
    materials = {
        floor:         new Material(textures.floor,         0.28, 0.25,  8),
        shelf:         new Material(textures.shelf,         0.25, 0.40, 16),
        wall:          new Material(textures.wall,          0.20, 0.35, 12),
        concrete:      new Material(textures.concrete,      0.18, 0.30,  8),
        freezer:       new Material(textures.freezer,       0.26, 0.50, 20),
        monster:       new Material(textures.monster,       0.20, 0.70, 20),
        checkout:      new Material(textures.checkout,      0.22, 0.45, 14),
        door:          new Material(textures.door,          0.24, 0.45, 18),
        ceiling:       new Material(textures.ceiling,       0.15, 0.08,  4),
        ceilingLight:  new Material(textures.ceilingLight,  0.95, 0.15,  4),
        deadFixture:   new Material(textures.deadFixture,   0.12, 0.05,  4),
        exitLight:     new Material(textures.exitLight,     10.0, 0.0,   1),
        register:      new Material(textures.register,      0.22, 0.50, 18),
        signPharmacy:  new Material(textures.signPharmacy,  0.88, 0.20,  8),
        signBaking:    new Material(textures.signBaking,    0.88, 0.20,  8),
        signCleaning:  new Material(textures.signCleaning,  0.88, 0.20,  8),
        signBreakfast: new Material(textures.signBreakfast, 0.88, 0.20,  8),
        signCondiments:new Material(textures.signCondiments,0.88, 0.20,  8),
        signBeverages: new Material(textures.signBeverages, 0.88, 0.20,  8),
    };

    // Structural entities
    addEntity({ name:'floor',   type:'floor',   material:materials.floor,   position:[0,-0.6,-4],  scale:[54,1,60] });
    addEntity({ name:'ceiling', type:'ceiling', material:materials.ceiling, position:[0,3.55,-4],  scale:[54,0.5,60] });

    addEntity({ name:'wall-south-left',   type:'wall', material:materials.wall, position:[-14.45,1.4,26], scale:[25.1,4,1], solid:true });
    addEntity({ name:'wall-south-right',  type:'wall', material:materials.wall, position:[ 14.45,1.4,26], scale:[25.1,4,1], solid:true });
    addEntity({ name:'wall-south-top',    type:'wall', material:materials.wall, position:[0,3.3,26],      scale:[3.8,0.2,1], solid:true });
    addEntity({ name:'wall-south-bottom', type:'wall', material:materials.wall, position:[0,-0.3,26],     scale:[3.8,0.6,1], solid:true });
    addEntity({ name:'wall-west',         type:'wall', material:materials.wall, position:[-26,1.4,0],     scale:[1,4,54],    solid:true });
    addEntity({ name:'wall-east',         type:'wall', material:materials.wall, position:[26,1.4,0],      scale:[1,4,54],    solid:true });
    addEntity({ name:'wall-north-w',      type:'wall', material:materials.wall, position:[-14.25,1.4,-26],scale:[23.5,4,1],  solid:true });
    addEntity({ name:'wall-north-e',      type:'wall', material:materials.wall, position:[14.25,1.4,-26], scale:[23.5,4,1],  solid:true });

    addEntity({ name:'storage-north', type:'storage', material:materials.concrete, position:[0,1.4,-34],  scale:[16,4,1], solid:true });
    addEntity({ name:'storage-west',  type:'storage', material:materials.concrete, position:[-8,1.4,-30], scale:[1,4,8],  solid:true });
    addEntity({ name:'storage-east',  type:'storage', material:materials.concrete, position:[8,1.4,-30],  scale:[1,4,8],  solid:true });

    addEntity({ name:'checkout', type:'checkout', material:materials.checkout, position:[0,0.6,-18], scale:[12,2.2,2], solid:true });

    door = addEntity({ name:'exit-door', type:'door', material:materials.door, position:[0,1.6,25.3], scale:[3.8,3.2,0.5], solid:true });

    // Outside exit (the white void)
    addEntity({ name:'exit-tunnel-back',  type:'wall', material:materials.exitLight, position:[0,2,40.0],     scale:[12,6,1],  solid:false });
    addEntity({ name:'exit-tunnel-left',  type:'wall', material:materials.exitLight, position:[-5.5,2,33.5],  scale:[1,6,14],  solid:false });
    addEntity({ name:'exit-tunnel-right', type:'wall', material:materials.exitLight, position:[5.5,2,33.5],   scale:[1,6,14],  solid:false });
    addEntity({ name:'exit-tunnel-floor', type:'floor',   material:materials.exitLight, position:[0,-0.5,33.5],scale:[12,1,14], solid:false });
    addEntity({ name:'exit-tunnel-ceil',  type:'ceiling', material:materials.exitLight, position:[0,4.5,33.5], scale:[12,1,14], solid:false });

    // Ceiling fixtures
    addEntity({ name:'fixture-0', type:'fixture', material:materials.ceilingLight, position:[-5,3.3, 15], scale:[3.5,0.15,0.7] });
    addEntity({ name:'fixture-1', type:'fixture', material:materials.ceilingLight, position:[ 0,3.3,  0], scale:[3.5,0.15,0.7] });
    addEntity({ name:'fixture-2', type:'fixture', material:materials.ceilingLight, position:[ 5,3.3,-15], scale:[3.5,0.15,0.7] });
    addEntity({ name:'fixture-3', type:'fixture', material:materials.deadFixture,  position:[ 5,3.3, 15], scale:[3.5,0.15,0.7] });
    addEntity({ name:'fixture-4', type:'fixture', material:materials.deadFixture,  position:[-5,3.3,  0], scale:[3.5,0.15,0.7] });
    addEntity({ name:'fixture-5', type:'fixture', material:materials.deadFixture,  position:[ 0,3.3,-20], scale:[3.5,0.15,0.7] });

    // Main aisles
    var sides = [-1, 1];
    for (var si = 0; si < sides.length; si++) {
        var side = sides[si];
        var sx = side*9, tag = side<0 ? 'left' : 'right';
        addEntity({ name:'shelf-'+tag+'-south', type:'shelf', material:materials.shelf, position:[sx,0.8, 12], scale:[1.6,2.2,8], solid:true });
        addEntity({ name:'shelf-'+tag+'-mid',   type:'shelf', material:materials.shelf, position:[sx,0.8,  1], scale:[1.6,2.2,8], solid:true });
        addEntity({ name:'shelf-'+tag+'-north', type:'shelf', material:materials.shelf, position:[sx,0.8,-11], scale:[1.6,2.2,8], solid:true });
    }

    addEntity({ name:'endcap-left-south',  type:'shelf', material:materials.shelf, position:[-9,0.6, 17], scale:[2.5,1.8,1], solid:true });
    addEntity({ name:'endcap-right-south', type:'shelf', material:materials.shelf, position:[ 9,0.6, 17], scale:[2.5,1.8,1], solid:true });
    addEntity({ name:'endcap-left-north',  type:'shelf', material:materials.shelf, position:[-9,0.6,-16], scale:[2.5,1.8,1], solid:true });
    addEntity({ name:'endcap-right-north', type:'shelf', material:materials.shelf, position:[ 9,0.6,-16], scale:[2.5,1.8,1], solid:true });

    // Dairy / Meat freezers (east wall)
    addEntity({ name:'freezer-1', type:'freezer', material:materials.freezer, position:[24,0.3, -3], scale:[3,1.2,6], solid:true });
    addEntity({ name:'freezer-2', type:'freezer', material:materials.freezer, position:[24,0.3,-13], scale:[3,1.2,6], solid:true });

    // Frozen food freezers (west wall)
    addEntity({ name:'freezer-frozen-1', type:'freezer', material:materials.freezer, position:[-24,0.3, -3], scale:[3,1.2,6], solid:true });
    addEntity({ name:'freezer-frozen-2', type:'freezer', material:materials.freezer, position:[-24,0.3,-13], scale:[3,1.2,6], solid:true });

    // Registers
    addEntity({ name:'register-1', type:'register', material:materials.register, position:[ 6,0.7,21], scale:[2.5,1.8,1.5], solid:true });
    addEntity({ name:'register-2', type:'register', material:materials.register, position:[-6,0.7,21], scale:[2.5,1.8,1.5], solid:true });

    addEntity({ name:'fallen-1', type:'shelf', material:materials.shelf, position:[-4,0.8,-29], scale:[1.6,2.2,5], rotationY: 0.35,  rotationZ:Math.PI/2, solid:true });
    addEntity({ name:'fallen-2', type:'shelf', material:materials.shelf, position:[ 4,0.8,-29], scale:[1.6,2.2,5], rotationY:-0.30,  rotationZ:Math.PI/2, solid:true });

    // Monster
    monster     = addEntity({ name:'monster',      type:'monster', material:materials.monster, position:[0,1.0,-2], scale:[1.6,2.4,1.6], solid:true });
    monsterArmL = addEntity({ name:'monster-arm-l',type:'monster', material:materials.monster, position:[0,1.0,-2], scale:[0.6,1.8,0.6], solid:false });
    monsterArmR = addEntity({ name:'monster-arm-r',type:'monster', material:materials.monster, position:[0,1.0,-2], scale:[0.6,1.8,0.6], solid:false });
}
//---------------------------Scene Objects---------------------------//

//---------------------------Build and Start---------------------------//
function buildAndStart() {
    var CYLINDER_ITEMS = { 'Milk':true, 'Can Soup':true };

    // Required items
    var requiredItemDefs = [
        { name:'Milk',        pos:[ 21,  1.4,  -3], key:'milk'      },
        { name:'Cereal',      pos:[  7.5,1.4,  12], key:'cereal'    },
        { name:'Bread',       pos:[ -7.5,1.4,   2], key:'bread'     },
        { name:'Meat',        pos:[ 21,  1.4, -13], key:'meat'      },
        { name:'Soap',        pos:[ -7.5,1.4, -11], key:'soap'      },
        { name:'Coffee',      pos:[  7.5,1.4, -11], key:'coffee'    },
        { name:'Can Soup',    pos:[  0,  1.4, -28], key:'canofsoup' },
        { name:'Bandages',    pos:[ -7.5,1.4,  12], key:'bandages'  },
        { name:'Ice Cream',   pos:[-21,  1.4,  -3], key:'icecream'  },
        { name:'Frozen Peas', pos:[-21,  1.4, -11], key:'peas'      },
    ];
    for (var i = 0; i < requiredItemDefs.length; i++) {
        var item = requiredItemDefs[i];
        addEntity({ name:item.name, type:'item',
                    mesh: CYLINDER_ITEMS[item.name] ? cylinderMesh : cubeMesh,
                    material: new Material(imgTex(item.key), 0.35, 0.60, 32),
                    position:item.pos, scale:[0.7,0.7,0.7], pickable:true, isRequired:true });
    }

    // Decoy items
    var decoyItemDefs = [
        { name:'Candy',    pos:[ 7.5,1.4, 6.5], key:'candy'     },
        { name:'Chips',    pos:[-7.5,1.4, 6.5], color:'#FFD600' },
        { name:'Juice',    pos:[-7.5,1.4,  -5], color:'#8BC34A' },
        { name:'Crackers', pos:[ 7.5,1.4,  -5], color:'#FF5722' },
        { name:'Soda',     pos:[ -6, 1.4, -32], color:'#673AB7' },
    ];
    for (var j = 0; j < decoyItemDefs.length; j++) {
        var d = decoyItemDefs[j];
        addEntity({ name:d.name, type:'item',
                    material:itemMat(d.key, d.name, d.color),
                    position:d.pos, scale:[0.7,0.7,0.7], pickable:true, isRequired:false });
    }

    // Section signs (PNG images)
    addEntity({ name:'sign-dairy',  type:'sign', material:new Material(imgTex('milk'),    0.90,0.20,8), position:[ 20,2.75, -1.5], scale:[3.2,0.65,0.08] });
    addEntity({ name:'sign-meat',   type:'sign', material:new Material(imgTex('meat'),    0.90,0.20,8), position:[ 20,2.75,-11.5], scale:[3.2,0.65,0.08] });
    addEntity({ name:'sign-frozen', type:'sign', material:new Material(imgTex('icecream'),0.90,0.20,8), position:[-20,2.75, -7  ], scale:[3.2,0.65,0.08] });
    addEntity({ name:'sign-venue',  type:'sign', material:new Material(imgTex('venue'),   0.90,0.10,4), position:[  0,3.05, 25.2], scale:[4.5,0.80,0.05] });

    // Aisle signs (procedural)
    addEntity({ name:'sign-pharmacy',   type:'sign', material:materials.signPharmacy,   position:[-9,2.7, 12], scale:[1.8,0.55,0.08] });
    addEntity({ name:'sign-baking',     type:'sign', material:materials.signBaking,     position:[-9,2.7,  1], scale:[1.8,0.55,0.08] });
    addEntity({ name:'sign-cleaning',   type:'sign', material:materials.signCleaning,   position:[-9,2.7,-11], scale:[1.8,0.55,0.08] });
    addEntity({ name:'sign-breakfast',  type:'sign', material:materials.signBreakfast,  position:[ 9,2.7, 12], scale:[1.8,0.55,0.08] });
    addEntity({ name:'sign-condiments', type:'sign', material:materials.signCondiments, position:[ 9,2.7,  1], scale:[1.8,0.55,0.08] });
    addEntity({ name:'sign-beverages',  type:'sign', material:materials.signBeverages,  position:[ 9,2.7,-11], scale:[1.8,0.55,0.08] });

    // Filler items
    var fillerItemDefs = [
        { name:'Vitamins',     pos:[-8.5,1.4,  9  ], color:'#80DEEA' },
        { name:'Aspirin',      pos:[-8.5,1.4, 14  ], color:'#FF7043' },
        { name:'Flour',        pos:[-8.5,1.4,  4  ], key:'flour'     },
        { name:'Pasta',        pos:[-8.5,1.4, -1  ], key:'pasta'     },
        { name:'Bleach',       pos:[-8.5,1.4, -8  ], color:'#DCE6F8' },
        { name:'Sponges',      pos:[-8.5,1.4,-13  ], color:'#FFEB3B' },
        { name:'Granola',      pos:[ 8.5,1.4,  9  ], color:'#D4A55A' },
        { name:'Oatmeal',      pos:[ 8.5,1.4, 14  ], color:'#C8A060' },
        { name:'Ketchup',      pos:[ 8.5,1.4,  4  ], key:'ketchup'   },
        { name:'Mustard',      pos:[ 8.5,1.4, -1  ], key:'mustard'   },
        { name:'Tea',          pos:[ 8.5,1.4, -8  ], color:'#80CBC4' },
        { name:'Hot Cocoa',    pos:[ 8.5,1.4,-13  ], color:'#5D4037' },
        { name:'Butter',       pos:[22.5,1.4,  0.5], key:'butter'    },
        { name:'Cheese',       pos:[22.5,1.4, -4.5], key:'cheese'    },
        { name:'Cream',        pos:[22.5,1.4, -7.5], key:'cream'     },
        { name:'Sausage',      pos:[22.5,1.4,-11.5], key:'sausage'   },
        { name:'Chicken',      pos:[22.5,1.4,-14.5], key:'chicken'   },
        { name:'Popsicles',    pos:[-22.5,1.4,  0.5], color:'#FF4081' },
        { name:'Waffles',      pos:[-22.5,1.4, -7.5], color:'#FFD54F' },
        { name:'Frozen Pizza', pos:[-22.5,1.4,-14.5], color:'#AED6F1' },
    ];
    for (var k = 0; k < fillerItemDefs.length; k++) {
        var f = fillerItemDefs[k];
        addEntity({ name:f.name, type:'item',
                    material:itemMat(f.key, f.name, f.color),
                    position:f.pos, scale:[0.7,0.7,0.7], pickable:false, isRequired:false });
    }

    setupInput();
    resetGame();
    requestAnimationFrame(frame);
}
//---------------------------Build and Start---------------------------//
