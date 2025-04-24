const canvas = document.getElementById('fluidCanvas');
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const GRID_SIZE = 64;
const GRID_SIZE_2 = Math.floor(GRID_SIZE * (16/9)); // as close as possible to 16:9 ratio
const cellSizeX = canvas.width / GRID_SIZE_2;
const cellSizeY = canvas.height / GRID_SIZE;

const particles = new Array(GRID_SIZE_2 * GRID_SIZE).fill(0.1);

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < GRID_SIZE_2; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const density = particles[x * GRID_SIZE + y];
      ctx.fillStyle = `rgba(100, 200, 255, ${Math.min(density, 1.0)})`;
      ctx.fillRect(
          x * cellSizeX,
          y * cellSizeY,
          cellSizeX,
          cellSizeY
      );
    }
  }
}

let size = (GRID_SIZE_2 + 2) * (GRID_SIZE + 2);

let u = new Array(size).fill(0);
let v = new Array(size).fill(0);
let u_prev = new Array(size).fill(0);
let v_prev = new Array(size).fill(0);
let dens = new Array(size).fill(0);
let dens_prev = new Array(size).fill(0);

const visc = 0.0001;
const diff = 0.001;
const dt = 0.1;

let mouseX = 0, mouseY = 0;
let pmouseX = 0, pmouseY = 0;
let mdown = false;
const FORCE = 100.0;

