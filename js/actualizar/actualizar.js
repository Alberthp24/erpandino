import { sql } from "../config/neon-config.js";
import { exigirRol, cerrarSesion } from "../auth/auth.js";
import { calcularMontoServicio, formatearSoles, marcado } from "../registro/tarifario.js";

const usuario = exigirRol("cliente");
if (usuario) iniciar();

async function obtenerRegistro(id) {
  const filas = await sql`
    SELECT id, codigo_seguimiento, nombre_empresa, tamano_empresa, correo, estado, estado_pago,
           modulo_ventas, modulo_planilla, modulo_almacen, sucursales_adicionales, monto_calculado
    FROM solicitudes_demo_erp
    WHERE id = ${id} AND id_usuario = ${usuario.id}`;
  return filas[0] ?? null;
}

// Devuelve true si se actualizó; false si no existe, no es del usuario, ya fue atendida o ya fue pagada
async function actualizarRegistro(id, datos) {
  const monto = calcularMontoServicio(datos);
  const filas = await sql`
    UPDATE solicitudes_demo_erp
    SET nombre_empresa = ${datos.empresa.trim()},
        tamano_empresa = ${datos.tamano},
        correo = ${datos.correo.trim()},
        modulo_ventas = ${marcado(datos.modulo_ventas)},
        modulo_planilla = ${marcado(datos.modulo_planilla)},
        modulo_almacen = ${marcado(datos.modulo_almacen)},
        sucursales_adicionales = ${Number(datos.sucursales_adicionales) || 0},
        monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? "exonerado" : "pendiente"}
    WHERE id = ${id} AND id_usuario = ${usuario.id}
      AND estado = 'registrado' AND estado_pago <> 'pagado'
    RETURNING id`;
  return filas.length === 1;
}

async function iniciar() {
  const form = document.getElementById("form-actualizar");
  const mensaje = document.getElementById("mensaje-actualizar");
  const btnGuardar = document.getElementById("btn-guardar");
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

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  if (!id) {
    form.hidden = true;
    mensaje.textContent = "No se indicó qué solicitud editar.";
    return;
  }

  try {
    const registro = await obtenerRegistro(id);

    if (!registro) {
      form.hidden = true;
      mensaje.textContent = "No se encontró esa solicitud.";
      return;
    }

    document.getElementById("codigo-registro").textContent =
      "Código: " + registro.codigo_seguimiento + " · Estado: " + registro.estado +
      " · Pago: " + registro.estado_pago;
    document.getElementById("empresa").value = registro.nombre_empresa;
    document.getElementById("correo").value = registro.correo;
    document.getElementById("tamano").value = registro.tamano_empresa;
    document.getElementById("modulo_ventas").checked = registro.modulo_ventas;
    document.getElementById("modulo_planilla").checked = registro.modulo_planilla;
    document.getElementById("modulo_almacen").checked = registro.modulo_almacen;
    document.getElementById("sucursales").value = registro.sucursales_adicionales;
    actualizarCotizacion();

    if (registro.estado_pago === "pagado" || registro.estado !== "registrado") {
      form.querySelectorAll("input, select").forEach((campo) => (campo.disabled = true));
      btnGuardar.hidden = true;
      mensaje.textContent = registro.estado_pago === "pagado"
        ? "Esta solicitud ya fue pagada y no se puede editar."
        : "Esta solicitud ya fue atendida y no se puede editar.";
      return;
    }

    form.addEventListener("input", actualizarCotizacion);
    form.addEventListener("change", actualizarCotizacion);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const datos = leerFormulario();

      if (!hayModulo(datos)) {
        mensaje.textContent = "Selecciona al menos un módulo para continuar.";
        return;
      }

      try {
        const ok = await actualizarRegistro(id, datos);
        mensaje.textContent = ok
          ? "Solicitud actualizada correctamente. Nueva cuota: " +
            formatearSoles(calcularMontoServicio(datos)) + "."
          : "No se pudo actualizar: la solicitud ya fue pagada o atendida.";
      } catch (error) {
        console.error(error);
        mensaje.textContent = "No se pudo actualizar la solicitud.";
      }
    });
  } catch (error) {
    console.error(error);
    form.hidden = true;
    mensaje.textContent = "No se pudo cargar la solicitud.";
  }
}