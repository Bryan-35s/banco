// 1) Pegue aquí la URL de su Apps Script (Implementar > Aplicación web)
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbwFC4pMm-BbDb6s45MLMsn8hh5C8MuiiisktwVdGXSqRZvNEtHBjW9C53QI8a46dl3H/exec";

const form = document.getElementById("formulario");
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (sel) => [...form.querySelectorAll(sel)].reduce((t, i) => t + (parseFloat(i.value) || 0), 0);
let charts = {};

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
    if (!rows.length) return;
    dibujar(rows);
  } catch (e) { /* sin datos todavía */ }
}

function dibujar(rows) {
  const azul = "#1F5FBF", amarillo = "#FFC72C";
  Object.values(charts).forEach((c) => c.destroy());
  charts.a = new Chart($("chIngGas"), {
    type: "bar",
    data: { labels: rows.map((r) => r.nombre), datasets: [
      { label: "Ingresos", data: rows.map((r) => r.totalIngresos), backgroundColor: azul },
      { label: "Gastos", data: rows.map((r) => r.totalGastos), backgroundColor: amarillo }] },
    options: { plugins: { title: { display: true, text: "Ingresos vs gastos por persona" } } }
  });
  const prom = CATS.map((c) => rows.reduce((t, r) => t + Number(r[c] || 0), 0) / rows.length);
  charts.b = new Chart($("chCat"), {
    type: "doughnut",
    data: { labels: NOMBRES, datasets: [{ data: prom, backgroundColor: ["#0B2A5B", "#1F5FBF", "#5B8DE0", "#9DBCF0", "#FFC72C", "#FFD964", "#E0A800", "#7A8CA8", "#B3261E"] }] },
    options: { plugins: { title: { display: true, text: "Gasto promedio por categoría" } } }
  });
  $("tabla").querySelector("thead").innerHTML = "<tr><th>Nombre</th><th>Hogar</th><th>Ocupación</th><th>Ingresos</th><th>Gastos</th><th>Disponible</th></tr>";
  $("tabla").querySelector("tbody").innerHTML = rows.map((r) =>
    `<tr><td>${r.nombre}</td><td>${r.personas}</td><td>${r.ocupacion}</td><td>${money(r.totalIngresos)}</td><td>${money(r.totalGastos)}</td><td>${money(r.disponible)}</td></tr>`).join("");
}

calcular();
cargarResultados();