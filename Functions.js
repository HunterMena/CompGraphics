var DEG2RAD = Math.PI / 180;

//---------------------------Math---------------------------//
var Vec3 = {
    add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; },
    sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
    mul(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; },
    dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; },
    length(a) { return Math.hypot(a[0], a[1], a[2]); },
    normalize(a) { var l = Vec3.length(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
    cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
};

var Mat4 = {
    identity() {
        return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    perspective(fovy, aspect, near, far) {
        var f  = 1 / Math.tan(fovy / 2);
        var nf = 1 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0,  0,
            0,          f, 0,  0,
            0,          0, (far + near) * nf, -1,
            0,          0, 2 * far * near * nf, 0,
        ]);
    },
    multiply(a, b) {
        var out = new Float32Array(16);
        for (var i = 0; i < 4; i++)
            for (var j = 0; j < 4; j++)
                out[i*4+j] = a[0*4+j]*b[i*4+0] + a[1*4+j]*b[i*4+1] + a[2*4+j]*b[i*4+2] + a[3*4+j]*b[i*4+3];
        return out;
    },
    translate(m, x, y, z) {
        var t = Mat4.identity(); t[12]=x; t[13]=y; t[14]=z;
        return Mat4.multiply(m, t);
    },
    scale(m, x, y, z) {
        var s = Mat4.identity(); s[0]=x; s[5]=y; s[10]=z;
        return Mat4.multiply(m, s);
    },
    rotateY(m, a) {
        var c=Math.cos(a), s=Math.sin(a);
        return Mat4.multiply(m, new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]));
    },
    rotateX(m, a) {
        var c=Math.cos(a), s=Math.sin(a);
        return Mat4.multiply(m, new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]));
    },
    rotateZ(m, a) {
        var c=Math.cos(a), s=Math.sin(a);
        return Mat4.multiply(m, new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]));
    },
    lookAt(eye, target, up) {
        var z = Vec3.normalize(Vec3.sub(eye, target));
        var x = Vec3.normalize(Vec3.cross(up, z));
        var y = Vec3.cross(z, x);
        return new Float32Array([
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -Vec3.dot(x,eye), -Vec3.dot(y,eye), -Vec3.dot(z,eye), 1,
        ]);
    },
};
//---------------------------Math---------------------------//

//---------------------------VAO---------------------------//
function setVAO() {
    var _vao = gl.createVertexArray();
    bindVAO(_vao);
    return _vao;
}
function unbindVAO() { gl.bindVertexArray(null); }
function bindVAO(_name) { gl.bindVertexArray(_name); }
//---------------------------VAO---------------------------//

//---------------------------Buffers and Attributes---------------------------//
function SetBuffer(_data, _type) {
    var _Buffer = gl.createBuffer();
    if (_type === "index") {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _Buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(_data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, _Buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    return _Buffer;
}

function SetBufferData(_data, _buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_data), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return _buffer;
}

function SetAttribute(webglHelper, _name, _size, _stride, _offset) {
    var _AttributeLocation = gl.getAttribLocation(webglHelper.program, _name);
    gl.enableVertexAttribArray(_AttributeLocation);
    var stride = _stride * Float32Array.BYTES_PER_ELEMENT;
    var offset = _offset * Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(_AttributeLocation, _size, gl.FLOAT, false, stride, offset);
    if (webglHelper.attribLocations[_name] !== undefined) return webglHelper.attribLocations[_name];
    webglHelper.attribLocations[_name] = _AttributeLocation;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return _AttributeLocation;
}

function SetBufferAndAttribute(webglHelper, _name, _data, _size, _stride, _offset) {
    var _Buffer = SetBuffer(_data);
    gl.bindBuffer(gl.ARRAY_BUFFER, _Buffer);
    SetAttribute(webglHelper, _name, _size, _stride, _offset);
    return _Buffer;
}

function SetIndexBuffer(_data) {
    var _Buffer = SetBuffer(_data, "index");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _Buffer);
}
//---------------------------Buffers and Attributes---------------------------//

//---------------------------Uniforms---------------------------//
function getUniformLocation(webglHelper, _name) {
    if (webglHelper.uniformLocations[_name] !== undefined) return webglHelper.uniformLocations[_name];
    var loc = gl.getUniformLocation(webglHelper.program, _name);
    webglHelper.uniformLocations[_name] = loc;
    return loc;
}
function setUniform1f(webglHelper, _name, x)       { gl.uniform1f(getUniformLocation(webglHelper, _name), x); }
function setUniform1i(webglHelper, _name, x)       { gl.uniform1i(getUniformLocation(webglHelper, _name), x); }
function setUniform2f(webglHelper, _name, x, y)    { gl.uniform2f(getUniformLocation(webglHelper, _name), x, y); }
function setUniform3f(webglHelper, _name, x, y, z) { gl.uniform3f(getUniformLocation(webglHelper, _name), x, y, z); }
function setUniformMatrix4fv(webglHelper, _name, mat4Array, transpose) {
    gl.uniformMatrix4fv(getUniformLocation(webglHelper, _name), transpose || false, mat4Array);
}
//---------------------------Uniforms---------------------------//

//---------------------------Texture---------------------------//
function UsesMipmaps(_minFilter) {
    return _minFilter === gl.NEAREST_MIPMAP_NEAREST ||
           _minFilter === gl.LINEAR_MIPMAP_NEAREST  ||
           _minFilter === gl.NEAREST_MIPMAP_LINEAR  ||
           _minFilter === gl.LINEAR_MIPMAP_LINEAR;
}

function CreateEmptyTexture(_wrap, _minFilter, _magFilter, _type, _width, _height, _source) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, _wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, _wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, _minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, _magFilter);
    gl.texImage2D(gl.TEXTURE_2D, 0, _type, _width, _height, 0, _type, gl.UNSIGNED_BYTE, _source);
    if (UsesMipmaps(_minFilter)) gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
}

function CreateImageTexture(_source, _wrap, _minFilter, _magFilter, _placeholder) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, _wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, _wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, _minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, _magFilter);
    var placeholder = _placeholder || new Uint8Array([128, 128, 128, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
    var image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (UsesMipmaps(_minFilter)) gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.onerror = function() { console.error("Failed to load image texture:", _source); };
    image.src = _source;
    return texture;
}

function ActivateTexture(_enum, _type, _name) {
    gl.activeTexture(_enum);
    gl.bindTexture(_type, _name);
}

function Checker(texelSize, numCheckers) {
    var imagedata = new Uint8Array(4 * texelSize * texelSize);
    for (var i = 0; i < texelSize; i++) {
        for (var j = 0; j < texelSize; j++) {
            var x = Math.floor(i / (texelSize / numCheckers));
            var y = Math.floor(j / (texelSize / numCheckers));
            var pixelIndex = 4 * (i * texelSize + j);
            if (x % 2 == y % 2) {
                imagedata[pixelIndex]=255; imagedata[pixelIndex+1]=0;
                imagedata[pixelIndex+2]=0; imagedata[pixelIndex+3]=255;
            } else {
                imagedata[pixelIndex]=0; imagedata[pixelIndex+1]=0;
                imagedata[pixelIndex+2]=0; imagedata[pixelIndex+3]=255;
            }
        }
    }
    return imagedata;
}
//---------------------------Texture---------------------------//

//---------------------------Input State---------------------------//
var input = { w:false, a:false, s:false, d:false, arrowleft:false, arrowright:false, ' ':false };
//---------------------------Input State---------------------------//

//---------------------------Resize---------------------------//
function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}
//---------------------------Resize---------------------------//
