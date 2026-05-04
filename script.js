'use strict';

// --- Utilidades ---

function add(simbolo) {
  const input = document.getElementById('expresion');
  input.value += simbolo;
  input.focus();
}

function borrar() {
  const input = document.getElementById('expresion');
  // Eliminar el último carácter (respeta emojis/símbolos Unicode)
  const val = input.value;
  if (!val) return;
  // Usa spread para manejar correctamente caracteres multibyte
  const chars = [...val];
  chars.pop();
  input.value = chars.join('');
  input.focus();
}

// Enter para calcular
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('expresion').addEventListener('keydown', e => {
    if (e.key === 'Enter') resolver();
  });
});

// --- Detección de variables ---

function detectarVariables(expr) {
  const matches = expr.match(/\b[a-zA-Z]\b/g);
  if (!matches) return [];
  // Ordenadas alfabéticamente, sin duplicados
  return [...new Set(matches)].sort();
}

// --- Conversión segura de expresión ---

/**
 * Convierte una expresión lógica simbólica a JavaScript evaluable,
 * reemplazando los operadores y sustituyendo variables por sus valores booleanos.
 * No hace eval() de input crudo del usuario.
 */
function convertir(expr, variables, valores) {

  // 1. Sustituir variables por sus valores booleanos (más largas primero para evitar colisiones)
  const varsOrdenadas = [...variables].sort((a, b) => b.length - a.length);
  for (const v of varsOrdenadas) {
    const regex = new RegExp('\\b' + escapeRegex(v) + '\\b', 'g');
    expr = expr.replace(regex, valores[v] ? 'true' : 'false');
  }

  // 2. Convertir operadores simbólicos
  expr = expr.replace(/∧/g, '&&');
  expr = expr.replace(/∨/g, '||');
  expr = expr.replace(/¬/g, '!');

  // XOR (⊕): A ⊕ B  →  (A !== B)
  // Aplicar mientras existan (puede haber varios)
  expr = reemplazarBinario(expr, '⊕', (a, b) => `(${a} !== ${b})`);

  // Bicondicional (↔): A ↔ B  →  (A === B)
  expr = reemplazarBinario(expr, '↔', (a, b) => `(${a} === ${b})`);

  // Implicación (→): A → B  →  (!A || B)
  // La implicación es asociativa por la derecha: p → q → r = p → (q → r)
  // Se maneja de derecha a izquierda
  expr = reemplazarImplicacion(expr);

  return expr;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reemplaza un operador binario infix de manera iterativa.
 * Para operadores simples como ⊕ y ↔ entre dos operandos atómicos (true/false/paréntesis).
 */
function reemplazarBinario(expr, op, fn) {
  // Estrategia: buscar el operador y tomar lo que hay a cada lado
  // como operandos completos (respetando paréntesis)
  let i = 0;
  let limite = 20; // evitar bucle infinito
  while (expr.includes(op) && limite-- > 0) {
    const idx = expr.indexOf(op);
    const izq = extraerOperandoIzq(expr, idx);
    const der = extraerOperandoDer(expr, idx + op.length);
    const inicio = idx - izq.length;
    const fin = idx + op.length + der.length;
    expr = expr.slice(0, inicio) + fn(izq, der) + expr.slice(fin);
  }
  return expr;
}

/**
 * Maneja → con asociatividad derecha.
 * Busca la → más a la DERECHA para respetar p → q → r = p → (q → r).
 */
function reemplazarImplicacion(expr) {
  let limite = 20;
  while (expr.includes('→') && limite-- > 0) {
    const idx = expr.lastIndexOf('→');
    const izq = extraerOperandoIzq(expr, idx);
    const der = extraerOperandoDer(expr, idx + 1);
    const inicio = idx - izq.length;
    const fin = idx + 1 + der.length;
    expr = expr.slice(0, inicio) + `(!${izq} || ${der})` + expr.slice(fin);
  }
  return expr;
}

/**
 * Extrae el operando a la izquierda de una posición en la expresión.
 * Soporta paréntesis balanceados y tokens true/false/!.
 */
function extraerOperandoIzq(expr, pos) {
  let i = pos - 1;
  // Saltar espacios
  while (i >= 0 && expr[i] === ' ') i--;

  if (expr[i] === ')') {
    let depth = 1;
    i--;
    while (i >= 0 && depth > 0) {
      if (expr[i] === ')') depth++;
      else if (expr[i] === '(') depth--;
      i--;
    }
    i++;
    return expr.slice(i, pos).trim();
  }

  // Token: true, false
  const antes = expr.slice(0, pos).trimEnd();
  const match = antes.match(/(true|false)$/);
  if (match) return match[0];

  return expr.slice(0, pos).trim();
}

/**
 * Extrae el operando a la derecha de una posición en la expresión.
 */
function extraerOperandoDer(expr, pos) {
  let i = pos;
  while (i < expr.length && expr[i] === ' ') i++;

  let inicio = i;

  // Puede empezar con ! (not)
  while (i < expr.length && expr[i] === '!') i++;

  if (expr[i] === '(') {
    let depth = 1;
    i++;
    while (i < expr.length && depth > 0) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      i++;
    }
    return expr.slice(inicio, i);
  }

  // Token: true, false
  const resto = expr.slice(i);
  const match = resto.match(/^(true|false)/);
  if (match) return expr.slice(inicio, i + match[0].length);

  return expr.slice(inicio).trim();
}

