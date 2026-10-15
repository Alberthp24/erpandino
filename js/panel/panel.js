import { sql } from "../config/neon-config.js";
import { exigirRol, cerrarSesion } from "../auth/auth.js";
import { calcularMontoServicio, formatearSoles, marcado } from "../registro/tarifario.js";

const usuario = exigirRol("administrador", "empleado");
if (usuario) iniciarPanel();

async function listarTodos() {
  return await sql`SELECT * FROM solicitudes_demo_erp ORDER BY id DESC`;
}

async function crearRegistro(d) {
  const codigo = "COD-" + Date.now().toString().slice(-8);
  const monto = calcularMontoServicio(d);
  await sql`
    INSERT INTO solicitudes_demo_erp
      (codigo_seguimiento, nombre_empresa, tamano_empresa, correo,
       modulo_ventas, modulo_planilla, modulo_almacen, sucursales_adicionales,
       monto_calculado, estado_pago, estado)
    VALUES (${codigo}, ${d.nombre_empresa}, ${d.tamano_empresa}, ${d.correo},
            ${marcado(d.modulo_ventas)}, ${marcado(d.modulo_planilla)}, ${marcado(d.modulo_almacen)},
            ${Number(d.sucursales_adicionales) || 0},
            ${monto}, ${monto === 0 ? "exonerado" : "pendiente"}, 'registrado')`;
  return codigo;   
}

async function actualizarComoPanel(id, d) {
  const monto = calcularMontoServicio(d);
  await sql.transaction([
    sql`UPDATE solicitudes_demo_erp
        SET nombre_empresa = ${d.nombre_empresa},
            tamano_empresa = ${d.tamano_empresa},
            correo = ${d.correo},
            estado = ${d.estado}
        WHERE id = ${id}`,
    sql`UPDATE solicitudes_demo_erp
        SET modulo_ventas = ${marcado(d.modulo_ventas)},
            modulo_planilla = ${marcado(d.modulo_planilla)},
            modulo_almacen = ${marcado(d.modulo_almacen)},
            sucursales_adicionales = ${Number(d.sucursales_adicionales) || 0},
            monto_calculado = ${monto},
            estado_pago = ${monto === 0 ? "exonerado" : "pendiente"}
        WHERE id = ${id} AND estado_pago <> 'pagado'`
  ]);
}

async function eliminarRegistro(id) {
  try {
    await sql`DELETE FROM solicitudes_demo_erp WHERE id = ${id}`;
    return { ok: true };
  } catch (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        mensaje: "No se puede eliminar: tiene historial de pagos. Cambie su estado a \"rechazado\"."
      };
    }
    throw error;
  }
}