canvas.addEventListener('mousedown', (e) => {
  mdown = true;
  updateMousePosition(e);
});
canvas.addEventListener('mouseup', () => {
  mdown = false;
});
canvas.addEventListener('mousemove', (e) => {
  if (mdown) {
    updateMousePosition(e);
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  mdown = true;
  updateMousePosition(e.touches[0]);
}, { passive: false });
canvas.addEventListener('touchend', () => {
  mdown = false;
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (mdown) {
    updateMousePosition(e.touches[0]);
  }
}, { passive: false });

function updateMousePosition(e) {
  pmouseX = mouseX;
  pmouseY = mouseY;
  mouseX = e.clientX - canvas.getBoundingClientRect().left;
  mouseY = e.clientY - canvas.getBoundingClientRect().top;
}

function resetSources() {
  for (let i = 0; i < size; i++) {
    dens_prev[i] = 0;
    u_prev[i] = 0;
    v_prev[i] = 0;
  }
}
 
function simulate() {
  resetSources();
  get_from_UI();
  let vals = vel_step(GRID_SIZE_2, GRID_SIZE, u, v, u_prev, v_prev, visc, dt);
  u = vals[0];
  v = vals[1];
  u_prev = vals[2];
  v_prev = vals[3];
  dens = dens_step(GRID_SIZE_2, GRID_SIZE, dens, dens_prev, u, v, diff, dt);
  for (let i = 1; i <= GRID_SIZE_2; i++) {
    for (let j = 1; j <= GRID_SIZE; j++) {
      particles[(i-1) * GRID_SIZE + (j-1)] = dens[IX(i, j)];
    }
  }
  render();
  requestAnimationFrame(simulate);
}

function get_from_UI() {
  if (!mdown) return;
  
  const i = Math.floor(mouseX / cellSizeX) + 1;
  const j = Math.floor(mouseY / cellSizeY) + 1;
  if (i < 1 || i > GRID_SIZE_2 || j < 1 || j > GRID_SIZE) return;
  dens_prev[IX(i, j)] = FORCE;

  if (i > 1) dens_prev[IX(i-1, j)] = FORCE/2;
  if (i < GRID_SIZE_2) dens_prev[IX(i+1, j)] = FORCE/2;
  if (j > 1) dens_prev[IX(i, j-1)] = FORCE/2;
  if (j < GRID_SIZE) dens_prev[IX(i, j+1)] = FORCE/2;

  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;
  
  u_prev[IX(i, j)] = dx * FORCE;
  v_prev[IX(i, j)] = dy * FORCE;
}

function IX(i, j) {
  return i + (GRID_SIZE_2 + 2) * j;
}

function set_bnd(N1, N2, b, x) {
  for (let i = 1; i <= N1; i++) {
    x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
    x[IX(i, N2+1)] = b === 2 ? -x[IX(i, N2)] : x[IX(i, N2)];
  }
  for (let j = 1; j <= N2; j++) {
    x[IX(0, j)] = b === 1 ? -x[IX(1, j)] : x[IX(1, j)];
    x[IX(N1+1, j)] = b === 1 ? -x[IX(N1, j)] : x[IX(N1, j)];
  }
    
  x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
  x[IX(0, N2+1)] = 0.5 * (x[IX(1, N2+1)] + x[IX(0, N2)]);
  x[IX(N1+1, 0)] = 0.5 * (x[IX(N1, 0)] + x[IX(N1+1, 1)]);
  x[IX(N1+1, N2+1)] = 0.5 * (x[IX(N1, N2+1)] + x[IX(N1+1, N2)]);
  
  return x;
}

function add_source(N1, N2, x, s, dt) {
  for (let i = 0; i < (N1+2) * (N2+2); i++) {
    x[i] += dt * s[i];
  }
  return x;
}

function diffuse(N1, N2, b, x, x0, diff, dt) {
  let a = dt * diff * N1 * N2;
  
  for (let k = 0; k < 20; k++) {
    for (let i = 1; i <= N1; i++) {
      for (let j = 1; j <= N2; j++) {
        x[IX(i, j)] = (x0[IX(i, j)] +
                a * (x[IX(i-1, j)] +
                  x[IX(i+1, j)] +
                  x[IX(i, j-1)] +
                  x[IX(i, j+1)])) / (1 + 4 * a);
      }
    }
    x = set_bnd(N1, N2, b, x);
  }
  
  return x;
}

function advect(N1, N2, b, d, d0, u, v, dt) {
  let dt0x = dt * N1;
  let dt0y = dt * N2;
  
  for (let i = 1; i <= N1; i++) {
    for (let j = 1; j <= N2; j++) {
      let x = i - dt0x * u[IX(i, j)];
      let y = j - dt0y * v[IX(i, j)];
      
      x = Math.max(0.5, Math.min(N1 + 0.5, x));
      y = Math.max(0.5, Math.min(N2 + 0.5, y));
      
      let i0 = Math.floor(x);
      let i1 = i0 + 1;
      let j0 = Math.floor(y);
      let j1 = j0 + 1;
      
      let s1 = x - i0;
      let s0 = 1 - s1;
      let t1 = y - j0;
      let t0 = 1 - t1;
      
      d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
             s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
    }
  }
  
  d = set_bnd(N1, N2, b, d);
  return d;
}

function dens_step(N1, N2, x, x0, u, v, diff, dt) {
  x = add_source(N1, N2, x, x0, dt);
  
  [x, x0] = [x0, x];
  x = diffuse(N1, N2, 0, x, x0, diff, dt);

  [x, x0] = [x0, x];
  x = advect(N1, N2, 0, x, x0, u, v, dt);
  
  return x;
}

function vel_step(N1, N2, u, v, u0, v0, visc, dt) {
  u = add_source(N1, N2, u, u0, dt);
  v = add_source(N1, N2, v, v0, dt);
  
  [u0, u] = [u, u0];
  u = diffuse(N1, N2, 1, u, u0, visc, dt);
  
  [v0, v] = [v, v0];
  v = diffuse(N1, N2, 2, v, v0, visc, dt);
  
  let vals = project(N1, N2, u, v, u0, v0);
  u = vals[0];
  v = vals[1];
  u0 = vals[2];
  v0 = vals[3];
  [u0, u] = [u, u0];
  [v0, v] = [v, v0];
  u = advect(N1, N2, 1, u, u0, u0, v0, dt);
  v = advect(N1, N2, 2, v, v0, u0, v0, dt);
  vals = project(N1, N2, u, v, u0, v0);
  u = vals[0];
  v = vals[1];
  u0 = vals[2];
  v0 = vals[3];
  
  return [u, v, u0, v0];
}

function project(N1, N2, u, v, p, div) {
  let hx = 1.0 / N1;
  let hy = 1.0 / N2;
  
  for (let i = 1; i <= N1; i++) {
    for (let j = 1; j <= N2; j++) {
      div[IX(i, j)] = -0.5 * (
        (u[IX(i+1, j)] - u[IX(i-1, j)]) * hx +
        (v[IX(i, j+1)] - v[IX(i, j-1)]) * hy
      );
      p[IX(i, j)] = 0;
    }
  }
  div = set_bnd(N1, N2, 0, div);
  p = set_bnd(N1, N2, 0, p);
  
  for (let k = 0; k < 20; k++) {
    for (let i = 1; i <= N1; i++) {
      for (let j = 1; j <= N2; j++) {
        p[IX(i, j)] = (div[IX(i, j)] +
               p[IX(i-1, j)] +
               p[IX(i+1, j)] +
               p[IX(i, j-1)] +
               p[IX(i, j+1)]) / 4;
      }
    }
    p = set_bnd(N1, N2, 0, p);
  }
  
  for (let i = 1; i <= N1; i++) {
    for (let j = 1; j <= N2; j++) {
      u[IX(i, j)] -= 0.5 * (p[IX(i+1, j)] - p[IX(i-1, j)]) / hx;
      v[IX(i, j)] -= 0.5 * (p[IX(i, j+1)] - p[IX(i, j-1)]) / hy;
    }
  }
  
  u = set_bnd(N1, N2, 1, u);
  v = set_bnd(N1, N2, 2, v);
  
  return [u, v, p, div];
}

render();
simulate();