// --- Validación ---

function validarExpresion(expr, variables, valores) {
  try {
    const converted = convertir(expr, variables, valores);
    // Solo debe contener: true, false, &&, ||, !, ==, !==, (, ), espacios
    const limpio = converted.replace(/\b(true|false)\b/g, '')
                            .replace(/&&|\|\||!==|===|!|\(|\)|\s/g, '');
    if (limpio.length > 0) {
      return { ok: false, msg: `Caracteres no permitidos en la expresión: "${limpio}"` };
    }
    // Intento de evaluación controlada
    // eslint-disable-next-line no-new-func
    new Function(`return (${converted})`)();
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: 'Expresión con sintaxis inválida. Revisa los paréntesis y operadores.' };
  }
}

// --- Evaluación ---

function evaluar(expr, variables, valores) {
  const converted = convertir(expr, variables, valores);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${converted})`)();
}

// --- Render ---

function mostrarError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

function limpiarError() {
  document.getElementById('error-msg').style.display = 'none';
}

function mostrarClasificacion(tipo) {
  const el = document.getElementById('clasificacion');
  el.className = 'clasificacion';
  el.style.display = 'flex';

  const cfg = {
    tautologia:    { cls: 'tautologia',    icon: '✓', txt: 'Tautología — siempre verdadera' },
    contradiccion: { cls: 'contradiccion', icon: '✗', txt: 'Contradicción — siempre falsa' },
    contingente:   { cls: 'contingente',   icon: '~', txt: 'Contingente — depende de los valores' },
  };

  const { cls, icon, txt } = cfg[tipo];
  el.classList.add(cls);
  el.innerHTML = `<span>${icon}</span><span>${txt}</span>`;
}

function resolver() {
  limpiarError();
  document.getElementById('clasificacion').style.display = 'none';
  document.getElementById('tabla-wrap').innerHTML = '';

  const exprOriginal = document.getElementById('expresion').value.trim();

  if (!exprOriginal) {
    mostrarError('Ingresa una expresión lógica.');
    return;
  }

  const variables = detectarVariables(exprOriginal);

  if (variables.length === 0) {
    mostrarError('No se detectaron variables. Usa letras como p, q, r.');
    return;
  }

  if (variables.length > 6) {
    mostrarError(`Demasiadas variables (${variables.length}). Máximo permitido: 6.`);
    return;
  }

  // Validar con valores de prueba
  const valoresPrueba = {};
  variables.forEach(v => valoresPrueba[v] = true);
  const validacion = validarExpresion(exprOriginal, variables, valoresPrueba);
  if (!validacion.ok) {
    mostrarError(validacion.msg);
    return;
  }

  // Generar combinaciones
  const numFilas = Math.pow(2, variables.length);
  const combinaciones = [];

  for (let i = 0; i < numFilas; i++) {
    const valores = {};
    variables.forEach((v, idx) => {
      valores[v] = Boolean(i & (1 << (variables.length - idx - 1)));
    });
    let resultado;
    try {
      resultado = evaluar(exprOriginal, variables, valores);
    } catch {
      resultado = null;
    }
    combinaciones.push({ valores, resultado });
  }

  // Clasificar
  const todosV = combinaciones.every(r => r.resultado === true);
  const todosF = combinaciones.every(r => r.resultado === false);
  const tipo = todosV ? 'tautologia' : todosF ? 'contradiccion' : 'contingente';
  mostrarClasificacion(tipo);

  // Construir tabla completa en memoria (sin setTimeout, sin parpadeo)
  const tabla = document.createElement('table');

  // Encabezado
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  variables.forEach(v => {
    const th = document.createElement('th');
    th.textContent = v;
    trHead.appendChild(th);
  });
  const thRes = document.createElement('th');
  thRes.textContent = exprOriginal;
  trHead.appendChild(thRes);
  thead.appendChild(trHead);
  tabla.appendChild(thead);

  // Cuerpo
  const tbody = document.createElement('tbody');
  combinaciones.forEach(({ valores, resultado }, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${i * 30}ms`;

    variables.forEach(v => {
      const td = document.createElement('td');
      const val = valores[v];
      td.textContent = val ? 'V' : 'F';
      td.className = val ? 'val-v' : 'val-f';
      tr.appendChild(td);
    });

    const tdRes = document.createElement('td');
    if (resultado === true) {
      tdRes.textContent = 'V';
      tdRes.className = 'val-v';
    } else if (resultado === false) {
      tdRes.textContent = 'F';
      tdRes.className = 'val-f';
    } else {
      tdRes.textContent = 'Error';
    }
    tr.appendChild(tdRes);
    tbody.appendChild(tr);
  });

  tabla.appendChild(tbody);
  document.getElementById('tabla-wrap').appendChild(tabla);
}
