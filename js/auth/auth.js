import { sql } from "../config/neon-config.js";

export async function registrarUsuario(nombre, correo, contrasena) {
  await sql`INSERT INTO usuarios (nombre, correo, contrasena)
            VALUES (${nombre}, ${correo}, ${contrasena})`;
}

export async function iniciarSesion(correo, contrasena) {
  const filas = await sql`
    SELECT id, nombre, rol FROM usuarios
    WHERE correo = ${correo} AND contrasena = ${contrasena}`;
  if (filas.length === 0) return null;
  sessionStorage.setItem("usuario", JSON.stringify(filas[0]));
  return filas[0];
}

export function cerrarSesion() {
  sessionStorage.removeItem("usuario");
}

export function exigirSesion() {
  const guardado = sessionStorage.getItem("usuario");
  if (!guardado) {
    window.location.href = "login.html";
    return null;
  }
  return JSON.parse(guardado);
}

export function exigirRol(...rolesPermitidos) {
  const usuario = exigirSesion();
  if (!usuario) return null;
  if (!rolesPermitidos.includes(usuario.rol)) {
    alert("Tu perfil no tiene acceso a esta página.");
    window.location.href = "index.html";
    return null;
  }
  return usuario;
}

export function rutaInicioSegunRol(rol) {
  const rutas = {
    cliente: "registro.html",
    administrador: "panel.html",
    empleado: "panel.html",
    cajero: "caja.html"
  };
  return rutas[rol] ?? "index.html";
}