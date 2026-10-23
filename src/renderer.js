const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;

uniform vec2 uResolution;
uniform vec4 uDest;
uniform vec2 uDrift;

out vec2 vCellUv;

void main() {
  vec2 pixel = uDest.xy + uDrift + aPosition * uDest.zw;
  vec2 clip = vec2((pixel.x / uResolution.x) * 2.0 - 1.0, 1.0 - (pixel.y / uResolution.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vCellUv = aPosition;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uVideo;
uniform vec4 uSource;
uniform float uBlurTexelRadius;
uniform float uRotation;
uniform float uInvert;
uniform float uExposure;

in vec2 vCellUv;
out vec4 outColor;

void main() {
  vec2 cellUv = mix(vCellUv, vec2(1.0) - vCellUv, uRotation);
  vec2 baseUv = uSource.xy + cellUv * uSource.zw;
  vec2 minUv = uSource.xy;
  vec2 maxUv = uSource.xy + uSource.zw;

  if (uBlurTexelRadius <= 0.00001) {
    vec3 raw = texture(uVideo, clamp(baseUv, minUv, maxUv)).rgb;
    float luminance = dot(raw, vec3(0.2126, 0.7152, 0.0722));
    outColor = vec4(mix(mix(raw, vec3(1.0 - luminance), uInvert), vec3(1.0), uExposure), 1.0);
    return;
  }

  vec4 color = vec4(0.0);
  float weightTotal = 0.0;

  for (int i = -12; i <= 12; i += 1) {
    float position = float(i) / 12.0;
    float weight = 1.0 - abs(position) * 0.58;
    vec2 uv = vec2(clamp(baseUv.x + position * uBlurTexelRadius, minUv.x, maxUv.x), baseUv.y);
    color += texture(uVideo, uv) * weight;
    weightTotal += weight;
  }

  vec3 raw = (color / weightTotal).rgb;
  float luminance = dot(raw, vec3(0.2126, 0.7152, 0.0722));
  outColor = vec4(mix(mix(raw, vec3(1.0 - luminance), uInvert), vec3(1.0), uExposure), 1.0);
}
`;

export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!this.gl) {
      throw new Error("WebGL2 no esta disponible.");
    }

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.locations = {
      position: this.gl.getAttribLocation(this.program, "aPosition"),
      resolution: this.gl.getUniformLocation(this.program, "uResolution"),
      dest: this.gl.getUniformLocation(this.program, "uDest"),
      drift: this.gl.getUniformLocation(this.program, "uDrift"),
      source: this.gl.getUniformLocation(this.program, "uSource"),
      blurTexelRadius: this.gl.getUniformLocation(this.program, "uBlurTexelRadius"),
      rotation: this.gl.getUniformLocation(this.program, "uRotation"),
      invert: this.gl.getUniformLocation(this.program, "uInvert"),
      exposure: this.gl.getUniformLocation(this.program, "uExposure"),
      video: this.gl.getUniformLocation(this.program, "uVideo"),
    };

    this.texture = this.createTexture();
    this.hasFrame = false;
    this.createQuad();
    this.gl.useProgram(this.program);
    this.gl.uniform1i(this.locations.video, 0);
    this.gl.disable(this.gl.BLEND);
    this.gl.disable(this.gl.DEPTH_TEST);
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = "100vw";
      this.canvas.style.height = "100vh";
    }

    return { width, height };
  }

  render(video, cells, tone = {}) {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    gl.viewport(0, 0, width, height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (video) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      this.hasFrame = true;
    }
    if (!this.hasFrame) return;
    gl.uniform2f(this.locations.resolution, width, height);
    gl.uniform1f(this.locations.invert, Math.max(0, Math.min(1, tone.invert ?? 0)));
    gl.uniform1f(this.locations.exposure, Math.max(0, Math.min(1, tone.exposure ?? 0)));

    for (let index = 0; index < cells.length; index += 1) {
      const driftTime = tone.driftTime;
      const drift = driftTime === undefined ? { x: 0, y: 0 } : {
        x: Math.sin(driftTime * 0.00017 + index * 1.91) * 1.8,
        y: Math.cos(driftTime * 0.00012 + index * 1.37) * 1.4,
      };
      this.drawCell(cells[index], drift);
    }
  }

  drawCell(cell, drift = { x: 0, y: 0 }) {
    const gl = this.gl;
    const { dest, source, blurPx, rotation } = cell;
    const blurTexelRadius = blurPx > 0 ? (blurPx * source.width) / Math.max(1, dest.width) : 0;

    gl.uniform4f(this.locations.dest, dest.x, dest.y, dest.width, dest.height);
    gl.uniform2f(this.locations.drift, drift.x, drift.y);
    gl.uniform4f(
      this.locations.source,
      source.x,
      source.y,
      source.width,
      source.height,
    );
    gl.uniform1f(this.locations.blurTexelRadius, blurTexelRadius);
    gl.uniform1f(this.locations.rotation, rotation === 180 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.buffer);
    this.hasFrame = false;
  }

  createTexture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  createQuad() {
    const gl = this.gl;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "No se pudo enlazar WebGL.");
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "No se pudo compilar WebGL.");
    }

    return shader;
  }
}
