"use strict";

/* ===== Reglas de negocio (ajustables) ===== */
const MAX_EQUIPOS = 20;
const MAX_DIAS = 30;
const MAX_DIAS_ADICIONALES = 30;
const PRECIO_DIA = 35000;          // valor por equipo por día
const MIN_EQUIPOS = 2;
const MIN_PALABRAS_NOMBRE = 3; // palabras mínimas entre nombre y apellidos
const RECARGO_FUERA_CIUDAD = 0.05; // +5 %
const DESCUENTO_ESTABLECIMIENTO = 0.05; // -5 %

/* Regla mejorada de días adicionales:
   - El 2 % de descuento se acumula por cada día adicional (2 %, 4 %, 6 %...)
   - Se aplica SOLO al valor de los días adicionales (no a los días iniciales)
   - Tiene un tope máximo del 10 %, para que el descuento nunca crezca sin límite
     y la empresa no pierda dinero en alquileres muy largos. */
const DESC_POR_DIA_ADICIONAL = 0.02;
const DESC_MAX_ADICIONAL = 0.10;

const OPCIONES = {
  1: "Dentro de la ciudad",
  2: "Fuera de la ciudad",
  3: "Dentro del establecimiento"
};

const $ = (id) => document.getElementById(id);
const moneda = (n) => "$" + Math.round(n).toLocaleString("es-CO");
const porcentaje = (n) => (n * 100).toFixed(0) + "%";

/* ===== Id-cliente consecutivo ===== */
function siguienteId(avanzar) {
  let n = 1;
  try { n = parseInt(localStorage.getItem("alquipc_consecutivo") || "1", 10); } catch (e) {}
  if (avanzar) {
    try { localStorage.setItem("alquipc_consecutivo", String(n + 1)); } catch (e) {}
  }
  return "ALQ-" + String(n).padStart(4, "0");
}

/* ===== Cálculo ===== */
function calcular(equipos, dias, adicionales, opcion) {
  const valorBase = equipos * dias * PRECIO_DIA;
  const valorAdic = equipos * adicionales * PRECIO_DIA;

  const tasaDescAdic = Math.min(adicionales * DESC_POR_DIA_ADICIONAL, DESC_MAX_ADICIONAL);
  const descAdic = valorAdic * tasaDescAdic;

  const subtotal = valorBase + valorAdic - descAdic;

  let ajuste = 0;
  if (opcion === 2) ajuste = subtotal * RECARGO_FUERA_CIUDAD;
  if (opcion === 3) ajuste = -subtotal * DESCUENTO_ESTABLECIMIENTO;

  return { valorBase, valorAdic, tasaDescAdic, descAdic, subtotal, ajuste, total: subtotal + ajuste };
}

/* ===== Validación ===== */
const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/;

function palabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean);
}

function validar(d) {
  const pNombre = palabras(d.nombre);
  const pApellidos = palabras(d.apellidos);
  if (!pNombre.length) return "Escribe el nombre del cliente.";
  if (!pApellidos.length) return "Escribe los apellidos del cliente.";
  if (![...pNombre, ...pApellidos].every((p) => SOLO_LETRAS.test(p)))
    return "El nombre y los apellidos solo pueden tener letras y espacios.";
  if (pNombre.length + pApellidos.length < MIN_PALABRAS_NOMBRE)
    return `El nombre y los apellidos deben sumar al menos ${MIN_PALABRAS_NOMBRE} palabras (por ejemplo: un nombre y dos apellidos).`;
  if (!/^(\d{7}|\d{10})$/.test(d.telefono))
    return "El teléfono debe tener 7 dígitos (fijo) o 10 dígitos (celular), sin espacios ni símbolos.";
  if (!/^\S+@\S+\.\S+$/.test(d.correo)) return "Escribe un correo electrónico válido.";
    if (!Number.isInteger(d.equipos) || d.equipos < MIN_EQUIPOS || d.equipos > MAX_EQUIPOS)
    return `El número de equipos debe estar entre ${MIN_EQUIPOS} y ${MAX_EQUIPOS}.`;
  if (!Number.isInteger(d.dias) || d.dias < 1 || d.dias > MAX_DIAS)
    return `Los días iniciales deben estar entre 1 y ${MAX_DIAS}.`;
  if (!Number.isInteger(d.adicionales) || d.adicionales < 0 || d.adicionales > MAX_DIAS_ADICIONALES)
    return `Los días adicionales deben estar entre 0 y ${MAX_DIAS_ADICIONALES}.`;
  return "";
}

