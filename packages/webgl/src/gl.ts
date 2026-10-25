export function createProgram(
  gl: WebGLRenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  if (!program) throw new Error("WEBGL_RESOURCE_ERROR");
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("WEBGL_RESOURCE_ERROR");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(`SHADER_ERROR: ${gl.getShaderInfoLog(shader)}`);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`PROGRAM_ERROR: ${gl.getProgramInfoLog(program)}`);
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

export function mesh(segments: number): { vertices: Float32Array; indices: Uint16Array } {
  const vertices = new Float32Array((segments + 1) * (segments + 1) * 2),
    indices = new Uint16Array(segments * segments * 6);
  let cursor = 0;
  for (let y = 0; y <= segments; y++)
    for (let x = 0; x <= segments; x++) {
      vertices[cursor++] = (x / segments) * 2 - 1;
      vertices[cursor++] = (y / segments) * 2 - 1;
    }
  cursor = 0;
  for (let y = 0; y < segments; y++)
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x,
        b = a + 1,
        c = a + segments + 1,
        d = c + 1;
      indices.set([a, b, c, c, b, d], cursor);
      cursor += 6;
    }
  return { vertices, indices };
}

export function uploadAtlas(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  characters: string,
): void {
  const canvas = document.createElement("canvas");
  canvas.width = characters.length * 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ATLAS_ERROR");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, 32);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 27px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < characters.length; i++) ctx.fillText(characters[i], i * 32 + 16, 17);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
