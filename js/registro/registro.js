import { sql } from "../config/neon-config.js";
import { exigirRol, cerrarSesion } from "../auth/auth.js";
import { calcularMontoServicio, formatearSoles, marcado } from "./tarifario.js";

const usuario = exigirRol("cliente");

if (usuario) {
  const form = document.getElementById("form-demo");
  const mensaje = document.getElementById("mensaje-demo");
  const salidaMonto = document.getElementById("monto-estimado");

  document.getElementById("btn-salir").addEventListener("click", (e) => {
    e.preventDefault();
    cerrarSesion();
    window.location.href = "login.html";
  });

  const leerFormulario = () => Object.fromEntries(new FormData(form));

  const hayModulo = (d) =>
    marcado(d.modulo_ventas) || marcado(d.modulo_planilla) || marcado(d.modulo_almacen);

  function actualizarCotizacion() {
    salidaMonto.textContent = formatearSoles(calcularMontoServicio(leerFormulario()));
  }

  form.addEventListener("input", actualizarCotizacion);   
  form.addEventListener("change", actualizarCotizacion);  
  actualizarCotizacion();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const datos = leerFormulario();

    if (!hayModulo(datos)) {
      mensaje.textContent = "Selecciona al menos un módulo para continuar.";
      return;
    }

    const monto = calcularMontoServicio(datos);   
    const estadoPago = monto === 0 ? "exonerado" : "pendiente";
    const codigo = "COD-" + Date.now().toString().slice(-8);
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    mensaje.textContent = "";

    try {
      const filas = await sql`
        INSERT INTO solicitudes_demo_erp
          (codigo_seguimiento, nombre_empresa, tamano_empresa, correo, id_usuario,
           modulo_ventas, modulo_planilla, modulo_almacen, sucursales_adicionales,
           monto_calculado, estado_pago, estado)
        VALUES (${codigo}, ${datos.empresa.trim()}, ${datos.tamano}, ${datos.correo.trim()}, ${usuario.id},
                ${marcado(datos.modulo_ventas)}, ${marcado(datos.modulo_planilla)},
                ${marcado(datos.modulo_almacen)}, ${Number(datos.sucursales_adicionales) || 0},
                ${monto}, ${estadoPago}, 'registrado')
        RETURNING id`;

      if (estadoPago === "pendiente") {
        window.location.href = "pago.html?id=" + filas[0].id;
      } else {
        mensaje.textContent = "Solicitud " + codigo + " registrada. Tu trámite está exonerado de pago.";
        form.reset();
        actualizarCotizacion();
        boton.disabled = false;
      }
    } catch (error) {
      console.error(error);
      mensaje.textContent = "No se pudo registrar la solicitud. Intenta nuevamente.";
      boton.disabled = false;
    }
  });
}