function iniciarPanel() {
  const cuerpo = document.getElementById("tabla-cuerpo");
  const form = document.getElementById("form-panel");
  const mensaje = document.getElementById("mensaje-panel");
  const campoId = document.getElementById("registro-id");
  const btnGuardar = document.getElementById("btn-guardar");
  const btnCancelar = document.getElementById("btn-cancelar");
  const tituloForm = document.getElementById("titulo-form");
  const grupoTarifa = document.getElementById("grupo-tarifa");
  const salidaMonto = document.getElementById("monto-estimado");

  document.getElementById("usuario-activo").textContent =
    usuario.nombre + " (" + usuario.rol + ")";

  if (usuario.rol === "administrador") {
    document.getElementById("enlace-caja").hidden = false;
  }

  document.getElementById("btn-salir")?.addEventListener("click", () => {
    cerrarSesion();
    window.location.href = "login.html";
  });

  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
  }

  function leerDatos() {
    const check = (id) => (document.getElementById(id).checked ? "on" : "");
    return {
      nombre_empresa: document.getElementById("empresa").value.trim(),
      correo: document.getElementById("correo").value.trim(),
      tamano_empresa: document.getElementById("tamano").value,
      estado: document.getElementById("estado").value,
      modulo_ventas: check("modulo_ventas"),
      modulo_planilla: check("modulo_planilla"),
      modulo_almacen: check("modulo_almacen"),
      sucursales_adicionales: document.getElementById("sucursales").value,
    };
  }

  const hayModulo = (d) =>
    marcado(d.modulo_ventas) || marcado(d.modulo_planilla) || marcado(d.modulo_almacen);

  function actualizarCotizacion() {
    salidaMonto.textContent = formatearSoles(calcularMontoServicio(leerDatos()));
  }

  form.addEventListener("input", actualizarCotizacion);
  form.addEventListener("change", actualizarCotizacion);

  function celda(texto) {
    const td = document.createElement("td");
    td.textContent = texto ?? "—";
    return td;
  }

  function textoPago(f) {
    if (f.estado_pago === "pagado") {
      return "Pagado (" + (f.canal_pago === "pasarela" ? "en línea" : "caja") + ")";
    }
    return f.estado_pago === "exonerado" ? "Exonerado" : "Pendiente";
  }

  async function cargarTabla() {
    const filas = await listarTodos();
    cuerpo.replaceChildren();

    for (const f of filas) {
      const tr = document.createElement("tr");
      tr.append(
        celda(f.codigo_seguimiento),
        celda(f.nombre_empresa),
        celda(f.tamano_empresa),
        celda(f.correo),
        celda(f.estado),
        celda(formatearSoles(Number(f.monto_calculado))),
        celda(textoPago(f)),
        celda(f.id_usuario)
      );

      const acciones = document.createElement("td");

      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => prepararEdicion(f));

      const btnEliminar = document.createElement("button");
      btnEliminar.type = "button";
      btnEliminar.textContent = "Eliminar";
      btnEliminar.addEventListener("click", async () => {
        if (!confirm("¿Eliminar la solicitud " + f.codigo_seguimiento + "?")) return;
        try {
          const resultado = await eliminarRegistro(f.id);
          if (!resultado.ok) {
            mostrarMensaje(resultado.mensaje);
            return;
          }
          mostrarMensaje("Solicitud eliminada correctamente.");
          await cargarTabla();
        } catch (e) {
          console.error(e);
          mostrarMensaje("No se pudo eliminar.");
        }
      });

      acciones.append(btnEditar, btnEliminar);
      tr.append(acciones);
      cuerpo.append(tr);
    }
  }

  function prepararEdicion(f) {
    campoId.value = f.id;
    document.getElementById("empresa").value = f.nombre_empresa;
    document.getElementById("correo").value = f.correo;
    document.getElementById("tamano").value = f.tamano_empresa;
    document.getElementById("estado").value = f.estado;
    document.getElementById("modulo_ventas").checked = f.modulo_ventas;
    document.getElementById("modulo_planilla").checked = f.modulo_planilla;
    document.getElementById("modulo_almacen").checked = f.modulo_almacen;
    document.getElementById("sucursales").value = f.sucursales_adicionales;

    grupoTarifa.disabled = f.estado_pago === "pagado";
    actualizarCotizacion();
    if (grupoTarifa.disabled) {
      mostrarMensaje("Solicitud pagada: la cuota no se puede modificar.");
    }

    tituloForm.textContent = "Editar solicitud " + f.codigo_seguimiento;
    btnGuardar.textContent = "Guardar cambios";
    btnCancelar.hidden = false;
    form.scrollIntoView({ behavior: "smooth" });
  }

  function salirDeEdicion() {
    form.reset();
    grupoTarifa.disabled = false;
    campoId.value = "";
    tituloForm.textContent = "Nueva solicitud";
    btnGuardar.textContent = "Crear";
    btnCancelar.hidden = true;
    actualizarCotizacion();
  }

  btnCancelar.addEventListener("click", () => {
    salirDeEdicion();
    mostrarMensaje("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const datos = leerDatos();

    if (!grupoTarifa.disabled && !hayModulo(datos)) {
      mostrarMensaje("Selecciona al menos un módulo para continuar.");
      return;
    }

    try {
      if (campoId.value) {
        await actualizarComoPanel(Number(campoId.value), datos);
        mostrarMensaje("Solicitud actualizada correctamente.");
      } else {
        const codigo = await crearRegistro(datos);
        mostrarMensaje("Solicitud creada. Código: " + codigo);
      }
      salirDeEdicion();
      await cargarTabla();
    } catch (e) {
      console.error(e);
      mostrarMensaje("No se pudo guardar la solicitud.");
    }
  });

  actualizarCotizacion();
  cargarTabla().catch((e) => {
    console.error(e);
    mostrarMensaje("No se pudieron cargar las solicitudes.");
  });
}