/* ===== Resumen ===== */
let textoResumen = "";

function lineas(d, r) {
  const l = [
    ["Opción de alquiler", OPCIONES[d.opcion], ""],
    ["Equipos alquilados", String(d.equipos), ""],
    ["Días iniciales", String(d.dias), ""],
    ["Días adicionales", String(d.adicionales), ""],
    ["Valor días iniciales", moneda(r.valorBase), ""]
  ];
  if (d.adicionales > 0) {
    l.push(["Valor días adicionales", moneda(r.valorAdic), ""]);
    l.push([`Descuento por días adicionales (${porcentaje(r.tasaDescAdic)})`, "−" + moneda(r.descAdic), "menos"]);
  }
  l.push(["Subtotal", moneda(r.subtotal), ""]);
  if (d.opcion === 2) l.push([`Incremento por domicilio (${porcentaje(RECARGO_FUERA_CIUDAD)})`, "+" + moneda(r.ajuste), "mas"]);
  if (d.opcion === 3) l.push([`Descuento por alquiler en establecimiento (${porcentaje(DESCUENTO_ESTABLECIMIENTO)})`, "−" + moneda(-r.ajuste), "menos"]);
  if (d.opcion === 1) l.push(["Descuentos o incrementos por opción", "Ninguno", ""]);
  return l;
}

function mostrar(d, r) {
  const ls = lineas(d, r);
  const dl = $("detalle");
  dl.innerHTML = "";
  ls.forEach(([t, v, c]) => {
    const div = document.createElement("div");
    div.className = "linea " + c;
    const dt = document.createElement("dt"); dt.textContent = t;
    const dd = document.createElement("dd"); dd.textContent = v;
    div.append(dt, dd);
    dl.appendChild(div);
  });
  $("total").textContent = moneda(r.total);

  textoResumen =
    `ALQUIPC - Resumen de alquiler\n` +
    `Id-cliente: ${d.id}\nCliente: ${d.nombre} ${d.apellidos}\nTeléfono: ${d.telefono}\n\n` +
    ls.map(([t, v]) => `${t}: ${v}`).join("\n") +
    `\n\nTOTAL A PAGAR: ${moneda(r.total)}\n\nGracias por elegir ALQUIPC.`;

  $("btnCorreo").href = "mailto:" + encodeURIComponent(d.correo) +
    "?subject=" + encodeURIComponent(`ALQUIPC - Resumen de alquiler ${d.id}`) +
    "&body=" + encodeURIComponent(textoResumen);

  $("vacio").hidden = true;
  $("factura").hidden = false;
  $("aviso").hidden = true;
}

/* ===== Eventos ===== */
$("idCliente").textContent = siguienteId(false);

$("formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = {
    id: $("idCliente").textContent,
    nombre: $("nombre").value,
    apellidos: $("apellidos").value,
    telefono: $("telefono").value.trim(),
    correo: $("correo").value.trim(),
    equipos: Number($("equipos").value),
    dias: Number($("dias").value),
    adicionales: Number($("adicionales").value || 0),
    opcion: Number(document.querySelector('input[name="opcion"]:checked').value)
  };
  const msg = validar(d);
  const err = $("error");
  if (msg) {
    err.textContent = msg; err.hidden = false;
    $("factura").hidden = true; $("vacio").hidden = false;
    return;
  }
  err.hidden = true;
  mostrar(d, calcular(d.equipos, d.dias, d.adicionales, d.opcion));
});

$("btnLimpiar").addEventListener("click", () => {
  // Al iniciar un nuevo cliente se avanza el consecutivo
  siguienteId(true);
  setTimeout(() => {
    $("idCliente").textContent = siguienteId(false);
    $("factura").hidden = true; $("vacio").hidden = false; $("error").hidden = true;
  }, 0);
});

$("btnCopiar").addEventListener("click", async () => {
  const aviso = $("aviso");
  try {
    await navigator.clipboard.writeText(textoResumen);
    aviso.textContent = "Resumen copiado.";
  } catch (e) {
    aviso.textContent = "No se pudo copiar. Usa «Enviar por correo».";
  }
  aviso.hidden = false;
});

$("telefono").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "");
});
