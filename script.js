// 1) Pegue aquí la URL de su Apps Script (Implementar > Aplicación web)
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbwFC4pMm-BbDb6s45MLMsn8hh5C8MuiiisktwVdGXSqRZvNEtHBjW9C53QI8a46dl3H/exec";

const form = document.getElementById("formulario");
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const sum = (sel) => [...form.querySelectorAll(sel)].reduce((t, i) => t + (parseInt(i.value, 10) || 0), 0);
let charts = {};
let todas = [];

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

function calcular() {
  const ing = sum(".ing"), gas = sum(".gas"), disp = ing - gas;
  $("tIng").textContent = money(ing);
  $("tGas").textContent = money(gas);
  $("tDisp").textContent = money(disp);
  $("boxDisp").classList.toggle("neg", disp < 0);
  return { ing, gas, disp };
}

form.addEventListener("input", calcular);
$("borrar").addEventListener("click", () => {
  if (!confirm("¿Borrar todos los datos que ha escrito en el formulario?")) return;
  form.reset();
  $("cantDep").hidden = true;
  calcular();
  toast("Formulario limpio.");
});
form.dependientes.addEventListener("change", () => {
  const si = form.dependientes.value === "Sí";
  $("cantDep").hidden = !si;
  form.cantDependientes.required = si;
  if (!si) form.cantDependientes.value = "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { ing, gas, disp } = calcular();
  const d = Object.fromEntries(new FormData(form));
  d.totalIngresos = ing; d.totalGastos = gas; d.disponible = disp;
  const btn = $("guardar");
  btn.disabled = true; btn.textContent = "Guardando...";
  try {
    // text/plain evita el bloqueo CORS con Apps Script
    await fetch(URL_SCRIPT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(d) });
    form.reset();
    $("cantDep").hidden = true;
    calcular();
    toast("Respuestas guardadas. Puede ingresar a otra persona.");
    setTimeout(cargarResultados, 2500);
  } catch (err) {
    toast("No se pudo guardar. Revise la URL del Apps Script.");
  }
  btn.disabled = false; btn.textContent = "Guardar respuestas";
});

const CATS = ["alimentacion", "alquiler", "transporte", "educacion", "agua", "energia", "internet", "salud", "deudas"];
const NOMBRES = ["Alimentación", "Alquiler", "Transporte", "Educación", "Agua", "Energía", "Internet y tel.", "Salud", "Deudas"];

async function cargarResultados() {
  if (URL_SCRIPT.startsWith("PEGUE")) return;
  try {
    const r = await fetch(URL_SCRIPT + "?accion=datos");
    const rows = await r.json();
    todas = rows;
    llenarSelector();
    if (!rows.length) return limpiar();
    dibujar(filtrar());
  } catch (e) { /* sin datos todavía */ }
}

function filtrar() {
  const v = $("verPersona").value;
  return v === "todas" ? todas : todas.filter((r) => String(r.fila) === v);
}

function llenarSelector() {
  const sel = $("verPersona"), actual = sel.value;
  sel.innerHTML = "";
  sel.add(new Option("Todas las personas (" + todas.length + ")", "todas"));
  todas.forEach((r) => sel.add(new Option(r.nombre, r.fila)));
  sel.value = [...sel.options].some((o) => o.value === actual) ? actual : "todas";
}

$("verPersona").addEventListener("change", () => dibujar(filtrar()));

function limpiar() {
  Object.values(charts).forEach((c) => c.destroy());
  charts = {};
  $("tabla").querySelector("thead").innerHTML = "";
  $("tabla").querySelector("tbody").innerHTML = "";
}

async function eliminar(fila, nombre) {
  if (!confirm("¿Eliminar a " + nombre + "? Se borrará su fila y su pestaña en el Sheet. No se puede deshacer.")) return;
  try {
    await fetch(URL_SCRIPT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ accion: "eliminar", fila, nombre }) });
    $("verPersona").value = "todas";
    toast("Registro eliminado.");
    setTimeout(cargarResultados, 2500);
  } catch (err) {
    toast("No se pudo eliminar. Revise la conexión.");
  }
}

$("tabla").addEventListener("click", (e) => {
  const b = e.target.closest(".del");
  if (b) eliminar(Number(b.dataset.fila), b.dataset.nombre);
});

function dibujar(rows) {
  const azul = "#1F5FBF", amarillo = "#FFC72C";
  Object.values(charts).forEach((c) => c.destroy());
  charts.a = new Chart($("chIngGas"), {
    type: "bar",
    data: { labels: rows.map((r) => r.nombre), datasets: [
      { label: "Ingresos", data: rows.map((r) => Math.round(r.totalIngresos)), backgroundColor: azul },
      { label: "Gastos", data: rows.map((r) => Math.round(r.totalGastos)), backgroundColor: amarillo }] },
    options: { scales: { y: { ticks: { precision: 0, callback: (v) => "$" + v.toLocaleString("en-US") } } }, plugins: { title: { display: true, text: rows.length === 1 ? "Ingresos vs gastos" : "Ingresos vs gastos por persona" }, tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + money(c.parsed.y) } } } }
  });
  const prom = CATS.map((c) => Math.round(rows.reduce((t, r) => t + Number(r[c] || 0), 0) / rows.length));
  charts.b = new Chart($("chCat"), {
    type: "doughnut",
    data: { labels: NOMBRES, datasets: [{ data: prom, backgroundColor: ["#0B2A5B", "#1F5FBF", "#5B8DE0", "#9DBCF0", "#FFC72C", "#FFD964", "#E0A800", "#7A8CA8", "#B3261E"] }] },
    options: { plugins: { title: { display: true, text: rows.length === 1 ? "Gastos por categoría" : "Gasto promedio por categoría" }, tooltip: { callbacks: { label: (c) => c.label + ": " + money(c.parsed) } } } }
  });
  $("tabla").querySelector("thead").innerHTML = "<tr><th>Nombre</th><th>Hogar</th><th>Ocupación</th><th>Ingresos</th><th>Gastos</th><th>Disponible</th><th></th></tr>";
  $("tabla").querySelector("tbody").innerHTML = rows.map((r) =>
    `<tr><td>${r.nombre}</td><td>${r.personas}</td><td>${r.ocupacion}</td><td>${money(r.totalIngresos)}</td><td>${money(r.totalGastos)}</td><td>${money(r.disponible)}</td><td><button type="button" class="del" data-fila="${r.fila}" data-nombre="${String(r.nombre).replace(/"/g, '&quot;')}">Eliminar</button></td></tr>`).join("");
}

calcular();
cargarResultados();
