import { sql } from "../config/neon-config.js";
import { exigirRol, cerrarSesion } from "../auth/auth.js";
import { formatearSoles } from "../registro/tarifario.js";

const usuario = exigirRol("cliente");
if (usuario) iniciar();

async function listarPropios() {
  return await sql`
    SELECT r.id, r.codigo_seguimiento, r.nombre_empresa, r.tamano_empresa, r.correo,
           r.estado, r.estado_pago, r.monto_calculado, p.codigo_operacion
    FROM solicitudes_demo_erp r
    LEFT JOIN pagos p ON p.id_registro = r.id AND p.estado = 'aprobado'
    WHERE r.id_usuario = ${usuario.id}
    ORDER BY r.id DESC`;
}

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto ?? "—";
  return td;
}

function enlace(texto, href) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = texto;
  a.className = "boton-editar";
  return a;
}

const ETIQUETA_PAGO = { pendiente: "Pendiente", pagado: "Pagado", exonerado: "Exonerado" };

async function iniciar() {
  const cuerpo = document.getElementById("tabla-cuerpo");
  const mensaje = document.getElementById("mensaje-consulta");

  document.getElementById("btn-salir").addEventListener("click", (e) => {
    e.preventDefault();
    cerrarSesion();
    window.location.href = "login.html";
  });

  try {
    const filas = await listarPropios();

    if (filas.length === 0) {
      mensaje.textContent = "Todavía no tienes solicitudes registradas.";
      return;
    }

    for (const f of filas) {
      const tr = document.createElement("tr");
      tr.append(
        celda(f.codigo_seguimiento), celda(f.nombre_empresa),
        celda(f.tamano_empresa), celda(f.correo), celda(f.estado),
        celda(formatearSoles(Number(f.monto_calculado))),
        celda(ETIQUETA_PAGO[f.estado_pago] ?? f.estado_pago)
      );

      const tdAccion = document.createElement("td");

      if (f.estado_pago === "pendiente") {
        tdAccion.append(enlace("Pagar", "pago.html?id=" + f.id));
        if (f.estado === "registrado") {
          tdAccion.append(enlace("Editar", "actualizar.html?id=" + f.id));
        }
      } else if (f.estado_pago === "pagado") {
        tdAccion.append(
          enlace("Ver comprobante", "comprobante.html?op=" + encodeURIComponent(f.codigo_operacion))
        );
      } else {
        tdAccion.textContent = "Exonerado";
      }

      tr.append(tdAccion);
      cuerpo.append(tr);
    }
  } catch (error) {
    console.error(error);
    mensaje.textContent = "No se pudieron cargar tus solicitudes.";
  }
}