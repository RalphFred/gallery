const container = document.querySelector(".container");
let program;
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let targetMouseX = mouseX;
let targetMouseY = mouseY;
let texture = null;
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;

const imgSources = Array.from(
  { length: 40 },
  (_, i) => `./assets/${i + 1}.jpg`
);

function getRandomImage() {
  return imgSources[Math.floor(Math.random() * imgSources.length)];
}

function createImageGrid() {
  for (let i = 0; i < 300; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "img-wrapper";

    const img = document.createElement("img");
    img.src = getRandomImage();
    img.alt = "Grid item";

    wrapper.appendChild(img);
    container.appendChild(wrapper);
  }
}

function updatePan(mouseX, mouseY) {
  const maxX = container.offsetWidth - window.innerWidth;
  const maxY = container.offsetHeight - window.innerHeight;

  targetX = -((mouseX / window.innerWidth) * maxX * 0.75);
  targetY = -((mouseY / window.innerHeight) * maxY * 0.75);
}

function animatePan() {
  const ease = 0.035;
  currentX += (targetX - currentX) * ease;
  currentY += (targetY - currentY) * ease;

  container.style.transform = `translate(${currentX}px, ${currentY}px)`;
  requestAnimationFrame(animatePan);
}

const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl", {
  preserveDrawingBuffer: false,
  antialias: true,
  alpha: true,
});

function setupWebGL() {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

async function loadShaders() {
  try {
    const [vertexResponse, fragmentResponse] = await Promise.all([
      fetch("./shaders/vertex.glsl"),
      fetch("./shaders/fragment.glsl"),
    ]);

    const vertexSource = await vertexResponse.text();
    const fragmentSource = await fragmentResponse.text();

    return { vertexSource, fragmentSource };
  } catch (error) {
    console.error("Error loading shaders:", error);
    throw error;
  }
}

async function initWebGL() {
  setupWebGL();

  const { vertexSource, fragmentSource } = await loadShaders();
  const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.useProgram(program);

  const vertices = new Float32Array([
    -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
  ]);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const iChannel0Location = gl.getUniformLocation(program, "iChannel0");
  gl.uniform1i(iChannel0Location, 0);
}

function updateTexture() {
  const tempCanvas = document.createElement("canvas");
  const scale = 4;
  tempCanvas.width = Math.floor(window.innerWidth * scale);
  tempCanvas.height = Math.floor(window.innerHeight * scale);
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = "high";
  tempCtx.fillStyle = "white";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  const viewportRect = container.getBoundingClientRect();
  const matrix = new DOMMatrix(getComputedStyle(container).transform);

  tempCtx.setTransform(
    matrix.a,
    matrix.b,
    matrix.c,
    matrix.d,
    matrix.e * scale,
    matrix.f * scale
  );

  const images = container.getElementsByTagName("img");
  for (let img of images) {
    const rect = img.getBoundingClientRect();
    const parent = img.parentElement.getBoundingClientRect();

    tempCtx.drawImage(
      img,
      (parent.left - viewportRect.left) * scale,
      (parent.top - viewportRect.top) * scale,
      parent.width * scale,
      parent.height * scale
    );
  }

  tempCtx.setTransform(1, 0, 0, 1, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    tempCanvas
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function render() {
  const ease = 0.1;
  mouseX += (targetMouseX - mouseX) * ease;
  mouseY += (targetMouseY - mouseY) * ease;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  updateTexture();

  const resolutionLocation = gl.getUniformLocation(program, "iResolution");
  const mouseLocation = gl.getUniformLocation(program, "iMouse");

  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(mouseLocation, mouseX, canvas.height - mouseY);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(render);
}

function setupEventListeners() {
  document.addEventListener("mousemove", (e) => {
    targetMouseX = e.clientX;
    targetMouseY = e.clientY;
    updatePan(e.clientX, e.clientY);
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    targetMouseX = window.innerWidth / 2;
    targetMouseY = window.innerHeight / 2;
    mouseX = targetMouseX;
    mouseY = targetMouseY;

    targetX = 0;
    targetY = 0;
    currentX = 0;
    currentY = 0;
  });
}

async function init() {
  createImageGrid();

  const firstImage = container.querySelector("img");

  await new Promise((resolve) => {
    if (firstImage.complete) {
      resolve();
    } else {
      firstImage.onload = resolve;
    }
  });

  await initWebGL();
  setupEventListeners();
  animatePan();
  render();
}

init();
