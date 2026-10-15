export function redondear(valor) {
    return Math.round(valor * 100) / 100;
  }
  
  export function formatearSoles(monto) {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(monto);
  }
  
  export const marcado = (valor) => valor === "on";
  
  export function calcularMontoServicio(d) {
    const modulos = ["modulo_ventas", "modulo_planilla", "modulo_almacen"]
      .filter((m) => marcado(d[m])).length;
    return redondear(350.00 * modulos + 150.00 * (Number(d.sucursales_adicionales) || 0));
  }