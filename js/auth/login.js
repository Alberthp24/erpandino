import { registrarUsuario, iniciarSesion, rutaInicioSegunRol } from "./auth.js";

const formRegistro = document.getElementById("form-registro");
const formLogin = document.getElementById("form-login");

formRegistro.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nombre = document.getElementById("nombre").value.trim();
  const correo = document.getElementById("correo-registro").value.trim();
  const contrasena = document.getElementById("contrasena-registro").value;
  const mensaje = document.getElementById("mensaje-registro");

  try {
    await registrarUsuario(nombre, correo, contrasena);
    mensaje.textContent = "Cuenta creada correctamente. Ahora puedes iniciar sesión.";
    formRegistro.reset();
  } catch (error) {
    console.error(error);
    mensaje.textContent = "No se pudo crear la cuenta. El correo puede estar registrado.";
  }
});

formLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  const correo = document.getElementById("correo-login").value.trim();
  const contrasena = document.getElementById("contrasena-login").value;
  const mensaje = document.getElementById("mensaje-login");

  try {
    const usuario = await iniciarSesion(correo, contrasena);
    if (!usuario) {
      mensaje.textContent = "Correo o contraseña incorrectos.";
      return;
    }
    window.location.href = rutaInicioSegunRol(usuario.rol);
  } catch (error) {
    console.error(error);
    mensaje.textContent = "Ocurrió un error al iniciar sesión.";
  }
});