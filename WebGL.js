class WebGL {
    constructor() {
        this.vertexShaderSource   = document.getElementById("vertex-shader").textContent.trimStart();
        this.fragmentShaderSource = document.getElementById("fragment-shader").textContent.trimStart();
        this.vertexShader   = this.createShader(gl.VERTEX_SHADER,   this.vertexShaderSource);
        this.fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        this.program = this.createProgram(this.vertexShader, this.fragmentShader);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.02, 0.03, 0.035, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.useProgram(this.program);
        this.attribLocations  = {};
        this.uniformLocations = {};
    }

    createShader(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
        console.warn(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    createProgram(vs, fs) {
        if (!vs || !fs) throw new Error("Shader compilation failed. Check the GLSL source above.");
        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.detachShader(program, vs);
            gl.detachShader(program, fs);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            return program;
        }
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    use() { gl.useProgram(this.program); }

    // Get and cache a uniform location by name
    u(name) {
        if (this.uniformLocations[name] !== undefined) return this.uniformLocations[name];
        this.uniformLocations[name] = gl.getUniformLocation(this.program, name);
        return this.uniformLocations[name];
    }
}
